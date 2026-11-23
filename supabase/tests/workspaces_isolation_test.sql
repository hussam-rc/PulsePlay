-- Organisation isolation, roles and permissions, exercised as separate users through the public API.
-- Alice owns org A; Bob owns org B; Carol is invited to A as creator; Dave to A as facilitator; Eve is an outsider.
create temp table t(name text, ok boolean, detail text);
grant all on t to anon, authenticated;
insert into auth.users(id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@example.org'), ('00000000-0000-0000-0000-00000000000b', 'bob@example.org'),
  ('00000000-0000-0000-0000-00000000000c', 'carol@example.org'), ('00000000-0000-0000-0000-00000000000d', 'dave@example.org'),
  ('00000000-0000-0000-0000-00000000000e', 'eve@example.org') on conflict do nothing;

create or replace function pg_temp.as_user(letter text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000000' || letter, 'email',
    (array['alice','bob','carol','dave','eve'])[ascii(letter) - 96] || '@example.org', 'role', 'authenticated')::text, false);
end $$;
grant execute on function pg_temp.as_user(text) to authenticated, anon;

set role authenticated;
-- ===== setup through the API =====
do $$ declare a jsonb; b jsonb; begin
  perform pg_temp.as_user('a'); a := public.pp_create_org('Org A'); perform set_config('t.orgA', a->>'id', false);
  perform public.pp_invite((a->>'id')::uuid, 'Carol@Example.org', 'creator');
  perform public.pp_invite((a->>'id')::uuid, 'dave@example.org', 'facilitator');
  perform pg_temp.as_user('b'); b := public.pp_create_org('Org B'); perform set_config('t.orgB', b->>'id', false);
  perform pg_temp.as_user('c'); insert into t values ('invite: carol joins A on sign-in', public.pp_accept_invites() = 1, null);
  perform pg_temp.as_user('d'); insert into t values ('invite: dave joins A on sign-in', public.pp_accept_invites() = 1, null);
  perform pg_temp.as_user('e'); insert into t values ('invite: outsider gets nothing', public.pp_accept_invites() = 0, null);
end $$;

-- ===== org visibility =====
do $$ declare A uuid := current_setting('t.orgA')::uuid; B uuid := current_setting('t.orgB')::uuid; me jsonb; ok boolean; begin
  perform pg_temp.as_user('a'); me := public.pp_me();
  insert into t values ('me: alice sees only org A as owner', jsonb_array_length(me->'orgs') = 1 and me->'orgs'->0->>'role' = 'owner', me->'orgs'::text);
  insert into t values ('members: alice sees 3 members with emails', jsonb_array_length(public.pp_members(A)->'members') = 3 and (public.pp_members(A)->'members')::text like '%carol@example.org%', null);
  perform pg_temp.as_user('d');
  insert into t values ('members: facilitator sees no other emails', not (public.pp_members(A)->'members')::text like '%carol@example.org%' and public.pp_members(A)->>'invites' is null, null);
  perform pg_temp.as_user('b');
  insert into t values ('iso: bob cannot read org A row', (select count(*) from pp.organisations where id = A) = 0, null);
  insert into t values ('iso: bob cannot read org A members table', (select count(*) from pp.org_members where org_id = A) = 0, null);
  begin perform public.pp_members(A); ok := false; exception when others then ok := sqlerrm like 'not a member%'; end;
  insert into t values ('iso: bob cannot list org A members', ok, null);
  begin perform public.pp_invite(A, 'mallory@example.org', 'admin'); ok := false; exception when others then ok := sqlerrm like 'only owners%'; end;
  insert into t values ('iso: bob cannot invite into org A', ok, null);
  insert into t values ('iso: bob cannot read org A audit', (select count(*) from pp.audit_events where org_id = A) = 0, null);
  perform pg_temp.as_user('a');
  insert into t values ('audit: alice sees org A audit trail', (select count(*) from pp.audit_events where org_id = A) >= 3, null);
end $$;

-- ===== drafts, templates, permissions =====
do $$ declare A uuid := current_setting('t.orgA')::uuid; p jsonb; o jsonb; ok boolean; begin
  perform pg_temp.as_user('a'); p := public.pp_save_draft(null, null, 'Alice private quiz', '{"schemaVersion":1}'); perform set_config('t.alicePriv', p->>'id', false);
  perform pg_temp.as_user('c'); o := public.pp_copy_template('myth-or-fact', A); perform set_config('t.carolOrg', o->>'id', false);
  insert into t values ('template: copy of built-in becomes a draft in org A', (public.pp_get_experience((o->>'id')::uuid)->>'status') = 'draft', null);
  insert into t values ('perm: creator can publish own org draft', public.pp_can_publish((o->>'id')::uuid), null);
  perform pg_temp.as_user('d');
  insert into t values ('perm: facilitator sees org draft in library', jsonb_array_length(public.pp_library(A)) = 1, null);
  insert into t values ('perm: facilitator cannot publish', not public.pp_can_publish((o->>'id')::uuid), null);
  begin perform public.pp_save_draft((o->>'id')::uuid, A, 'hijack', '{}'); ok := false; exception when others then ok := sqlerrm like 'experience not found or not editable%'; end;
  insert into t values ('perm: facilitator cannot edit drafts', ok, null);
  begin perform public.pp_copy_template('ego-check', A); ok := false; exception when others then ok := true; end;
  insert into t values ('perm: facilitator cannot create drafts in org', ok, null);
  perform pg_temp.as_user('b');
  insert into t values ('iso: bob cannot open alice''s private draft', public.pp_get_experience(current_setting('t.alicePriv')::uuid) is null, null);
  insert into t values ('iso: bob cannot open org A draft', public.pp_get_experience((o->>'id')::uuid) is null, null);
  insert into t values ('iso: bob''s org-A library is empty', jsonb_array_length(public.pp_library(A)) = 0, null);
  begin perform public.pp_save_draft(current_setting('t.alicePriv')::uuid, null, 'overwrite', '{}'); ok := false; exception when others then ok := true; end;
  insert into t values ('iso: bob cannot overwrite alice''s draft', ok, null);
  begin perform public.pp_save_draft(null, A, 'plant', '{}'); ok := false; exception when others then ok := true; end;
  insert into t values ('iso: bob cannot create drafts in org A', ok, null);
  insert into t values ('read: built-in games readable but not editable', (public.pp_get_experience((select id from pp.experiences where slug = 'ego-check'))->>'canEdit')::boolean = false, null);
  begin perform pp.publish_validated((o->>'id')::uuid, '00000000-0000-0000-0000-00000000000b', '{}'::jsonb, 'org'); ok := false; exception when insufficient_privilege then ok := true; end;
  insert into t values ('sec: users cannot call the service-only publish function', ok, null);
end $$;

-- ===== publish (as the Edge Function would, with the service role), host, insights =====
reset role;
do $$ declare A uuid := current_setting('t.orgA')::uuid; e uuid := current_setting('t.carolOrg')::uuid; c jsonb; ok boolean; begin
  c := (select content from pp.experience_versions v join pp.experiences x on x.id = v.experience_id where x.slug = 'myth-or-fact' limit 1);
  perform pp.publish_validated(e, '00000000-0000-0000-0000-00000000000c', c, 'org');
  begin perform pp.publish_validated(e, '00000000-0000-0000-0000-00000000000d', c, 'org'); ok := false; exception when others then ok := sqlerrm = 'not allowed to publish'; end;
  insert into t values ('publish: facilitator refused even via the service path', ok, null);
  begin perform pp.publish_validated(e, '00000000-0000-0000-0000-00000000000c', c, 'public'); ok := false; exception when others then ok := sqlerrm like 'public listing needs%'; end;
  insert into t values ('publish: public listing requires platform review', ok, null);
  begin update pp.experience_versions set content = '{}' where experience_id = e; ok := false; exception when others then ok := sqlerrm like 'experience versions are immutable%'; end;
  insert into t values ('versions: published versions are immutable', ok, null);
end $$;
set role authenticated;
do $$ declare A uuid := current_setting('t.orgA')::uuid; e text := current_setting('t.carolOrg'); s jsonb; ok boolean; tok text; begin
  perform pg_temp.as_user('d'); s := public.pp_create_session(e, '{}');
  insert into t values ('host: facilitator can host org experience', s->>'code' ~ '^\d{6}$', null);
  perform set_config('t.code', s->>'code', false); perform set_config('t.host', s->>'hostToken', false);
  perform pg_temp.as_user('b');
  begin perform public.pp_create_session(e, '{}'); ok := false; exception when others then ok := sqlerrm = 'experience not found'; end;
  insert into t values ('iso: bob cannot host org A experience', ok, null);
  perform set_config('request.jwt.claims', '', false);
  begin perform public.pp_create_session(e, '{}'); ok := false; exception when others then ok := sqlerrm = 'experience not found'; end;
  insert into t values ('iso: anonymous cannot host org A experience', ok, null);
  tok := public.pp_join(current_setting('t.code'), 'Guest', null, null, true)->>'token';
  insert into t values ('play: anonymous participant can still join without an account', tok is not null, null);
  perform public.pp_host_command(current_setting('t.code'), current_setting('t.host'), 'end');
  perform pg_temp.as_user('a');
  insert into t values ('insights: org owner sees the session summary', jsonb_array_length(public.pp_my_sessions(A)) = 1, null);
  perform pg_temp.as_user('d');
  insert into t values ('insights: hosting facilitator sees it', jsonb_array_length(public.pp_my_sessions(A)) = 1, null);
  perform pg_temp.as_user('b');
  insert into t values ('iso: bob sees no org A insights', jsonb_array_length(public.pp_my_sessions(A)) = 0 and (select count(*) from pp.session_summaries) = 0, null);
end $$;

-- ===== roles =====
do $$ declare A uuid := current_setting('t.orgA')::uuid; ok boolean; begin
  perform pg_temp.as_user('c');
  begin perform public.pp_set_role(A, '00000000-0000-0000-0000-00000000000d', 'admin'); ok := false; exception when others then ok := true; end;
  insert into t values ('roles: creator cannot change roles', ok, null);
  perform pg_temp.as_user('a'); perform public.pp_set_role(A, '00000000-0000-0000-0000-00000000000d', 'admin');
  insert into t values ('roles: owner promotes dave to admin', (select role from pp.org_members where org_id = A and user_id = '00000000-0000-0000-0000-00000000000d') = 'admin', null);
  perform pg_temp.as_user('d');
  begin perform public.pp_set_role(A, '00000000-0000-0000-0000-00000000000d', 'owner'); ok := false; exception when others then ok := sqlerrm like 'only owners%'; end;
  insert into t values ('roles: admin cannot make himself owner', ok, null);
  begin perform public.pp_remove_member(A, '00000000-0000-0000-0000-00000000000a'); ok := false; exception when others then ok := true; end;
  insert into t values ('roles: admin cannot remove the owner', ok, null);
  perform pg_temp.as_user('a');
  begin perform public.pp_remove_member(A, '00000000-0000-0000-0000-00000000000a'); ok := false; exception when others then ok := sqlerrm like 'an organisation needs at least one owner%'; end;
  insert into t values ('roles: last owner cannot leave', ok, null);
  perform public.pp_remove_member(A, '00000000-0000-0000-0000-00000000000c');
  perform pg_temp.as_user('c');
  insert into t values ('roles: removed creator loses access to org drafts', public.pp_get_experience(current_setting('t.carolOrg')::uuid) is null, null);
  insert into t values ('published: removed creator cannot read published content', public.pp_get_published(current_setting('t.carolOrg')::uuid) is null, null);
  perform pg_temp.as_user('d');
  insert into t values ('published: member reads the version a room will run', (public.pp_get_published(current_setting('t.carolOrg')::uuid)->>'version')::int = 1, null);
  perform pg_temp.as_user('b');
  insert into t values ('published: outsider cannot read org published content', public.pp_get_published(current_setting('t.carolOrg')::uuid) is null, null);
end $$;

reset role;
set role anon;
do $$ declare ok boolean; begin
  begin perform public.pp_me(); ok := false; exception when insufficient_privilege then ok := true; end;
  insert into t values ('anon: workspace functions are not callable without signing in', ok, null);
  begin perform 1 from pp.organisations; ok := false; exception when insufficient_privilege then ok := true; end;
  insert into t values ('anon: cannot read organisation tables', ok, null);
end $$;
reset role;
delete from pp.session_summaries; delete from pp.audit_events; delete from pp.organisations; delete from pp.experiences where not built_in; delete from pp.profiles; delete from pp.rate_limits;
delete from auth.users where email like '%@example.org';
select string_agg(case when ok then 'PASS ' else 'FAIL ' end || name || coalesce('  [' || left(detail, 120) || ']', ''), E'\n' order by ok, name) || E'\n' || count(*) filter (where ok) || ' passed, ' || count(*) filter (where not ok) || ' failed' from t;
