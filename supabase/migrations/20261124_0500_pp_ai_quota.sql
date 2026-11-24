-- AI question drafts: per-user quota, enforced server-side. Only the draft-questions Edge Function (service role) calls it.
-- Stores user id + timestamp only (no prompts, no outputs). Additive.
-- Rollback: drop function public.pp_ai_take(uuid); drop function pp.ai_take(uuid); drop table pp.ai_requests;
create table pp.ai_requests (id bigint generated always as identity primary key, user_id uuid not null references auth.users(id) on delete cascade, at timestamptz not null default now());
create index on pp.ai_requests (user_id, at);
alter table pp.ai_requests enable row level security;

create or replace function pp.ai_take(p_user uuid) returns jsonb language plpgsql security definer set search_path = pp as $$
declare h int; d int;
begin
  delete from ai_requests where at < now() - interval '2 days';
  select count(*) filter (where at > now() - interval '1 hour'), count(*) into h, d from ai_requests where user_id = p_user and at > now() - interval '1 day';
  if h >= 15 then raise exception 'AI limit reached: 15 drafts per hour. Try again later.'; end if;
  if d >= 60 then raise exception 'AI limit reached: 60 drafts per day. Try again tomorrow.'; end if;
  insert into ai_requests(user_id) values (p_user);
  return jsonb_build_object('hourLeft', 14 - h, 'dayLeft', 59 - d);
end $$;
revoke all on function pp.ai_take(uuid) from public, anon, authenticated;
create or replace function public.pp_ai_take(p_user uuid) returns jsonb language sql security definer set search_path = '' as $$ select pp.ai_take(p_user) $$;
revoke all on function public.pp_ai_take(uuid) from public, anon, authenticated;
do $$ begin
  if exists(select 1 from pg_roles where rolname = 'service_role') then grant execute on function public.pp_ai_take(uuid) to service_role; end if;
end $$;
