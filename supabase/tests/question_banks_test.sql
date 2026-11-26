-- Release 3.0A: server-side question selection. Runs on a clean local database (CI), never on production data.
create temp table t(name text, ok boolean, detail text);
grant all on t to anon, authenticated;

-- Test banks, built from the ego-check content: `dims` dimensions x `per` questions, options a..d worth 0..3 points.
create or replace function pg_temp.mkbank(p_slug text, dims int, per int, bank jsonb, tweak text default '') returns uuid language plpgsql as $$
declare base jsonb; acts jsonb; eid uuid;
begin
  select content into base from pp.experience_versions v join pp.experiences e on e.id = v.experience_id where e.slug = 'ego-check' order by version desc limit 1;
  select jsonb_agg(jsonb_build_object('id', 'q' || i, 'type', 'choice', 'prompt', 'Question ' || i, 'shuffle', true,
           'dimension', 'd' || (((i - 1) / per) + 1), 'category', 'c' || (((i - 1) % 3) + 1),
           'options', '[{"id":"a","text":"A","points":0},{"id":"b","text":"B","points":1},{"id":"c","text":"C","points":2},{"id":"d","text":"D","points":3}]'::jsonb)
         || case when tweak = 'required3' and i <= 3 then '{"required": true}'::jsonb
                 when tweak = 'archive2' and i = 1 then '{"active": false}'::jsonb
                 when tweak = 'archive2' and i = 2 then '{"random": false}'::jsonb else '{}'::jsonb end
         order by i) into acts from generate_series(1, dims * per) i;
  insert into pp.experiences(slug, title, visibility, status, built_in) values (p_slug, 'Bank ' || p_slug, 'public', 'published', false) returning id into eid;
  insert into pp.experience_versions(experience_id, version, content, schema_version)
    values (eid, 1, (base - 'insights') || jsonb_build_object('id', p_slug, 'rounds', jsonb_build_array(jsonb_build_object('id', 'main', 'activities', acts)))
                     || case when bank is null then '{}'::jsonb else jsonb_build_object('bank', bank) end, 1);
  return eid;
end $$;

select pg_temp.mkbank('bank60', 6, 10, '{"strategy":"dimension","lengths":[10,15,20],"defaultLength":10}');
select pg_temp.mkbank('bank12', 3, 4, '{"strategy":"dimension","lengths":[10,15,20]}');
select pg_temp.mkbank('cat60', 6, 10, '{"strategy":"category","lengths":[10,15,20]}');
select pg_temp.mkbank('rand20', 2, 10, '{"strategy":"random","lengths":[10]}');
select pg_temp.mkbank('req60', 6, 10, '{"strategy":"dimension","lengths":[10,15,20]}', 'required3');
select pg_temp.mkbank('arch12', 2, 6, '{"strategy":"random","lengths":[10]}', 'archive2');
select pg_temp.mkbank('nobank12', 3, 4, null);

create or replace function pg_temp.content(slug text) returns jsonb language sql security definer as $$
  select content from pp.experience_versions v join pp.experiences e on e.id = v.experience_id where e.slug = $1 order by version desc limit 1 $$;
create or replace function pg_temp.acts(p_code text) returns table(i int, a jsonb) language sql security definer as $$
  select * from pp._activities((select snapshot from pp.sessions where sessions.code = p_code)) $$;
create or replace function pg_temp.lens(p_code text) returns int[] language sql security definer as $$
  select pp._bank_lengths((select snapshot - 'selection' from pp.sessions where sessions.code = p_code), 'fixed') $$;
create or replace function pg_temp.ids(s jsonb) returns text[] language sql as $$ select array(select jsonb_array_elements_text(s->'ids')) $$;
create or replace function pg_temp.snap(p_code text) returns jsonb language sql security definer as $$ select snapshot from pp.sessions where sessions.code = p_code $$;
create or replace function pg_temp.nact(p_code text) returns int language sql security definer as $$ select n_activities from pp.sessions where sessions.code = p_code $$;
create or replace function pg_temp.expire(p_code text) returns void language sql security definer as $$ update pp.sessions set deadline = now() - interval '1 second' where sessions.code = p_code $$;
create or replace function pg_temp.tamper(p_code text) returns void language sql security definer as $$ update pp.sessions set snapshot = snapshot || '{"title":"x"}' where sessions.code = p_code $$;
-- each room gets its own simulated client address so the suite stays under the per-address room limit
create or replace function pg_temp.room(slug text, settings jsonb) returns jsonb language plpgsql as $$
begin perform set_config('request.headers', json_build_object('x-real-ip', 'qb-' || gen_random_uuid())::text, true); return public.pp_create_session(slug, settings); end $$;
create or replace function pg_temp.hroom(slug text, settings jsonb, u uuid) returns jsonb language plpgsql as $$
begin perform set_config('request.headers', json_build_object('x-real-ip', 'qb-' || gen_random_uuid())::text, true); return pp.create_session(slug, settings, u); end $$;
create or replace function pg_temp.spread(p_code text) returns int language sql security definer as $$
  select max(n) - min(n) from (select a->>'dimension' d, count(*) n from pg_temp.acts(p_code) x(i, a) group by 1) q $$;
create or replace function pg_temp.ndims(p_code text) returns int language sql security definer as $$
  select count(distinct a->>'dimension')::int from pg_temp.acts(p_code) x(i, a) $$;

-- ---------- As an anonymous host (public games) ----------
set role anon;
do $$ declare c jsonb; code text; s jsonb; orig jsonb; ok boolean; msg text; a text[]; b text[]; x text[]; st jsonb; h text; i int; prev text[]; n int; sp int; nd int; begin
  -- Existing game, no bank: default plays every question in authored order (previous behaviour).
  c := pg_temp.room('ego-check', '{}'); code := c->>'code'; s := pg_temp.snap(code);
  orig := pg_temp.content('ego-check');
  insert into t values ('existing game: default is all 10 questions, authored order, content otherwise identical',
    (c->'selection'->>'count')::int = 10 and c->'selection'->>'strategy' = 'fixed' and (s - 'selection') = orig, c->>'selection');
  insert into t values ('existing game: lobby state shows the selection summary without question ids',
    c->'state'->'selection' = '{"strategy":"fixed","count":10,"bankSize":10}'::jsonb and (c->'state'->'selection') ? 'ids' = false, (c->'state'->>'selection'));
  st := public.pp_state(code);
  insert into t values ('public state never exposes the selected ids or the snapshot before results', st::text not like '%"ids"%' and not st ? 'snapshot', null);
  perform public.pp_host_command(code, c->>'hostToken', 'end');

  -- Invalid lengths and strategies are refused (no padding, no client-chosen strategies).
  begin perform pg_temp.room('ego-check', '{"questions":15}'); ok := false; exception when others then ok := sqlerrm like 'questions must be one of 10%'; msg := sqlerrm; end;
  insert into t values ('existing 10-question game: 15 questions refused, never padded', ok, msg);
  begin perform pg_temp.room('ego-check', '{"questions":"7; drop"}'); ok := false; exception when others then ok := sqlerrm like 'questions must be one of%'; msg := sqlerrm; end;
  insert into t values ('invalid question count refused', ok, msg);
  begin perform pg_temp.room('ego-check', '{"selection":"dimension"}'); ok := false; exception when others then ok := sqlerrm like 'selection must be one of fixed, random%'; msg := sqlerrm; end;
  insert into t values ('strategy the game does not support refused', ok, msg);
  begin perform pg_temp.room('bank12', '{"questions":15}'); ok := false; exception when others then ok := sqlerrm = 'questions must be one of 10'; msg := sqlerrm; end;
  insert into t values ('12 eligible questions: only 10 offered, 15 refused', ok, msg);
  c := pg_temp.room('nobank12', '{}');
  insert into t values ('12-question game without a bank: default all 12; 10 also allowed', (c->'selection'->>'count')::int = 12
    and pg_temp.lens(c->>'code') = array[10, 12], c->>'selection');
  perform public.pp_host_command(c->>'code', c->>'hostToken', 'end');

  -- 10 / 15 / 20 from a 60-question bank: right count, no duplicates, all six dimensions, balanced.
  foreach n in array array[10, 15, 20] loop
    ok := true;
    for i in 1..8 loop
      c := pg_temp.room('bank60', jsonb_build_object('questions', n)); code := c->>'code';
      a := pg_temp.ids(c->'selection'); sp := pg_temp.spread(code); nd := pg_temp.ndims(code);
      ok := ok and cardinality(a) = n and (select count(distinct v) from unnest(a) v) = n and nd = 6 and sp <= 1
               and pg_temp.nact(code) = n;
      perform public.pp_host_command(code, c->>'hostToken', 'end');
    end loop;
    insert into t values (format('bank of 60: %s questions, distinct, all 6 dimensions within 1 of each other (8 rooms)', n), ok, format('spread %s dims %s', sp, nd));
  end loop;
  c := pg_temp.room('bank60', '{}');
  insert into t values ('bank default length is 10', (c->'selection'->>'count')::int = 10 and (c->'selection'->>'bankSize')::int = 60, c->>'selection');
  insert into t values ('balanced play order alternates dimensions', not exists(
    select 1 from pg_temp.acts(c->>'code') x(i, a) join pg_temp.acts(c->>'code') y(i, a) on y.i = x.i + 1 where x.a->>'dimension' = y.a->>'dimension'), null);
  perform public.pp_host_command(c->>'code', c->>'hostToken', 'end');
  c := pg_temp.room('cat60', '{"questions":15}');
  insert into t values ('balanced by category: 5 / 5 / 5', (select array_agg(q.cnt order by q.cnt) from (select count(*)::int cnt from pg_temp.acts(c->>'code') x(i, a) group by x.a->>'category') q) = array[5,5,5], null);
  perform public.pp_host_command(c->>'code', c->>'hostToken', 'end');
  c := pg_temp.room('req60', '{"questions":10}'); a := pg_temp.ids(c->'selection');
  insert into t values ('required questions are always included, balance kept', a @> array['q1','q2','q3'] and pg_temp.ndims(c->>'code') = 6, array_to_string(a, ','));
  perform public.pp_host_command(c->>'code', c->>'hostToken', 'end');
  c := pg_temp.room('arch12', '{}'); a := pg_temp.ids(c->'selection');
  insert into t values ('archived and fixed-only questions are never picked at random', not a && array['q1','q2'] and cardinality(a) = 10, array_to_string(a, ','));
  perform public.pp_host_command(c->>'code', c->>'hostToken', 'end');
  c := pg_temp.room('bank60', '{"questions":15,"selection":"fixed"}'); a := pg_temp.ids(c->'selection');
  insert into t values ('host can choose the fixed order: first 15 authored questions', a = array(select 'q' || g from generate_series(1, 15) g), null);
  perform public.pp_host_command(c->>'code', c->>'hostToken', 'end');

  -- Recent-question avoidance for anonymous hosts: a hint from the host's own browser, nothing about participants.
  c := pg_temp.room('bank60', '{"questions":20}'); a := pg_temp.ids(c->'selection'); perform public.pp_host_command(c->>'code', c->>'hostToken', 'end');
  c := pg_temp.room('bank60', jsonb_build_object('questions', 20, 'recent', jsonb_build_array(to_jsonb(a)))); b := pg_temp.ids(c->'selection');
  perform public.pp_host_command(c->>'code', c->>'hostToken', 'end');
  insert into t values ('recent questions avoided: second 20 share none with the first 20', not a && b, null);
  c := pg_temp.room('bank60', jsonb_build_object('questions', 20, 'recent', jsonb_build_array(to_jsonb(b), to_jsonb(a)))); x := pg_temp.ids(c->'selection');
  perform public.pp_host_command(c->>'code', c->>'hostToken', 'end');
  insert into t values ('third game: nothing from the most recent game', not x && b, null);
  c := pg_temp.room('bank60', '{"questions":10,"recent":[["q1","bad id!", 5, {"x":1}], "junk"]}');
  insert into t values ('malformed recent hints are ignored, never an error', (c->'selection'->>'count')::int = 10, null);
  perform public.pp_host_command(c->>'code', c->>'hostToken', 'end');
  -- Exhausted bank: 20 questions, games of 10.
  c := pg_temp.room('rand20', '{}'); a := pg_temp.ids(c->'selection'); perform public.pp_host_command(c->>'code', c->>'hostToken', 'end');
  c := pg_temp.room('rand20', jsonb_build_object('recent', jsonb_build_array(to_jsonb(a)))); b := pg_temp.ids(c->'selection'); perform public.pp_host_command(c->>'code', c->>'hostToken', 'end');
  c := pg_temp.room('rand20', jsonb_build_object('recent', jsonb_build_array(to_jsonb(b), to_jsonb(a)))); x := pg_temp.ids(c->'selection'); perform public.pp_host_command(c->>'code', c->>'hostToken', 'end');
  insert into t values ('exhausted bank: reuses the least recently used questions', not a && b and (select array_agg(v order by v) from unnest(x) v) = (select array_agg(v order by v) from unnest(a) v), null);

  -- Locked once created: starts (even repeated) never change the questions; everyone gets the same set; reconnects resume it.
  c := pg_temp.room('bank60', '{"questions":15}'); code := c->>'code'; h := c->>'hostToken'; a := pg_temp.ids(c->'selection'); s := pg_temp.snap(code);
  perform public.pp_join(code, 'P' || g, null, null, true) from generate_series(1, 5) g;
  perform public.pp_host_command(code, h, 'next'); perform public.pp_host_command(code, h, 'next');
  insert into t values ('repeated start presses never change the selection', pg_temp.snap(code) = s, null);
  prev := '{}';
  for i in 0..14 loop
    st := public.pp_state(code); prev := prev || (st->'activity'->>'id');
    insert into t select 'reconnect: a fresh state call shows the same question', public.pp_state(code)->'activity'->>'id' = st->'activity'->>'id', null where i = 7;
    perform public.pp_host_command(code, h, 'next');                                   -- read -> answer
    perform pg_temp.expire(code);                                                     -- nobody answers: the deadline closes the question
    perform public.pp_state(code);                                                    -- tick: answer -> reveal
    perform public.pp_host_command(code, h, 'next');                                   -- reveal -> next question
  end loop;
  insert into t values ('every participant plays exactly the selected questions, in the locked order', prev = a, array_to_string(prev, ','));
  begin perform pg_temp.tamper(code); ok := false; exception when others then ok := sqlerrm like '%locked%'; msg := sqlerrm; end;
  insert into t values ('snapshot cannot be changed after creation (even by the server)', ok, msg);
  perform public.pp_host_command(code, h, 'end');
end $$;
reset role;

-- Content updates never reach a running room.
do $$ declare c jsonb; code text; eid uuid; before text; begin
  c := pg_temp.room('bank60', '{"questions":10}'); code := c->>'code';
  perform public.pp_host_command(code, c->>'hostToken', 'next'); perform public.pp_host_command(code, c->>'hostToken', 'next');
  before := public.pp_state(code)->'activity'->>'prompt';
  select id into eid from pp.experiences where slug = 'bank60';
  insert into pp.experience_versions(experience_id, version, content, schema_version)
    select eid, 2, jsonb_set(content, '{rounds,0,activities}', (select jsonb_agg(a || '{"prompt":"CHANGED"}') from jsonb_array_elements(content->'rounds'->0->'activities') a)), 1
    from pp.experience_versions where experience_id = eid and version = 1;
  insert into t values ('a new bank version does not affect a running room', public.pp_state(code)->'activity'->>'prompt' = before and before <> 'CHANGED', before);
  perform public.pp_host_command(code, c->>'hostToken', 'end');
  c := pg_temp.room('bank60', '{"questions":10}');
  insert into t values ('the next room uses the new version', (select a->>'prompt' from pg_temp.acts(c->>'code') x(i, a) limit 1) = 'CHANGED', null);
  perform public.pp_host_command(c->>'code', c->>'hostToken', 'end');
end $$;

-- Scoring is unchanged and covers exactly the played questions (15 of 60).
set role anon;
do $$ declare c jsonb; code text; h text; toks text[] := '{}'; tok text; i int; st jsonb; aid text; opt text; begin
  c := pg_temp.room('bank60', '{"questions":15}'); code := c->>'code'; h := c->>'hostToken';
  for i in 1..6 loop toks := toks || (public.pp_join(code, 'S' || i, null, null, true)->>'token'); end loop;
  perform public.pp_host_command(code, h, 'next'); perform public.pp_host_command(code, h, 'next');
  for i in 0..14 loop
    perform public.pp_host_command(code, h, 'next');                                   -- answer phase
    st := public.pp_state(code); aid := st->'activity'->>'id';
    foreach tok in array toks loop
      opt := case when tok = toks[1] then 'a' else 'd' end;                            -- one player all 0 points, five all 3
      perform public.pp_submit(tok, aid, to_jsonb(opt));
    end loop;
    perform public.pp_host_command(code, h, 'next'); perform public.pp_host_command(code, h, 'next');
  end loop;
  perform public.pp_host_command(code, h, 'next'); perform public.pp_host_command(code, h, 'next');
  st := public.pp_state(code);
  insert into t values ('group average over the 15 played questions: (0 + 5 x 100) / 6 = 83', (st->'group'->>'average')::int = 83 and (st->'group'->>'valid')::int = 6, st->>'group');
  perform public.pp_host_command(code, h, 'end');
end $$;
reset role;

-- Signed-in hosts: recent selections kept server-side, per host and game, capped; nobody else can read them.
do $$ declare u uuid := gen_random_uuid(); c jsonb; a text[]; b text[]; n int; ok boolean; i int; begin
  c := pg_temp.hroom('bank60', '{"questions":20}', u); a := pg_temp.ids(c->'selection'); perform public.pp_host_command(c->>'code', c->>'hostToken', 'end');
  c := pg_temp.hroom('bank60', '{"questions":20}', u); b := pg_temp.ids(c->'selection'); perform public.pp_host_command(c->>'code', c->>'hostToken', 'end');
  insert into t values ('signed-in host: next game avoids their recent questions automatically', not a && b, null);
  for i in 1..12 loop c := pg_temp.hroom('bank60', '{"questions":10}', u); perform public.pp_host_command(c->>'code', c->>'hostToken', 'end'); end loop;
  select count(*) into n from pp.selection_history where host_user = u;
  insert into t values ('history keeps at most 10 recent games per host and game', n = 10, n::text);
  c := pg_temp.hroom('bank60', '{"questions":10,"selection":"fixed"}', u); perform public.pp_host_command(c->>'code', c->>'hostToken', 'end');
  insert into t values ('fixed order is not recorded (nothing to avoid)', (select count(*) from pp.selection_history where host_user = u) = 10, null);
  insert into t values ('history stores only host, game and question ids', (select array_agg(column_name::text order by ordinal_position) from information_schema.columns
    where table_schema = 'pp' and table_name = 'selection_history') = array['id','host_user','experience_id','activity_ids','created_at'], null);
end $$;
do $$ declare ok boolean; begin
  set local role anon; begin perform 1 from pp.selection_history limit 1; ok := false; exception when others then ok := true; end; reset role;
  insert into t values ('history is not readable by browsers (anon)', ok, null);
  set local role authenticated; begin perform 1 from pp.selection_history limit 1; ok := false; exception when others then ok := true; end; reset role;
  insert into t values ('history is not readable by signed-in browsers', ok, null);
end $$;

-- Leave the database as we found it for the suites that follow.
delete from pp.session_summaries where experience_id in (select id from pp.experiences where slug in ('bank60','bank12','cat60','rand20','req60','arch12','nobank12'));
delete from pp.sessions where version_id in (select v.id from pp.experience_versions v join pp.experiences e on e.id = v.experience_id where e.slug in ('bank60','bank12','cat60','rand20','req60','arch12','nobank12'));
delete from pp.experiences where slug in ('bank60','bank12','cat60','rand20','req60','arch12','nobank12');
select case when ok then 'PASS' else 'FAIL' end || '  ' || name || coalesce('  [' || detail || ']', '') from t order by ok, name;
select count(*) filter (where ok) || ' passed, ' || count(*) filter (where not ok) || ' failed' from t;
