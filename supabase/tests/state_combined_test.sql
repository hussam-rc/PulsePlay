-- pp._state must carry both the scoring v2 version (inert unless the snapshot has scoring.version) and Open Answer data.
-- Guards the integration of PR #12 (scoring v2) and PR #17 (Open Answer), which both redefine pp._state.
create temp table t(name text, ok boolean, detail text);
grant all on t to anon, authenticated;
do $$ declare base jsonb; eid uuid; begin
  select content into base from pp.experience_versions v join pp.experiences e on e.id = v.experience_id where e.slug = 'ego-check' order by version desc limit 1;
  insert into pp.experiences(slug, title, visibility, status, built_in) values ('state-combined', 'State combined', 'public', 'published', false) returning id into eid;
  insert into pp.experience_versions(experience_id, version, content, schema_version) values (eid, 1, (base - 'insights' - 'bank') || jsonb_build_object('id', 'state-combined',
    'scoring', (base->'scoring') || '{"version": 2}'::jsonb,
    'rounds', jsonb_build_array(jsonb_build_object('id', 'main', 'activities', jsonb_build_array(
      jsonb_build_object('id', 'w1', 'type', 'open', 'prompt', 'One word', 'display', 'cloud', 'maxChars', 25, 'maxResponses', 1, 'submitSec', 0, 'editSec', 0,
        'moderation', 'live', 'showAnswers', 'live'))))), 1);
end $$;
set role anon;
do $$ declare c jsonb; code text; h text; tok text; hs jsonb; begin
  perform set_config('request.headers', json_build_object('x-real-ip', 'sc-' || gen_random_uuid())::text, true);
  c := public.pp_create_session('state-combined', '{}'); code := c->>'code'; h := c->>'hostToken';
  tok := public.pp_join(code, 'A', '🦊', null, true)->>'token';
  perform public.pp_host_command(code, h, 'next'); perform public.pp_host_command(code, h, 'next'); perform public.pp_host_command(code, h, 'next');
  perform public.pp_open_submit(tok, 'w1', 'Calm');
  hs := public.pp_host_state(code, h);
  insert into t values ('_state: scoring v2 version exposed', hs->'experience'->'scoring'->>'version' = '2', hs->'experience'->>'scoring');
  insert into t values ('_state: open answer view present', (hs->'open'->>'shown')::int = 1, hs->>'open');
  insert into t values ('_state: public view has open counts but no texts', (public.pp_state(code)->'open') ? 'n' and public.pp_state(code)::text not like '%Calm%', null);
  perform public.pp_host_command(code, h, 'end');
end $$;
reset role;
delete from pp.session_summaries where title = 'State combined'; delete from pp.experiences where slug = 'state-combined';
select case when ok then 'PASS' else 'FAIL' end || '  ' || name || coalesce('  [' || detail || ']', '') from t order by ok, name;
select count(*) filter (where ok) || ' passed, ' || count(*) filter (where not ok) || ' failed' from t;
