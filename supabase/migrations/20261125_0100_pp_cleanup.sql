-- Scheduled cleanup of expired rooms and temporary data. See docs/CLEANUP.md.
-- This file creates the function, the run log and a health view only. It does NOT schedule anything:
-- scheduling is in 20261125_0110_pp_cleanup_schedule.sql and needs explicit approval for production.
-- Rollback: drop function pp.cleanup(boolean, int); drop view pp.cleanup_health; drop table pp.cleanup_runs;

create table if not exists pp.cleanup_runs (
  id          bigint generated always as identity primary key,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  dry_run     boolean not null,
  counts      jsonb not null default '{}',
  error       text
);
alter table pp.cleanup_runs enable row level security;   -- no policies: not reachable through the API
revoke all on pp.cleanup_runs from public, anon, authenticated;

create or replace function pp.cleanup(p_dry_run boolean default true, p_batch int default 5000)
returns jsonb language plpgsql security definer set search_path = pp as $$
declare
  -- Retention (also documented in docs/CLEANUP.md):
  grace   constant interval := interval '1 hour';  -- extra margin after a room's own 24 h expiry
  idle    constant interval := interval '2 hours'; -- never touch a room whose phase changed recently
  rl_keep constant interval := interval '1 day';   -- rate-limit windows are at most 1 hour long
  ai_keep constant interval := interval '2 days';  -- AI quota counts the last 24 h
  log_keep constant interval := interval '90 days';
  run_id bigint; ids uuid[]; c jsonb;
begin
  if p_batch < 1 or p_batch > 50000 then raise exception 'batch must be 1..50000'; end if;
  -- One run at a time; a second concurrent call returns immediately (idempotent, no double work).
  if not pg_try_advisory_xact_lock(hashtext('pp.cleanup')) then
    return jsonb_build_object('skipped', 'another cleanup is running');
  end if;
  insert into cleanup_runs(dry_run) values (p_dry_run) returning id into run_id;

  -- Expired AND idle rooms only. Active rooms (not expired, or with a recent phase change) are never selected.
  select coalesce(array_agg(id), '{}') into ids from (
    select id from sessions
    where expires_at < now() - grace and phase_started_at < now() - idle
    order by expires_at limit p_batch) x;

  c := jsonb_build_object(
    'sessions',        cardinality(ids),
    'session_secrets', (select count(*) from session_secrets where session_id = any(ids)),
    'lobby',           (select count(*) from lobby where session_id = any(ids)),
    'players',         (select count(*) from players where session_id = any(ids)),
    'responses',       (select count(*) from responses r join players p on p.id = r.player_id where p.session_id = any(ids)),
    'rate_limits',     (select count(*) from rate_limits where window_start < now() - rl_keep),
    'ai_requests',     (select count(*) from ai_requests where at < now() - ai_keep),
    'cleanup_runs',    (select count(*) from cleanup_runs where started_at < now() - log_keep),
    'active_sessions_kept', (select count(*) from sessions where expires_at > now()),
    'batch_limited',   cardinality(ids) = p_batch);

  if not p_dry_run then
    -- Children first, explicitly, so nothing depends on cascades and nothing outside these rooms is touched.
    delete from responses r using players p where r.player_id = p.id and p.session_id = any(ids);
    delete from players where session_id = any(ids);
    delete from lobby where session_id = any(ids);
    delete from session_secrets where session_id = any(ids);
    delete from sessions where id = any(ids) and expires_at < now() - grace;  -- re-checked at delete time
    delete from rate_limits where window_start < now() - rl_keep;
    delete from ai_requests where at < now() - ai_keep;
    delete from cleanup_runs where started_at < now() - log_keep and id <> run_id;
  end if;

  update cleanup_runs set finished_at = now(), counts = c where id = run_id;
  raise log 'pp.cleanup run=% dry_run=% counts=%', run_id, p_dry_run, c;
  return c || jsonb_build_object('run', run_id, 'dry_run', p_dry_run);
exception when others then
  -- The whole run is rolled back (nothing deleted, no run row); cleanup_health.stale then turns true.
  raise log 'pp.cleanup failed: %', sqlerrm;
  raise;
end $$;
revoke all on function pp.cleanup(boolean, int) from public, anon, authenticated;

-- Monitoring: one row, readable by the database owner / dashboard only.
create or replace view pp.cleanup_health as
select
  (select max(finished_at) from pp.cleanup_runs where not dry_run) as last_real_run,
  (select counts from pp.cleanup_runs where not dry_run and finished_at is not null order by id desc limit 1) as last_counts,
  (select count(*) from pp.sessions where expires_at < now() - interval '2 days') as overdue_sessions,
  coalesce((select max(finished_at) from pp.cleanup_runs where not dry_run) < now() - interval '36 hours', true) as stale;
revoke all on pp.cleanup_health from public, anon, authenticated;
