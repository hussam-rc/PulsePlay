-- 3.0B (planned): scoring v2 version tagging. Runs on a clean local database (CI), never on production data.
create temp table t(name text, ok boolean, detail text);
grant all on t to anon, authenticated;

-- A v2 copy of ego-check: same content, scoring.version = 2.
do $$ declare base jsonb; eid uuid; begin
  select content into base from pp.experience_versions v join pp.experiences e on e.id = v.experience_id where e.slug = 'ego-check' order by version desc limit 1;
  insert into pp.experiences(slug, title, visibility, status, built_in) values ('ego-v2-test', 'Ego v2 test', 'public', 'published', false) returning id into eid;
  insert into pp.experience_versions(experience_id, version, content, schema_version)
    values (eid, 1, jsonb_set(base || '{"id":"ego-v2-test"}', '{scoring,version}', '2'), 1);
end $$;
create or replace function pg_temp.room(slug text) returns jsonb language plpgsql as $$
begin perform set_config('request.headers', json_build_object('x-real-ip', 'sv-' || gen_random_uuid())::text, true); return public.pp_create_session(slug, '{}'); end $$;
create or replace function pg_temp.sid(p_code text) returns uuid language sql security definer as $$ select id from pp.sessions where code = p_code $$;

set role anon;
do $$ declare c1 jsonb; c2 jsonb; begin
  c1 := pg_temp.room('ego-check'); c2 := pg_temp.room('ego-v2-test');
  insert into t values ('v1 game: state has no scoring version (unchanged presentation)', not (c1->'state'->'experience') ? 'scoring', c1->'state'->>'experience');
  insert into t values ('v2 game: state exposes scoring.version = 2 only', c2->'state'->'experience'->'scoring' = '{"version":2}'::jsonb, c2->'state'->'experience'->>'scoring');
  perform set_config('t.c1', c1->>'code', false); perform set_config('t.c2', c2->>'code', false);
end $$;
reset role;

-- Summaries carry the scoring model that produced them.
insert into pp.session_summaries(session_id, title, joined, completed) values (pg_temp.sid(current_setting('t.c1')), 'v1', 0, 0) on conflict (session_id) do nothing;
insert into pp.session_summaries(session_id, title, joined, completed) values (pg_temp.sid(current_setting('t.c2')), 'v2', 0, 0) on conflict (session_id) do nothing;
insert into t select 'summary of a v1 room is tagged scoring_version 1', scoring_version = 1, scoring_version::text from pp.session_summaries where session_id = pg_temp.sid(current_setting('t.c1'));
insert into t select 'summary of a v2 room is tagged scoring_version 2', scoring_version = 2, scoring_version::text from pp.session_summaries where session_id = pg_temp.sid(current_setting('t.c2'));
insert into t select 'existing summaries default to scoring_version 1', count(*) = 0, count(*)::text from pp.session_summaries where scoring_version is null;
insert into t select 'version tag is not settable by browsers', not has_function_privilege('anon', 'pp._summary_version()', 'execute'), null;

delete from pp.session_summaries where session_id in (pg_temp.sid(current_setting('t.c1')), pg_temp.sid(current_setting('t.c2')));
delete from pp.sessions where id in (pg_temp.sid(current_setting('t.c1')), pg_temp.sid(current_setting('t.c2')));
delete from pp.experiences where slug = 'ego-v2-test';
select case when ok then 'PASS' else 'FAIL' end || '  ' || name || coalesce('  [' || detail || ']', '') from t order by ok, name;
select count(*) filter (where ok) || ' passed, ' || count(*) filter (where not ok) || ' failed' from t;
