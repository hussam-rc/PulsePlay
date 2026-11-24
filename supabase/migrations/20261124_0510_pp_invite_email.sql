-- Invitation emails: daily cap per organisation (30), logged in the audit trail. Service role only (invite-email Edge Function).
-- Additive. Rollback: drop function public.pp_invite_email_take(uuid, uuid, text); drop function pp.invite_email_take(uuid, uuid, text);
create or replace function pp.invite_email_take(p_org uuid, p_actor uuid, p_email text) returns void language plpgsql security definer set search_path = pp as $$
begin
  if not exists(select 1 from org_members where org_id = p_org and user_id = p_actor and role in ('owner','admin')) then raise exception 'only owners and admins can send invitations'; end if;
  if not exists(select 1 from org_invites where org_id = p_org and email = lower(p_email) and accepted_at is null) then raise exception 'invite this address first'; end if;
  if (select count(*) from audit_events where org_id = p_org and action = 'member.invite_email' and at > now() - interval '1 day') >= 30 then
    raise exception 'Invitation email limit reached for today (30). Ask people to sign in directly.'; end if;
  insert into audit_events(actor, org_id, action, target) values (p_actor, p_org, 'member.invite_email', lower(p_email));
end $$;
revoke all on function pp.invite_email_take(uuid, uuid, text) from public, anon, authenticated;
create or replace function public.pp_invite_email_take(p_org uuid, p_actor uuid, p_email text) returns void language sql security definer set search_path = '' as $$ select pp.invite_email_take(p_org, p_actor, p_email) $$;
revoke all on function public.pp_invite_email_take(uuid, uuid, text) from public, anon, authenticated;
do $$ begin
  if exists(select 1 from pg_roles where rolname = 'service_role') then grant execute on function public.pp_invite_email_take(uuid, uuid, text) to service_role; end if;
end $$;
