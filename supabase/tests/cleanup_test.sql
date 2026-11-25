-- Cleanup job: representative data, dry run, real run, idempotency, nothing unrelated touched.
create temp table t(name text, ok boolean, detail text);
grant all on t to anon, authenticated;
do $$ declare
  v uuid := (select v.id from pp.experience_versions v join pp.experiences e on e.id = v.experience_id where e.slug = 'would-you-rather' limit 1);
  snap jsonb := (select content from pp.experience_versions where id = v);
  s_active uuid; s_grace uuid; s_old uuid; s_busy uuid; p uuid; c jsonb; c2 jsonb;
  n_summ int; n_audit int; n_exp int; n_ver int;
begin
  -- 1 active room, 1 expired 30 min ago (inside the grace), 1 expired 3 days ago (idle), 1 expired but with a phase change 10 min ago
  insert into pp.sessions(code, version_id, snapshot, n_activities) values ('900001', v, snap, 10) returning id into s_active;
  insert into pp.sessions(code, version_id, snapshot, n_activities, created_at, expires_at, phase_started_at)
    values ('900002', v, snap, 10, now() - interval '24 hours 30 minutes', now() - interval '30 minutes', now() - interval '5 hours') returning id into s_grace;
  insert into pp.sessions(code, version_id, snapshot, n_activities, created_at, expires_at, phase_started_at)
    values ('900003', v, snap, 10, now() - interval '4 days', now() - interval '3 days', now() - interval '3 days') returning id into s_old;
  insert into pp.sessions(code, version_id, snapshot, n_activities, created_at, expires_at, phase_started_at)
    values ('900004', v, snap, 10, now() - interval '2 days', now() - interval '1 day', now() - interval '10 minutes') returning id into s_busy;
  insert into pp.session_secrets values (s_old, 'x'), (s_active, 'y');
  insert into pp.lobby(session_id, nickname) select s, 'n' || g from unnest(array[s_old, s_active]) s, generate_series(1, 3) g;
  for i in 1..3 loop
    insert into pp.players(session_id, token_hash) values (s_old, md5(random()::text)) returning id into p;
    insert into pp.responses(player_id, activity_id, value) values (p, 'w1', '"a"'), (p, 'w2', '"b"');
    insert into pp.players(session_id, token_hash) values (s_active, md5(random()::text)) returning id into p;
    insert into pp.responses(player_id, activity_id, value) values (p, 'w1', '"a"');
  end loop;
  insert into pp.rate_limits values ('ip:old', now() - interval '3 days', 5), ('ip:new', now() - interval '10 minutes', 1);
  select count(*) into n_summ from pp.session_summaries; select count(*) into n_audit from pp.audit_events;
  select count(*) into n_exp from pp.experiences; select count(*) into n_ver from pp.experience_versions;

  c := pp.cleanup(true);
  insert into t values ('dry run: counts only the idle expired room and its data',
    (c->>'sessions')::int = 1 and (c->>'lobby')::int = 3 and (c->>'players')::int = 3 and (c->>'responses')::int = 6 and (c->>'session_secrets')::int = 1, c::text);
  insert into t values ('dry run: old rate-limit windows counted', (c->>'rate_limits')::int >= 1, c->>'rate_limits');
  insert into t values ('dry run: deletes nothing', exists(select 1 from pp.sessions where id = s_old) and (select count(*) from pp.responses r join pp.players p on p.id = r.player_id where p.session_id = s_old) = 6, null);
  insert into t values ('dry run: logged', exists(select 1 from pp.cleanup_runs where dry_run and id = (c->>'run')::bigint and finished_at is not null), null);

  c := pp.cleanup(false);
  insert into t values ('real run: idle expired room and all its data removed',
    not exists(select 1 from pp.sessions where id = s_old) and not exists(select 1 from pp.players where session_id = s_old)
    and not exists(select 1 from pp.lobby where session_id = s_old) and not exists(select 1 from pp.session_secrets where session_id = s_old), c::text);
  insert into t values ('real run: active room untouched (3 players, 3 answers, secret)',
    (select count(*) from pp.players where session_id = s_active) = 3 and (select count(*) from pp.responses r join pp.players p on p.id = r.player_id where p.session_id = s_active) = 3
    and exists(select 1 from pp.session_secrets where session_id = s_active), null);
  insert into t values ('real run: room inside the 1 h grace kept', exists(select 1 from pp.sessions where id = s_grace), null);
  insert into t values ('real run: expired room with a recent phase change kept', exists(select 1 from pp.sessions where id = s_busy), null);
  insert into t values ('real run: recent rate-limit window kept, old removed', exists(select 1 from pp.rate_limits where key = 'ip:new') and not exists(select 1 from pp.rate_limits where key = 'ip:old'), null);
  insert into t values ('real run: summaries, audit, experiences, versions untouched',
    (select count(*) from pp.session_summaries) = n_summ and (select count(*) from pp.audit_events) = n_audit
    and (select count(*) from pp.experiences) = n_exp and (select count(*) from pp.experience_versions) = n_ver, null);

  c2 := pp.cleanup(false);
  insert into t values ('idempotent: second run deletes nothing', (c2->>'sessions')::int = 0 and (c2->>'responses')::int = 0 and (c2->>'rate_limits')::int = 0, c2::text);
  insert into t values ('monitoring: health view reports a recent real run', (select not stale and last_real_run is not null from pp.cleanup_health), null);
  begin perform pp.cleanup(false, 0); insert into t values ('input check: bad batch size rejected', false, null);
  exception when others then insert into t values ('input check: bad batch size rejected', sqlerrm like 'batch%', sqlerrm); end;
  insert into pp.sessions(code, version_id, snapshot, n_activities, created_at, expires_at, phase_started_at)
    select k, v, snap, 10, now() - interval '5 days', now() - interval '4 days', now() - interval '4 days' from unnest(array['900005', '900006']) k;
  c := pp.cleanup(true, 1);
  insert into t values ('batch limit respected', (c->>'sessions')::int = 1 and (c->>'batch_limited')::boolean, c->>'sessions');
  delete from pp.sessions where code like '9000__';
end $$;
-- Not callable from the public API
set role anon;
do $$ begin
  begin perform pp.cleanup(true); insert into t values ('security: anon cannot run cleanup', false, null);
  exception when others then insert into t values ('security: anon cannot run cleanup', true, sqlerrm); end;
end $$;
reset role;
set role authenticated;
do $$ begin
  begin perform pp.cleanup(true); insert into t values ('security: signed-in users cannot run cleanup', false, null);
  exception when others then insert into t values ('security: signed-in users cannot run cleanup', true, sqlerrm); end;
  begin perform 1 from pp.cleanup_runs; insert into t values ('security: run log not readable by users', false, null);
  exception when others then insert into t values ('security: run log not readable by users', true, sqlerrm); end;
end $$;
reset role;
select case when ok then 'PASS' else 'FAIL' end || '  ' || name || coalesce('  [' || left(detail, 120) || ']', '') from t order by ok, name;
select count(*) filter (where ok) || ' passed, ' || count(*) filter (where not ok) || ' failed' from t;
