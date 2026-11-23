-- Phase 1b slice 2b: read the latest PUBLISHED version of an experience (what a room will actually run), as the caller.
-- Additive only. Rollback: drop function public.pp_get_published(uuid); drop function pp.get_published(uuid);
create or replace function pp.get_published(p_id uuid) returns jsonb language sql stable security invoker set search_path = pp as $$
  select jsonb_build_object('version', v.version, 'content', v.content)
  from experience_versions v join experiences e on e.id = v.experience_id
  where e.id = p_id and e.status = 'published' order by v.version desc limit 1
$$;
revoke all on function pp.get_published(uuid) from public, anon, authenticated;
grant execute on function pp.get_published(uuid) to authenticated;
create or replace function public.pp_get_published(p_id uuid) returns jsonb language sql stable security invoker set search_path = '' as $$ select pp.get_published(p_id) $$;
revoke all on function public.pp_get_published(uuid) from public, anon;
grant execute on function public.pp_get_published(uuid) to authenticated;

-- Template copies get the "Copy of" title inside the content too, so library, rooms and insights use one name.
-- Rollback: re-run the pp.copy_template definition from 20261124_0200_pp_workspaces.sql.
create or replace function pp.copy_template(p_slug text, p_org uuid) returns jsonb language plpgsql security invoker set search_path = pp as $$
declare src experiences; v experience_versions; eid uuid; t text;
begin
  select * into src from experiences where slug = p_slug and status = 'published' and visibility = 'public';
  if not found then raise exception 'template not found'; end if;
  select * into v from experience_versions where experience_id = src.id order by version desc limit 1;
  t := left('Copy of ' || src.title, 60);
  insert into experiences(owner_user, org_id, title, visibility, status, draft, template_of)
    values (auth.uid(), p_org, t, case when p_org is null then 'private' else 'org' end, 'draft',
            jsonb_set(jsonb_set(jsonb_set(v.content, '{status}', '"draft"'), '{id}', to_jsonb(left('my-' || src.slug, 40))), '{title}', to_jsonb(t)), src.id)
    returning id into eid;
  return jsonb_build_object('id', eid);
end $$;
