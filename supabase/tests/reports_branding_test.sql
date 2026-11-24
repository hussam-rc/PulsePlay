create temp table t(name text, ok boolean, detail text);
grant all on t to anon, authenticated;
insert into auth.users(id, email) values ('00000000-0000-0000-0000-0000000000b1', 'own@example.org'), ('00000000-0000-0000-0000-0000000000b2', 'fac@example.org'), ('00000000-0000-0000-0000-0000000000b3', 'out@example.org') on conflict do nothing;
create or replace function pg_temp.as_user(u text) returns void language sql as $$ select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-0000000000' || u, 'email', u || '@example.org', 'role', 'authenticated')::text, false) $$;
grant execute on function pg_temp.as_user(text) to authenticated, anon;
set role authenticated;
do $$ declare o uuid; begin
  perform pg_temp.as_user('b1'); o := (public.pp_create_org('Brand Org')->>'id')::uuid; perform set_config('t.org', o::text, false);
  perform public.pp_invite(o, 'b2@example.org', 'facilitator');
  perform pg_temp.as_user('b2'); perform set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-0000000000b2', 'email', 'b2@example.org', 'role', 'authenticated')::text, false); perform public.pp_accept_invites();
end $$;
reset role;
update pp.org_members set role = 'facilitator' where user_id = '00000000-0000-0000-0000-0000000000b2';
insert into pp.org_members(org_id, user_id, role) select current_setting('t.org')::uuid, '00000000-0000-0000-0000-0000000000b2', 'facilitator' on conflict do nothing;
set role authenticated;
do $$ declare o uuid := current_setting('t.org')::uuid; c jsonb; code text; h text; tk text[] := '{}'; i int; ok boolean; r jsonb; begin
  -- branding
  perform pg_temp.as_user('b2');
  begin perform public.pp_set_brand(o, '#123456', '🚀', true); ok := false; exception when others then ok := sqlerrm like 'only owners and admins%'; end;
  insert into t values ('brand: facilitator cannot change branding', ok, null);
  perform pg_temp.as_user('b1');
  begin perform public.pp_set_brand(o, 'red', '🚀', true); ok := false; exception when others then ok := true; end;
  insert into t values ('brand: colour must be a hex code', ok, null);
  -- a branded-off room shows no brand
  perform pg_temp.as_user('b2');
  c := public.pp_create_session((select id::text from pp.experiences where slug = 'would-you-rather'), '{}');
  insert into t values ('brand: off by default, rooms show nothing', public.pp_room_brand(c->>'code') is null, null);
  perform public.pp_host_command(c->>'code', c->>'hostToken', 'end');
end $$;
-- org-owned experience to get an org room
reset role;
insert into pp.experiences(owner_user, org_id, title, visibility, status, draft) select '00000000-0000-0000-0000-0000000000b1', current_setting('t.org')::uuid, 'Org poll', 'org', 'published', content from pp.experience_versions v join pp.experiences e on e.id = v.experience_id where e.slug = 'would-you-rather' limit 1;
insert into pp.experience_versions(experience_id, version, content, schema_version) select id, 1, draft, 1 from pp.experiences where title = 'Org poll';
set role authenticated;
do $$ declare o uuid := current_setting('t.org')::uuid; e text := (select id::text from pp.experiences where title = 'Org poll'); c jsonb; code text; h text; tk text[] := '{}'; i int; r jsonb; s uuid; begin
  perform pg_temp.as_user('b1'); perform public.pp_set_brand(o, '#5A36F0', '🚀', true);
  perform pg_temp.as_user('b2'); c := public.pp_create_session(e, '{}'); code := c->>'code'; h := c->>'hostToken';
  perform set_config('request.jwt.claims', '', false);
  r := public.pp_room_brand(code);
  insert into t values ('brand: when on, players see name, colour and icon only', r = '{"name": "Brand Org", "color": "#5A36F0", "emoji": "🚀"}'::jsonb, r::text);
  for i in 1..4 loop tk := tk || (public.pp_join(code, 'Name' || i, null, null, true)->>'token'); end loop;
  perform public.pp_host_command(code, h, 'next'); perform public.pp_host_command(code, h, 'next'); perform public.pp_host_command(code, h, 'next');
  for i in 1..4 loop perform public.pp_submit(tk[i], 'w1', to_jsonb(case when i <= 3 then 'a' else 'b' end)); end loop;
  perform public.pp_host_command(code, h, 'next');
  perform public.pp_host_command(code, h, 'end');
  perform pg_temp.as_user('b2');
  s := (public.pp_my_sessions(o)->0->>'id')::uuid; perform set_config('t.sid', s::text, false);
  r := public.pp_session_report(s);
  insert into t values ('report: facilitator gets the report with question texts', r->>'title' = 'Would You Rather?' and r->'questions'->0->>'prompt' is not null and jsonb_array_length(r->'questions') = 10, left(r::text, 200));
  insert into t values ('report: anonymous counts for the played question', (r->'questions'->0->'result'->'counts'->>'a')::int = 3, (r->'questions'->0->'result')::text);
  insert into t values ('report: contains no nicknames', r::text not like '%Name1%' and r::text not like '%Name4%', null);
  perform pg_temp.as_user('b3');
  insert into t values ('report: outsider gets nothing', public.pp_session_report(s) is null, null);
  insert into t values ('brand: outsider cannot read org branding settings', public.pp_org_brand(o) is null, null);
end $$;
reset role; set role anon;
insert into t select 'brand: anonymous players can read a room brand', public.pp_room_brand('000000') is null, null;
do $$ declare ok boolean; begin
  begin perform public.pp_session_report(current_setting('t.sid')::uuid); ok := false; exception when insufficient_privilege then ok := true; end;
  insert into t values ('report: anonymous callers cannot request reports', ok, null);
end $$;
reset role;
delete from pp.session_summaries where org_id = current_setting('t.org')::uuid; delete from pp.experiences where title = 'Org poll';
delete from pp.organisations where name = 'Brand Org'; delete from auth.users where email like '%@example.org' and id::text like '00000000-0000-0000-0000-0000000000b%';
select case when ok then 'PASS' else 'FAIL' end || '  ' || name from t order by ok, name;
select count(*) filter (where ok) || ' passed, ' || count(*) filter (where not ok) || ' failed' from t;
