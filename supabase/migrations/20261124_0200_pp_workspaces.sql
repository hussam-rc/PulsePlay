-- PulsePlay workspaces: creator profiles, organisations, roles, invitations, drafts, versions, saved sessions, audit.
-- Isolation is enforced twice: Row Level Security on every table, and permission checks inside every privileged function.
-- Rollback: drop the public.pp_* functions added below and the tables/policies in this file (pp.profiles, pp.organisations,
-- pp.org_members, pp.org_invites, pp.audit_events), then `alter table pp.experiences drop constraint experiences_org_fk`.

-- ---------- Identity & organisations ----------
create table pp.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) between 1 and 60),
  created_at timestamptz not null default now()
);
create table pp.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  created_by uuid references auth.users(id) on delete set null,
  retention_days int not null default 365 check (retention_days between 1 and 3650),
  created_at timestamptz not null default now()
);
create table pp.org_members (
  org_id uuid not null references pp.organisations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'creator', 'facilitator')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create table pp.org_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references pp.organisations(id) on delete cascade,
  email text not null check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role text not null check (role in ('admin', 'creator', 'facilitator')),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique (org_id, email)
);
create table pp.audit_events (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid, org_id uuid, action text not null, target text, details jsonb
);
alter table pp.experiences add constraint experiences_org_fk foreign key (org_id) references pp.organisations(id) on delete cascade;
create index on pp.org_members (user_id);
create index on pp.experiences (owner_user);
create index on pp.experiences (org_id);
create index on pp.session_summaries (org_id);
create index on pp.session_summaries (host_user);

alter table pp.profiles enable row level security;
alter table pp.organisations enable row level security;
alter table pp.org_members enable row level security;
alter table pp.org_invites enable row level security;
alter table pp.audit_events enable row level security;

-- Membership check used by policies. SECURITY DEFINER avoids policy recursion on org_members.
create or replace function pp.has_role(p_org uuid, p_roles text[] default array['owner','admin','creator','facilitator'])
returns boolean language sql stable security definer set search_path = pp as $$
  select p_org is not null and exists(select 1 from org_members where org_id = p_org and user_id = auth.uid() and role = any(p_roles))
$$;
create or replace function pp._audit(p_org uuid, p_action text, p_target text, p_details jsonb default null) returns void
language sql security definer set search_path = pp as $$ insert into audit_events(actor, org_id, action, target, details) values (auth.uid(), p_org, p_action, p_target, p_details) $$;

-- ---------- Row Level Security ----------
create policy profiles_self on pp.profiles for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy profiles_org_peers on pp.profiles for select to authenticated using (
  exists(select 1 from pp.org_members a join pp.org_members b on a.org_id = b.org_id where a.user_id = auth.uid() and b.user_id = profiles.user_id));

create policy orgs_members_read on pp.organisations for select to authenticated using (pp.has_role(id));
create policy orgs_admin_update on pp.organisations for update to authenticated using (pp.has_role(id, array['owner','admin'])) with check (pp.has_role(id, array['owner','admin']));

create policy members_read on pp.org_members for select to authenticated using (pp.has_role(org_id));
create policy invites_admin_read on pp.org_invites for select to authenticated using (pp.has_role(org_id, array['owner','admin']));
create policy audit_admin_read on pp.audit_events for select to authenticated using (pp.has_role(org_id, array['owner','admin']));

-- Organisation content is visible to current members only: authorship alone does not survive leaving the organisation.
create policy exp_read on pp.experiences for select to authenticated using (
  (owner_user = auth.uid() and org_id is null) or pp.has_role(org_id) or (status = 'published' and visibility = 'public'));
create policy exp_insert on pp.experiences for insert to authenticated with check (
  owner_user = auth.uid() and built_in = false and status = 'draft'
  and (org_id is null or pp.has_role(org_id, array['owner','admin','creator'])));
create policy exp_update on pp.experiences for update to authenticated using (
  built_in = false and ((owner_user = auth.uid() and (org_id is null or pp.has_role(org_id, array['owner','admin','creator']))) or pp.has_role(org_id, array['owner','admin'])))
  with check (built_in = false and (org_id is null or pp.has_role(org_id, array['owner','admin','creator'])));
create policy exp_delete on pp.experiences for delete to authenticated using (
  built_in = false and ((owner_user = auth.uid() and org_id is null) or pp.has_role(org_id, array['owner','admin'])));

create policy ver_read on pp.experience_versions for select to authenticated using (
  exists(select 1 from pp.experiences e where e.id = experience_id));   -- inherits the experiences policy

create policy summaries_read on pp.session_summaries for select to authenticated using (
  host_user = auth.uid() or pp.has_role(org_id, array['owner','admin','facilitator']));

-- Authenticated users reach these tables only through public functions (schema pp is not exposed by the API).
grant usage on schema pp to authenticated;
grant select, insert, update, delete on pp.experiences to authenticated;
grant select on pp.experience_versions, pp.organisations, pp.org_members, pp.org_invites, pp.audit_events, pp.session_summaries to authenticated;
grant select, insert, update on pp.profiles to authenticated;
grant update on pp.organisations to authenticated;
grant execute on function pp.has_role(uuid, text[]) to authenticated;

-- ---------- Functions: identity & organisations ----------
create or replace function pp.me() returns jsonb language plpgsql security invoker set search_path = pp as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return null; end if;
  insert into profiles(user_id) values (uid) on conflict do nothing;
  return jsonb_build_object(
    'userId', uid, 'email', auth.jwt()->>'email',
    'displayName', (select display_name from profiles where user_id = uid),
    'orgs', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name, 'role', m.role) order by o.name)
                      from org_members m join organisations o on o.id = m.org_id where m.user_id = uid), '[]'::jsonb));
end $$;

create or replace function pp.create_org(p_name text) returns jsonb language plpgsql security definer set search_path = pp as $$
declare uid uuid := auth.uid(); oid uuid;
begin
  if uid is null then raise exception 'sign in first'; end if;
  if (select count(*) from org_members where user_id = uid and role = 'owner') >= 20 then raise exception 'organisation limit reached'; end if;
  insert into organisations(name, created_by) values (trim(p_name), uid) returning id into oid;
  insert into org_members(org_id, user_id, role) values (oid, uid, 'owner');
  perform _audit(oid, 'org.create', oid::text, jsonb_build_object('name', trim(p_name)));
  return jsonb_build_object('id', oid);
end $$;

create or replace function pp.invite(p_org uuid, p_email text, p_role text) returns void language plpgsql security definer set search_path = pp as $$
begin
  if not has_role(p_org, array['owner','admin']) then raise exception 'only owners and admins can invite'; end if;
  if p_role not in ('admin','creator','facilitator') then raise exception 'invalid role'; end if;
  if p_role = 'admin' and not has_role(p_org, array['owner']) then raise exception 'only owners can invite admins'; end if;
  insert into org_invites(org_id, email, role, invited_by) values (p_org, lower(trim(p_email)), p_role, auth.uid())
    on conflict (org_id, email) do update set role = excluded.role, invited_by = excluded.invited_by, accepted_at = null, created_at = now();
  perform _audit(p_org, 'member.invite', lower(trim(p_email)), jsonb_build_object('role', p_role));
end $$;

-- Invitations are accepted automatically when someone signs in with the invited email address.
create or replace function pp.accept_invites() returns int language plpgsql security definer set search_path = pp as $$
declare uid uuid := auth.uid(); em text := lower(auth.jwt()->>'email'); n int := 0; r record;
begin
  if uid is null or em is null or coalesce((auth.jwt()->>'email_verified')::boolean, (auth.jwt()->'user_metadata'->>'email_verified')::boolean, true) = false then return 0; end if;
  for r in select * from org_invites where email = em and accepted_at is null loop
    insert into org_members(org_id, user_id, role) values (r.org_id, uid, r.role) on conflict (org_id, user_id) do nothing;
    update org_invites set accepted_at = now() where id = r.id;
    perform _audit(r.org_id, 'member.join', uid::text, jsonb_build_object('role', r.role));
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function pp.set_role(p_org uuid, p_user uuid, p_role text) returns void language plpgsql security definer set search_path = pp as $$
declare cur text;
begin
  select role into cur from org_members where org_id = p_org and user_id = p_user;
  if cur is null then raise exception 'not a member'; end if;
  if p_role not in ('owner','admin','creator','facilitator') then raise exception 'invalid role'; end if;
  if (cur in ('owner','admin') or p_role in ('owner','admin')) and not has_role(p_org, array['owner']) then raise exception 'only owners can change admin or owner roles'; end if;
  if not has_role(p_org, array['owner','admin']) then raise exception 'only owners and admins can change roles'; end if;
  if cur = 'owner' and p_role <> 'owner' and (select count(*) from org_members where org_id = p_org and role = 'owner') = 1 then raise exception 'an organisation needs at least one owner'; end if;
  update org_members set role = p_role where org_id = p_org and user_id = p_user;
  perform _audit(p_org, 'member.role', p_user::text, jsonb_build_object('from', cur, 'to', p_role));
end $$;

create or replace function pp.remove_member(p_org uuid, p_user uuid) returns void language plpgsql security definer set search_path = pp as $$
declare cur text;
begin
  select role into cur from org_members where org_id = p_org and user_id = p_user;
  if cur is null then raise exception 'not a member'; end if;
  if p_user <> auth.uid() then
    if not has_role(p_org, array['owner','admin']) then raise exception 'only owners and admins can remove members'; end if;
    if cur in ('owner','admin') and not has_role(p_org, array['owner']) then raise exception 'only owners can remove admins or owners'; end if;
  end if;
  if cur = 'owner' and (select count(*) from org_members where org_id = p_org and role = 'owner') = 1 then raise exception 'an organisation needs at least one owner'; end if;
  delete from org_members where org_id = p_org and user_id = p_user;
  perform _audit(p_org, 'member.remove', p_user::text, null);
end $$;

create or replace function pp.members(p_org uuid) returns jsonb language plpgsql security definer set search_path = pp as $$
begin
  if not has_role(p_org) then raise exception 'not a member of this organisation'; end if;
  return jsonb_build_object(
    'members', (select coalesce(jsonb_agg(jsonb_build_object('userId', m.user_id, 'role', m.role, 'name', p.display_name,
                  'email', case when has_role(p_org, array['owner','admin']) or m.user_id = auth.uid() then u.email end) order by m.role, u.email), '[]'::jsonb)
                from org_members m join auth.users u on u.id = m.user_id left join profiles p on p.user_id = m.user_id where m.org_id = p_org),
    'invites', case when has_role(p_org, array['owner','admin']) then (select coalesce(jsonb_agg(jsonb_build_object('email', email, 'role', role, 'at', created_at) order by created_at desc), '[]'::jsonb)
                from org_invites where org_id = p_org and accepted_at is null) end);
end $$;

-- ---------- Functions: experiences (drafts, templates, versions) ----------
create or replace function pp.save_draft(p_id uuid, p_org uuid, p_title text, p_draft jsonb) returns jsonb language plpgsql security invoker set search_path = pp as $$
declare eid uuid;
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  if pg_column_size(p_draft) > 512 * 1024 then raise exception 'experience is too large'; end if;
  if p_id is null then
    insert into experiences(owner_user, org_id, title, visibility, status, draft) values (auth.uid(), p_org, left(trim(p_title), 60), case when p_org is null then 'private' else 'org' end, 'draft', p_draft) returning id into eid;
  else
    update experiences set title = left(trim(p_title), 60), draft = p_draft, updated_at = now() where id = p_id returning id into eid;
    if eid is null then raise exception 'experience not found or not editable'; end if;
  end if;
  return jsonb_build_object('id', eid);
end $$;

create or replace function pp.copy_template(p_slug text, p_org uuid) returns jsonb language plpgsql security invoker set search_path = pp as $$
declare src experiences; v experience_versions; eid uuid;
begin
  select * into src from experiences where slug = p_slug and status = 'published' and visibility = 'public';
  if not found then raise exception 'template not found'; end if;
  select * into v from experience_versions where experience_id = src.id order by version desc limit 1;
  insert into experiences(owner_user, org_id, title, visibility, status, draft, template_of)
    values (auth.uid(), p_org, left('Copy of ' || src.title, 60), case when p_org is null then 'private' else 'org' end, 'draft',
            jsonb_set(jsonb_set(v.content, '{status}', '"draft"'), '{id}', to_jsonb(left('my-' || src.slug, 40))), src.id)
    returning id into eid;
  return jsonb_build_object('id', eid);
end $$;

create or replace function pp.library(p_org uuid) returns jsonb language sql stable security invoker set search_path = pp as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'title', e.title, 'status', e.status, 'visibility', e.visibility, 'orgId', e.org_id,
    'mine', e.owner_user = auth.uid(), 'updatedAt', e.updated_at,
    'latestVersion', (select max(version) from experience_versions v where v.experience_id = e.id)) order by e.updated_at desc), '[]'::jsonb)
  from experiences e
  where not e.built_in and ((p_org is null and e.owner_user = auth.uid() and e.org_id is null) or (p_org is not null and e.org_id = p_org))
$$;

create or replace function pp.get_experience(p_id uuid) returns jsonb language sql stable security invoker set search_path = pp as $$
  select jsonb_build_object('id', e.id, 'title', e.title, 'status', e.status, 'visibility', e.visibility, 'orgId', e.org_id, 'draft', e.draft,
    'canEdit', (not e.built_in and ((e.owner_user = auth.uid() and (e.org_id is null or has_role(e.org_id, array['owner','admin','creator']))) or has_role(e.org_id, array['owner','admin']))),
    'canPublish', (not e.built_in and ((e.owner_user = auth.uid() and e.org_id is null) or has_role(e.org_id, array['owner','admin','creator']))),
    'versions', (select coalesce(jsonb_agg(jsonb_build_object('version', version, 'publishedAt', published_at) order by version desc), '[]'::jsonb) from experience_versions v where v.experience_id = e.id))
  from experiences e where e.id = p_id
$$;

-- Permission check the publish Edge Function calls with the user's own token before validating.
create or replace function pp.can_publish(p_id uuid) returns boolean language sql stable security invoker set search_path = pp as $$
  select coalesce((select (not e.built_in and ((e.owner_user = auth.uid() and e.org_id is null) or has_role(e.org_id, array['owner','admin','creator'])))
    from experiences e where e.id = p_id), false)
$$;

-- Called ONLY by the publish Edge Function with the service role, after server-side validation with the shared TypeScript engine.
create or replace function pp.publish_validated(p_id uuid, p_user uuid, p_content jsonb, p_visibility text) returns jsonb language plpgsql security definer set search_path = pp as $$
declare e experiences; n int;
begin
  select * into e from experiences where id = p_id for update;
  if not found or e.built_in then raise exception 'experience not found'; end if;
  if not ((e.owner_user = p_user and e.org_id is null) or exists(select 1 from org_members where org_id = e.org_id and user_id = p_user and role in ('owner','admin','creator'))) then
    raise exception 'not allowed to publish'; end if;
  if p_visibility not in ('private','org','unlisted') then raise exception 'public listing needs platform review (not available yet)'; end if;
  if p_visibility = 'org' and e.org_id is null then raise exception 'personal experiences cannot be shared with an organisation'; end if;
  n := coalesce((select max(version) from experience_versions where experience_id = p_id), 0) + 1;
  insert into experience_versions(experience_id, version, content, schema_version, published_by) values (p_id, n, p_content, (p_content->>'schemaVersion')::int, p_user);
  update experiences set status = 'published', visibility = p_visibility, updated_at = now() where id = p_id;
  insert into audit_events(actor, org_id, action, target, details) values (p_user, e.org_id, 'experience.publish', p_id::text, jsonb_build_object('version', n, 'visibility', p_visibility));
  return jsonb_build_object('version', n);
end $$;

create or replace function pp.my_sessions(p_org uuid) returns jsonb language sql stable security invoker set search_path = pp as $$
  select coalesce(jsonb_agg(jsonb_build_object('title', title, 'joined', joined, 'completed', completed, 'average', average, 'endedAt', ended_at, 'startedAt', started_at) order by ended_at desc), '[]'::jsonb)
  from (select * from session_summaries where (p_org is null and host_user = auth.uid()) or (p_org is not null and org_id = p_org) order by ended_at desc limit 50) s
$$;

-- Hosting: public built-ins stay open to everyone (no account); private/org experiences need the owner or an org member.
create or replace function pp.create_session(p_experience text, p_settings jsonb, p_host_user uuid default null)
returns jsonb language plpgsql set search_path = pp, extensions as $$
declare v experience_versions; e experiences; c text; tok text := encode(gen_random_bytes(24), 'hex'); sid uuid; st jsonb := '{}'; n int;
begin
  perform _rate('create', 30, interval '1 hour');
  delete from sessions where expires_at < now();
  select * into e from experiences where (slug = p_experience or id::text = p_experience) and status = 'published';
  if not found or not (e.visibility in ('public', 'unlisted') or (p_host_user is not null and (e.owner_user = p_host_user or has_role(e.org_id))))
    then raise exception 'experience not found'; end if;
  select * into v from experience_versions where experience_id = e.id order by version desc limit 1;
  if not found then raise exception 'experience has no published version'; end if;
  if p_settings ? 'readSec'   then if (p_settings->>'readSec')::int not between 0 and 30 then raise exception 'readSec must be 0-30'; end if; st := st || jsonb_build_object('readSec', (p_settings->>'readSec')::int); end if;
  if p_settings ? 'answerSec' then if (p_settings->>'answerSec')::int not between 3 and 120 then raise exception 'answerSec must be 3-120'; end if; st := st || jsonb_build_object('answerSec', (p_settings->>'answerSec')::int); end if;
  if p_settings ? 'autoAdvanceSec' and p_settings->>'autoAdvanceSec' is not null then
    if (p_settings->>'autoAdvanceSec')::int not between 3 and 60 then raise exception 'autoAdvanceSec must be 3-60'; end if;
    st := st || jsonb_build_object('autoAdvanceSec', (p_settings->>'autoAdvanceSec')::int); end if;
  if coalesce((p_settings->>'leaderboard')::boolean, false) then
    if v.content->'scoring'->>'kind' <> 'correct' then raise exception 'leaderboards are only available for knowledge games'; end if;
    st := st || '{"leaderboard": true}';
  end if;
  select count(*) into n from _activities(v.content);
  loop c := lpad((floor(random() * 900000) + 100000)::int::text, 6, '0'); exit when not exists(select 1 from sessions where code = c); end loop;
  insert into sessions(code, version_id, snapshot, settings, host_user, org_id, n_activities) values (c, v.id, v.content, st, p_host_user, e.org_id, n) returning id into sid;
  insert into session_secrets values (sid, _hash(tok));
  return jsonb_build_object('code', c, 'hostToken', tok, 'state', _state(sid, true));
end $$;
revoke all on function pp.create_session(text, jsonb, uuid) from public, anon, authenticated;

-- ---------- Public API (signed-in creators). Wrappers are SECURITY INVOKER so Row Level Security applies to the caller. ----------
revoke all on function pp.me(), pp.create_org(text), pp.invite(uuid, text, text), pp.accept_invites(), pp.set_role(uuid, uuid, text), pp.remove_member(uuid, uuid),
  pp.members(uuid), pp.save_draft(uuid, uuid, text, jsonb), pp.copy_template(text, uuid), pp.library(uuid), pp.get_experience(uuid), pp.can_publish(uuid),
  pp.my_sessions(uuid), pp.publish_validated(uuid, uuid, jsonb, text), pp._audit(uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function pp.me(), pp.create_org(text), pp.invite(uuid, text, text), pp.accept_invites(), pp.set_role(uuid, uuid, text), pp.remove_member(uuid, uuid),
  pp.members(uuid), pp.save_draft(uuid, uuid, text, jsonb), pp.copy_template(text, uuid), pp.library(uuid), pp.get_experience(uuid), pp.can_publish(uuid),
  pp.my_sessions(uuid) to authenticated;
do $$ begin
  if exists(select 1 from pg_roles where rolname = 'service_role') then grant usage on schema pp to service_role; grant execute on function pp.publish_validated(uuid, uuid, jsonb, text) to service_role; end if;
end $$;

create or replace function public.pp_me() returns jsonb language sql security invoker set search_path = '' as $$ select pp.me() $$;
create or replace function public.pp_create_org(p_name text) returns jsonb language sql security invoker set search_path = '' as $$ select pp.create_org(p_name) $$;
create or replace function public.pp_invite(p_org uuid, p_email text, p_role text) returns void language sql security invoker set search_path = '' as $$ select pp.invite(p_org, p_email, p_role) $$;
create or replace function public.pp_accept_invites() returns int language sql security invoker set search_path = '' as $$ select pp.accept_invites() $$;
create or replace function public.pp_set_role(p_org uuid, p_user uuid, p_role text) returns void language sql security invoker set search_path = '' as $$ select pp.set_role(p_org, p_user, p_role) $$;
create or replace function public.pp_remove_member(p_org uuid, p_user uuid) returns void language sql security invoker set search_path = '' as $$ select pp.remove_member(p_org, p_user) $$;
create or replace function public.pp_members(p_org uuid) returns jsonb language sql security invoker set search_path = '' as $$ select pp.members(p_org) $$;
create or replace function public.pp_save_draft(p_id uuid, p_org uuid, p_title text, p_draft jsonb) returns jsonb language sql security invoker set search_path = '' as $$ select pp.save_draft(p_id, p_org, p_title, p_draft) $$;
create or replace function public.pp_copy_template(p_slug text, p_org uuid default null) returns jsonb language sql security invoker set search_path = '' as $$ select pp.copy_template(p_slug, p_org) $$;
create or replace function public.pp_library(p_org uuid default null) returns jsonb language sql security invoker set search_path = '' as $$ select pp.library(p_org) $$;
create or replace function public.pp_get_experience(p_id uuid) returns jsonb language sql security invoker set search_path = '' as $$ select pp.get_experience(p_id) $$;
create or replace function public.pp_can_publish(p_id uuid) returns boolean language sql security invoker set search_path = '' as $$ select pp.can_publish(p_id) $$;
create or replace function public.pp_my_sessions(p_org uuid default null) returns jsonb language sql security invoker set search_path = '' as $$ select pp.my_sessions(p_org) $$;
revoke all on function public.pp_me(), public.pp_create_org(text), public.pp_invite(uuid, text, text), public.pp_accept_invites(), public.pp_set_role(uuid, uuid, text),
  public.pp_remove_member(uuid, uuid), public.pp_members(uuid), public.pp_save_draft(uuid, uuid, text, jsonb), public.pp_copy_template(text, uuid), public.pp_library(uuid),
  public.pp_get_experience(uuid), public.pp_can_publish(uuid), public.pp_my_sessions(uuid) from public, anon;
grant execute on function public.pp_me(), public.pp_create_org(text), public.pp_invite(uuid, text, text), public.pp_accept_invites(), public.pp_set_role(uuid, uuid, text),
  public.pp_remove_member(uuid, uuid), public.pp_members(uuid), public.pp_save_draft(uuid, uuid, text, jsonb), public.pp_copy_template(text, uuid), public.pp_library(uuid),
  public.pp_get_experience(uuid), public.pp_can_publish(uuid), public.pp_my_sessions(uuid) to authenticated;

-- Entry point for the publish Edge Function. Executable ONLY by the service role (never by browsers).
create or replace function public.pp_publish_validated(p_id uuid, p_user uuid, p_content jsonb, p_visibility text) returns jsonb
  language sql security definer set search_path = '' as $$ select pp.publish_validated(p_id, p_user, p_content, p_visibility) $$;
revoke all on function public.pp_publish_validated(uuid, uuid, jsonb, text) from public, anon, authenticated;
do $$ begin
  if exists(select 1 from pg_roles where rolname = 'service_role') then grant execute on function public.pp_publish_validated(uuid, uuid, jsonb, text) to service_role; end if;
end $$;
