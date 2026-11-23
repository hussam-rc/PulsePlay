-- Integration tests for the shared live engine. Run as superuser; switches to role anon for client calls.
-- Each check prints PASS/FAIL. Usage: psql -f supabase/tests/live_engine_test.sql
\set ON_ERROR_STOP 0
create temp table t(name text, ok boolean, detail text);
grant all on t to anon;
set role anon;

-- ===== 1. Ego Check: 6 players, private results, team average =====
do $$
declare c jsonb; code text; h text; toks text[] := '{}'; i int; q int; st jsonb; ids text[] := array['q1','q2','q3','q4','q5','q6','q7','q8','q9','q10']; me jsonb; r text;
begin
  c := public.pp_create_session('ego-check', '{"readSec":3,"answerSec":5}'); code := c->>'code'; h := c->>'hostToken';
  for i in 1..6 loop toks := toks || (public.pp_join(code, 'Ego'||i, '🦊', null, true)->>'token'); end loop;
  perform public.pp_host_command(code, h, 'next'); perform public.pp_host_command(code, h, 'next');
  for q in 0..9 loop
    st := public.pp_host_command(code, h, 'next');                         -- read -> answer
    if q = 0 then
      insert into t values ('ego: activity hides points', not (st->'activity')::text like '%points%', st->'activity'->>'id');
      insert into t values ('ego: host sees names', jsonb_array_length(st->'names') = 6, null);
    end if;
    for i in 1..6 loop r := public.pp_submit(toks[i], ids[q+1], to_jsonb(substr('abcd', ((i+q) % 4) + 1, 1))); end loop;
    if q = 0 then insert into t values ('ego: duplicate rejected', public.pp_submit(toks[1], 'q1', '"d"') = 'duplicate', null);
                  insert into t values ('ego: invalid option rejected', public.pp_submit(toks[1], 'q1', '"zz"') in ('invalid','duplicate'), null); end if;
    st := public.pp_host_command(code, h, 'next');                         -- everyone answered -> reveal
    if q = 0 then insert into t values ('ego: no distribution revealed (private game)', st->'reveal' is null, null);
                  insert into t values ('ego: answer after lock rejected', public.pp_submit(toks[2], 'q1', '"a"') in ('not_open','duplicate'), null); end if;
    perform public.pp_host_command(code, h, 'next');                       -- next question / results
  end loop;
  st := public.pp_state(code);
  insert into t values ('ego: results stage', st->>'stage' = 'results', st->>'stage');
  me := public.pp_my_state(toks[1]);
  insert into t values ('ego: private result score 43 for player 1', (me->'result'->>'score')::int = 43, me->'result'::text);
  insert into t values ('ego: my_state returns only my 10 answers', (select count(*) from jsonb_object_keys(me->'answers')) = 10, null);
  st := public.pp_host_command(code, h, 'next');                          -- group
  insert into t values ('ego: team average 37 (matches TS engine + legacy backend)', (st->'group'->>'average')::int = 37, st->'group'::text);
  insert into t values ('ego: no leaderboard ever', st->'leaderboard' is null, null);
  insert into t values ('ego: group result has no names', not (st->'group')::text like '%Ego%', null);
  perform public.pp_host_command(code, h, 'next'); perform public.pp_host_command(code, h, 'end');
  insert into t values ('ego: state after end', (public.pp_state(code)->>'ended')::boolean, null);
  insert into t values ('ego: token dead after end', public.pp_my_state(toks[1]) is null, null);
end $$;

-- ===== 2. Would You Rather: anonymous distribution, suppression below 3 =====
do $$
declare c jsonb; code text; h text; toks text[] := '{}'; i int; q int; st jsonb;
begin
  c := public.pp_create_session('would-you-rather', '{}'); code := c->>'code'; h := c->>'hostToken';
  for i in 1..4 loop toks := toks || (public.pp_join(code, 'W'||i, null, 'ShouldBeIgnored', true)->>'token'); end loop;
  perform public.pp_host_command(code, h, 'next'); perform public.pp_host_command(code, h, 'next');
  for q in 1..10 loop
    perform public.pp_host_command(code, h, 'next');
    for i in 1..4 loop perform public.pp_submit(toks[i], 'w'||q, to_jsonb(case when i <= 3 then 'a' else 'b' end)); end loop;
    st := public.pp_host_command(code, h, 'next');
    if q = 1 then insert into t values ('wyr: distribution a=3 b=1', (st->'reveal'->'distribution'->'counts'->>'a')::int = 3 and (st->'reveal'->'distribution'->'counts'->>'b')::int = 1, st->'reveal'::text); end if;
    perform public.pp_host_command(code, h, 'next');
  end loop;
  st := public.pp_host_command(code, h, 'next');
  insert into t values ('wyr: aggregate game skips group score', st->>'stage' = 'closing' and st->'group' is null, st->>'stage');
  insert into t values ('wyr: leaderboard name ignored when leaderboard off', (public.pp_my_state(toks[1])->>'boardName') is null, null);
  perform public.pp_host_command(code, h, 'end');
  -- suppression: only 2 players
  c := public.pp_create_session('would-you-rather', '{}'); code := c->>'code'; h := c->>'hostToken'; toks := '{}';
  for i in 1..2 loop toks := toks || (public.pp_join(code, 'S'||i, null, null, true)->>'token'); end loop;
  perform public.pp_host_command(code, h, 'next'); perform public.pp_host_command(code, h, 'next'); perform public.pp_host_command(code, h, 'next');
  for i in 1..2 loop perform public.pp_submit(toks[i], 'w1', '"a"'); end loop;
  st := public.pp_host_command(code, h, 'next');
  insert into t values ('wyr: distribution suppressed below 3 answers', (st->'reveal'->'distribution'->>'suppressed')::boolean and st->'reveal'->'distribution'->'counts' = '{}'::jsonb, st->'reveal'::text);
  perform public.pp_host_command(code, h, 'end');
end $$;

-- ===== 3. Myth or Fact: personal scores, reveal, opt-in leaderboard =====
do $$
declare c jsonb; code text; h text; toks text[] := '{}'; i int; q int; st jsonb; right_ans text[] := array['myth','myth','myth','myth','fact','myth','myth','fact','fact','myth'];
begin
  c := public.pp_create_session('myth-or-fact', '{"leaderboard": true}'); code := c->>'code'; h := c->>'hostToken';
  toks := toks || (public.pp_join(code, 'Ana', '🦉', 'Ana', true)->>'token');      -- opted in
  toks := toks || (public.pp_join(code, 'Ben', '🐢', 'Ben', true)->>'token');      -- opted in
  toks := toks || (public.pp_join(code, 'Cai', '🐼', null, true)->>'token');       -- not opted in
  perform public.pp_host_command(code, h, 'next'); perform public.pp_host_command(code, h, 'next');
  for q in 1..10 loop
    st := public.pp_host_command(code, h, 'next');
    if q = 1 then insert into t values ('trivia: correct answer hidden while answering', not (st->'activity')::text like '%correct%' and st->'reveal' is null, st->'activity'::text); end if;
    perform public.pp_submit(toks[1], 'm'||q, to_jsonb(right_ans[q]));                                            -- Ana 10/10
    perform public.pp_submit(toks[2], 'm'||q, to_jsonb(case when q <= 6 then right_ans[q] else 'x' end));         -- Ben: 6 valid + 4 invalid
    if q <= 6 then perform public.pp_submit(toks[2], 'm'||q, to_jsonb(right_ans[q])); end if;
    perform public.pp_submit(toks[3], 'm'||q, to_jsonb(case when right_ans[q] = 'myth' then 'fact' else 'myth' end)); -- Cai 0/10
    if q > 6 then perform public.pp_submit(toks[2], 'm'||q, to_jsonb(case when right_ans[q] = 'myth' then 'fact' else 'myth' end)); end if;
    st := public.pp_host_command(code, h, 'next');
    if q = 1 then insert into t values ('trivia: reveal shows correct + explanation', st->'reveal'->>'correct' = 'myth' and st->'reveal'->>'explanation' like 'Experiments%', st->'reveal'::text); end if;
    perform public.pp_host_command(code, h, 'next');
  end loop;
  insert into t values ('trivia: Ana private score 10 correct', (public.pp_my_state(toks[1])->'result'->>'correct')::int = 10, null);
  insert into t values ('trivia: Ben 6 correct', (public.pp_my_state(toks[2])->'result'->>'correct')::int = 6, public.pp_my_state(toks[2])->'result'::text);
  st := public.pp_state(code);
  insert into t values ('trivia: leaderboard only opt-ins, ordered', st->'leaderboard' = '[{"name":"Ana","correct":10},{"name":"Ben","correct":6}]'::jsonb, st->'leaderboard'::text);
  insert into t values ('trivia: non-opted player absent from leaderboard', not (st->'leaderboard')::text like '%Cai%', null);
  st := public.pp_host_command(code, h, 'next');
  insert into t values ('trivia: group average 53 (avg of 100,60,0)', (st->'group'->>'average')::int = 53, st->'group'::text);
  perform public.pp_host_command(code, h, 'end');
end $$;

-- ===== 4. Security & lifecycle =====
do $$
declare c jsonb; code text; h text; tok text; ok boolean; st jsonb;
begin
  begin perform public.pp_create_session('ego-check', '{"leaderboard": true}'); ok := false; exception when others then ok := sqlerrm like 'leaderboards are only%'; end;
  insert into t values ('sec: leaderboard refused for Ego Check', ok, null);
  c := public.pp_create_session('ego-check', '{}'); code := c->>'code'; h := c->>'hostToken';
  tok := public.pp_join(code, 'P', null, null, true)->>'token';
  begin perform public.pp_host_command(code, tok, 'next'); ok := false; exception when others then ok := sqlerrm = 'not host'; end;
  insert into t values ('sec: participant token cannot run host commands', ok, null);
  begin perform public.pp_host_state(code, 'guess'); ok := false; exception when others then ok := sqlerrm = 'not host'; end;
  insert into t values ('sec: host state needs host token', ok, null);
  insert into t values ('sec: public state has no names', public.pp_state(code)->'names' is null, null);
  insert into t values ('sec: random token sees nothing', public.pp_my_state('random') is null, null);
  begin perform public.pp_join(code, 'NoConsent', null, null, false); ok := false; exception when others then ok := sqlerrm like 'please confirm%'; end;
  insert into t values ('sec: join requires consent', ok, null);
  begin perform public.pp_create_session('not-a-game', '{}'); ok := false; exception when others then ok := sqlerrm = 'experience not found'; end;
  insert into t values ('sec: unknown experience refused', ok, null);
  -- pause/resume
  perform public.pp_host_command(code, h, 'next'); perform public.pp_host_command(code, h, 'next'); perform public.pp_host_command(code, h, 'next');
  st := public.pp_host_command(code, h, 'pause');
  insert into t values ('life: pause', (st->>'paused')::boolean and public.pp_submit(tok, 'q1', '"a"') = 'not_open', null);
  st := public.pp_host_command(code, h, 'resume');
  insert into t values ('life: resume', not coalesce((st->>'paused')::boolean, false) and public.pp_submit(tok, 'q1', '"a"') = 'ok', null);
  perform set_config('test.code', code, false); perform set_config('test.tok', tok, false); perform set_config('test.h', h, false);
end $$;
do $$ begin
  begin perform 1 from pp.sessions; insert into t values ('sec: anon cannot read pp tables', false, null);
  exception when others then insert into t values ('sec: anon cannot read pp tables', true, sqlerrm); end;
end $$;
reset role;
-- simulate time passing: move the current question's deadline into the past (server clock decides)
update pp.sessions set phase = 'read', phase_started_at = now() - interval '20 seconds', deadline = null where code = current_setting('test.code');
set role anon;
do $$ declare st jsonb; begin
  st := public.pp_state(current_setting('test.code'));
  insert into t values ('clock: read+answer windows elapsed -> server moved to reveal without the host', st->>'phase' = 'reveal', st->>'phase');
  insert into t values ('clock: late answer refused', public.pp_submit(current_setting('test.tok'), 'q2', '"a"') = 'not_open', null);
end $$;
do $$ declare st jsonb; begin
  perform public.pp_host_command(current_setting('test.code'), current_setting('test.h'), 'next');  -- q2 read
  perform public.pp_host_command(current_setting('test.code'), current_setting('test.h'), 'next');  -- q2 answer
end $$;
reset role;
update pp.sessions set deadline = now() - interval '1 second' where code = current_setting('test.code');
set role anon;
do $$ begin insert into t values ('clock: submit after deadline refused', public.pp_submit(current_setting('test.tok'), 'q2', '"a"') in ('late','not_open'), null); end $$;
do $$ begin perform public.pp_host_command(current_setting('test.code'), current_setting('test.h'), 'end'); end $$;
reset role;
insert into t select 'life: summary kept without names', count(*) >= 4 and bool_and(not per_activity::text like '%Ana%'), count(*)::text from pp.session_summaries;
insert into t select 'life: no players/responses left after end', (select count(*) from pp.players) = 0 and (select count(*) from pp.responses) = 0, null;
select case when ok then 'PASS' else 'FAIL' end || '  ' || name || coalesce('  [' || left(detail, 160) || ']', '') from t order by ok, name;
select count(*) filter (where ok) || ' passed, ' || count(*) filter (where not ok) || ' failed' from t;
