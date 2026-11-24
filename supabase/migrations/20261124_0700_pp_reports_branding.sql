-- Session reports (anonymous totals only) and opt-in organisation branding in rooms. Additive.
-- Rollback: drop function public.pp_session_report(uuid), pp.session_report(uuid), public.pp_set_brand(uuid,text,text,boolean), pp.set_brand(uuid,text,text,boolean),
--           public.pp_room_brand(text), pp.room_brand(text); restore pp.my_sessions from 0200;
--           alter table pp.organisations drop column brand_on, drop column brand_color, drop column brand_emoji;
alter table pp.organisations
  add column brand_on boolean not null default false,
  add column brand_color text check (brand_color is null or brand_color ~ '^#[0-9A-Fa-f]{6}$'),
  add column brand_emoji text check (brand_emoji is null or char_length(brand_emoji) between 1 and 8);

create or replace function pp.my_sessions(p_org uuid) returns jsonb language sql stable security invoker set search_path = pp as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', session_id, 'title', title, 'joined', joined, 'completed', completed, 'average', average, 'endedAt', ended_at, 'startedAt', started_at) order by ended_at desc), '[]'::jsonb)
  from (select * from session_summaries where (p_org is null and host_user = auth.uid()) or (p_org is not null and org_id = p_org) order by ended_at desc limit 200) s
$$;

-- Report: the summary plus question and answer texts from the exact version that was played. RLS on summaries decides access.
create or replace function pp.session_report(p_id uuid) returns jsonb language sql stable security invoker set search_path = pp as $$
  select jsonb_build_object('id', s.session_id, 'title', s.title, 'joined', s.joined, 'completed', s.completed, 'average', s.average,
    'startedAt', s.started_at, 'endedAt', s.ended_at, 'version', v.version, 'scoring', v.content->'scoring'->>'kind',
    'groupMinimum', (v.content->'privacy'->>'groupMinimum')::int,
    'band', (select b->>'title' from jsonb_array_elements(coalesce(v.content->'results', '[]'::jsonb)) b where s.average between (b->>'min')::int and (b->>'max')::int limit 1),
    'questions', (select coalesce(jsonb_agg(jsonb_build_object('id', a->>'id', 'prompt', a->>'prompt', 'type', a->>'type',
        'options', (select coalesce(jsonb_agg(jsonb_build_object('id', o->>'id', 'text', o->>'text', 'correct', (o->>'correct')::boolean)), '[]'::jsonb) from jsonb_array_elements(coalesce(a->'options', '[]'::jsonb)) o),
        'result', s.per_activity -> (a->>'id')) order by r.ord, x.ord), '[]'::jsonb)
      from jsonb_array_elements(v.content->'rounds') with ordinality r(rd, ord), jsonb_array_elements(r.rd->'activities') with ordinality x(a, ord)))
  from session_summaries s left join experience_versions v on v.id = s.version_id
  where s.session_id = p_id
$$;

create or replace function pp.set_brand(p_org uuid, p_color text, p_emoji text, p_on boolean) returns void language plpgsql security definer set search_path = pp as $$
begin
  if not has_role(p_org, array['owner','admin']) then raise exception 'only owners and admins can change branding'; end if;
  update organisations set brand_color = nullif(p_color, ''), brand_emoji = nullif(p_emoji, ''), brand_on = coalesce(p_on, false) where id = p_org;
  perform _audit(p_org, 'org.brand', p_org::text, jsonb_build_object('on', p_on, 'color', p_color));
end $$;

-- What players see: the organisation's display name, colour and icon, only for rooms of organisations that switched branding on.
create or replace function pp.room_brand(p_code text) returns jsonb language sql stable security definer set search_path = pp as $$
  select jsonb_build_object('name', o.name, 'color', o.brand_color, 'emoji', o.brand_emoji)
  from sessions s join organisations o on o.id = s.org_id where s.code = p_code and o.brand_on
$$;

create or replace function pp.org_brand(p_org uuid) returns jsonb language sql stable security invoker set search_path = pp as $$
  select jsonb_build_object('on', brand_on, 'color', brand_color, 'emoji', brand_emoji) from organisations where id = p_org
$$;

revoke all on function pp.session_report(uuid), pp.set_brand(uuid, text, text, boolean), pp.room_brand(text), pp.org_brand(uuid) from public, anon, authenticated;
grant execute on function pp.session_report(uuid), pp.set_brand(uuid, text, text, boolean), pp.org_brand(uuid) to authenticated;
grant execute on function pp.room_brand(text) to anon, authenticated;
create or replace function public.pp_session_report(p_id uuid) returns jsonb language sql security invoker set search_path = '' as $$ select pp.session_report(p_id) $$;
create or replace function public.pp_set_brand(p_org uuid, p_color text, p_emoji text, p_on boolean) returns void language sql security invoker set search_path = '' as $$ select pp.set_brand(p_org, p_color, p_emoji, p_on) $$;
create or replace function public.pp_org_brand(p_org uuid) returns jsonb language sql security invoker set search_path = '' as $$ select pp.org_brand(p_org) $$;
-- Players are anonymous and have no access to schema pp: this public wrapper runs as definer, like the other player RPCs.
create or replace function public.pp_room_brand(p_code text) returns jsonb language sql stable security definer set search_path = '' as $$ select pp.room_brand(p_code) $$;
revoke all on function public.pp_session_report(uuid), public.pp_set_brand(uuid, text, text, boolean), public.pp_org_brand(uuid), public.pp_room_brand(text) from public, anon;
grant execute on function public.pp_session_report(uuid), public.pp_set_brand(uuid, text, text, boolean), public.pp_org_brand(uuid) to authenticated;
grant execute on function public.pp_room_brand(text) to anon, authenticated;
