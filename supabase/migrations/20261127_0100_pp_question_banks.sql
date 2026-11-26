-- Release 3.0A: question banks. The server picks a session's questions when the room is created and locks them in the
-- session snapshot. Same rules as web/src/engine/bank.ts. Content without a "bank" plays exactly as before by default.
-- Additive: new functions, one new table, one trigger; create_session and _state are replaced with supersets.
-- Rollback: supabase/manual/rollback_20261127_question_banks.sql

-- ---------- Recent-question history: per signed-in host and game. No participant data, no device identifiers. ----------
create table if not exists pp.selection_history (
  id            bigserial primary key,
  host_user     uuid not null,
  experience_id uuid not null references pp.experiences(id) on delete cascade,
  activity_ids  text[] not null,
  created_at    timestamptz not null default now()
);
create index if not exists selection_history_lookup on pp.selection_history(host_user, experience_id, created_at desc);
alter table pp.selection_history enable row level security;   -- no policies: only server functions read or write it
revoke all on pp.selection_history from public, anon, authenticated;

-- ---------- Pool, lengths, default ----------
create or replace function pp._bank_pool(c jsonb, strat text) returns table(i int, a jsonb, g text, req boolean)
language sql immutable set search_path = '' as $$
  select x.i, x.a,
    coalesce(case strat when 'category' then x.a->>'category' when 'dimension' then x.a->>'dimension' end, '_'),
    coalesce((x.a->>'required')::boolean, false)
  from pp._activities(c) x
  where coalesce((x.a->>'active')::boolean, true) and (strat = 'fixed' or coalesce((x.a->>'random')::boolean, true))
$$;

create or replace function pp._bank_strategy(c jsonb) returns text language sql immutable set search_path = '' as $$
  select coalesce(c->'bank'->>'strategy', 'fixed')
$$;

-- Lengths a host may choose: configured (default 10/15/20) that fit the eligible pool; without a bank also "all N". Never padded.
create or replace function pp._bank_lengths(c jsonb, strat text) returns int[] language plpgsql immutable set search_path = '' as $$
declare pool int; base int[]; av int[];
begin
  select count(*) into pool from pp._bank_pool(c, strat);
  base := coalesce((select array_agg(v::int) from jsonb_array_elements_text(c->'bank'->'lengths') v), array[10, 15, 20]);
  select coalesce(array_agg(n order by n), '{}') into av from unnest(base) n where n <= pool;
  if (c->'bank' is null or cardinality(av) = 0) and pool > 0 and not pool = any(base) then av := av || pool; end if;
  return (select coalesce(array_agg(n order by n), '{}') from unnest(av) n);
end $$;

create or replace function pp._bank_default(c jsonb, strat text) returns int language plpgsql immutable set search_path = '' as $$
declare av int[] := pp._bank_lengths(c, strat); d int := (c->'bank'->>'defaultLength')::int;
begin
  if cardinality(av) = 0 then return 0; end if;
  if c->'bank' is null then return av[cardinality(av)]; end if;   -- no bank: every question, as before
  return case when d = any(av) then d else av[1] end;
end $$;

-- ---------- Selection ----------
-- rec: {activityId: recency} where higher = used more recently; unseen questions come first, then the least recently used.
create or replace function pp._bank_select(c jsonb, strat text, n int, rec jsonb default '{}') returns jsonb
language plpgsql volatile set search_path = '' as $$
declare res jsonb; nreq int;
begin
  select count(*) filter (where req) into nreq from pp._bank_pool(c, strat);
  if nreq > n then raise exception 'more required questions than the game length'; end if;
  if strat = 'fixed' then          -- required first, then authored order; played in authored order
    select jsonb_agg(t.a order by t.i) into res from (select p.i, p.a from pp._bank_pool(c, strat) p order by p.req desc, p.i limit n) t;
  elsif strat = 'random' then      -- required first, then least recently used (ties random); played in random order
    select jsonb_agg(t.a order by random()) into res from (
      select p.a from pp._bank_pool(c, strat) p order by p.req desc, coalesce((rec->>(p.a->>'id'))::int, -1), random() limit n) t;
  else                             -- balanced: round-robin by rank within group, groups in random order; played interleaved
    with p as (select x.a, x.g, x.req, random() tie from pp._bank_pool(c, strat) x),
    grp as (select d.g, random() k from (select distinct g from p) d),
    r as (select p.a, p.req, grp.k, row_number() over (partition by p.g order by p.req desc, coalesce((rec->>(p.a->>'id'))::int, -1), p.tie) rk
          from p join grp using (g)),
    picked as (select * from r order by req desc, rk, k limit n)
    select jsonb_agg(a order by rk, k) into res from picked;
  end if;
  return res;
end $$;

-- Session snapshot: same content, rounds narrowed to the selection (play order), plus a record of the selection.
create or replace function pp._bank_snapshot(c jsonb, strat text, picked jsonb) returns jsonb language sql immutable set search_path = '' as $$
  select c || jsonb_build_object(
    'rounds', case when jsonb_array_length(c->'rounds') = 1
      then jsonb_build_array((c->'rounds'->0) || jsonb_build_object('activities', picked))
      else (select coalesce(jsonb_agg(rr.r || jsonb_build_object('activities', rr.acts) order by rr.o), '[]'::jsonb) from (
              select r.r, r.o, (select jsonb_agg(a.v order by pk.o) from jsonb_array_elements(r.r->'activities') a(v)
                                join jsonb_array_elements(picked) with ordinality pk(v, o) on pk.v->>'id' = a.v->>'id') acts
              from jsonb_array_elements(c->'rounds') with ordinality r(r, o)) rr where rr.acts is not null) end,
    'selection', jsonb_build_object('strategy', strat, 'count', jsonb_array_length(picked),
      'bankSize', (select count(*) from pp._bank_pool(c, strat)),
      'ids', (select jsonb_agg(v->'id' order by o) from jsonb_array_elements(picked) with ordinality x(v, o))))
$$;

-- ---------- Sessions: questions locked once created ----------
create or replace function pp._session_locked() returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'a session''s questions are locked once it is created'; end $$;
drop trigger if exists sessions_locked on pp.sessions;
create trigger sessions_locked before update of snapshot, version_id, n_activities on pp.sessions
  for each row when (new.snapshot is distinct from old.snapshot or new.version_id is distinct from old.version_id or new.n_activities is distinct from old.n_activities)
  execute function pp._session_locked();

-- ---------- create_session: + questions, selection strategy, recent-question avoidance ----------
create or replace function pp.create_session(p_experience text, p_settings jsonb, p_host_user uuid default null)
returns jsonb language plpgsql set search_path = pp, extensions as $$
declare v experience_versions; e experiences; c text; tok text := encode(gen_random_bytes(24), 'hex'); sid uuid; st jsonb := '{}'; n int;
        strat text; own text; allowed text[]; lens int[]; picked jsonb; snap jsonb; rec jsonb := '{}'; lists jsonb := '[]';
begin
  perform _rate('create', 30, interval '1 hour');
  delete from sessions where expires_at < now();
  select * into e from experiences where (slug = p_experience or id::text = p_experience) and status = 'published';
  if not found or not (e.visibility in ('public', 'unlisted') or (p_host_user is not null and (e.owner_user = p_host_user or has_role(e.org_id))))
    then raise exception 'experience not found'; end if;
  select * into v from experience_versions where experience_id = e.id order by version desc limit 1;
  if not found then raise exception 'experience has no published version'; end if;
  if p_settings ? 'readSec'   then if (p_settings->>'readSec')::int not between 0 and 30 then raise exception 'readSec must be 0-30'; end if; st := st || jsonb_build_object('readSec', (p_settings->>'readSec')::int); end if;
  if p_settings ? 'answerSec' then if (p_settings->>'answerSec')::int not between 3 and 120 then raise exception 'answerSec must be 3-120'; end if; st := st || jsonb_build_object('answerSec', (p_settings->>'answerSec')::int); end if;
  if p_settings ? 'autoAdvanceSec' and p_settings->>'autoAdvanceSec' is not null then
    if (p_settings->>'autoAdvanceSec')::int not between 3 and 60 then raise exception 'autoAdvanceSec must be 3-60'; end if;
    st := st || jsonb_build_object('autoAdvanceSec', (p_settings->>'autoAdvanceSec')::int); end if;
  if coalesce((p_settings->>'leaderboard')::boolean, false) then
    if v.content->'scoring'->>'kind' <> 'correct' then raise exception 'leaderboards are only available for knowledge games'; end if;
    st := st || '{"leaderboard": true}';
  end if;

  -- Selection strategy: the game's own, or random / fixed order.
  own := _bank_strategy(v.content);
  allowed := case when own in ('fixed', 'random') then array['fixed', 'random'] else array[own, 'random', 'fixed'] end;
  strat := coalesce(p_settings->>'selection', own);
  if not strat = any(allowed) then raise exception 'selection must be one of %', array_to_string(allowed, ', '); end if;
  -- Length: validated against the eligible pool; never padded.
  lens := _bank_lengths(v.content, strat);
  if cardinality(lens) = 0 then raise exception 'this game has no playable questions'; end if;
  if p_settings ? 'questions' and p_settings->>'questions' is not null then
    if (p_settings->>'questions') !~ '^[0-9]{1,3}$' or not (p_settings->>'questions')::int = any(lens)
      then raise exception 'questions must be one of %', array_to_string(lens, ', '); end if;
    n := (p_settings->>'questions')::int;
  else n := _bank_default(v.content, strat); end if;
  st := st || jsonb_build_object('questions', n, 'selection', strat);

  -- Recent questions (best effort, never personal): a signed-in host's own last sessions of this game, kept on the server;
  -- otherwise a hint the host's browser keeps about its own recent rooms. Ignored for the fixed order.
  if strat <> 'fixed' then
    if p_host_user is not null then
      select coalesce(jsonb_agg(to_jsonb(h.activity_ids) order by h.created_at desc), '[]') into lists
      from (select activity_ids, created_at from selection_history where host_user = p_host_user and experience_id = e.id order by created_at desc limit 5) h;
    elsif jsonb_typeof(p_settings->'recent') = 'array' then
      select coalesce(jsonb_agg(l.lst order by l.pos), '[]') into lists
      from (select x.lst, x.pos from jsonb_array_elements(p_settings->'recent') with ordinality x(lst, pos) where jsonb_typeof(x.lst) = 'array' order by x.pos limit 5) l;
    end if;
    select coalesce(jsonb_object_agg(id, r), '{}') into rec from (
      select distinct on (x.id) x.id, 100 - l.pos::int r
      from jsonb_array_elements(lists) with ordinality l(lst, pos)
      cross join lateral (select y.value id from jsonb_array_elements(l.lst) y where jsonb_typeof(y.value) = 'string' limit 200) x0
      cross join lateral (select x0.id #>> '{}' id) x
      where x.id ~ '^[a-z0-9-]{1,40}$' order by x.id, l.pos) q;
  end if;

  picked := _bank_select(v.content, strat, n, rec);
  if picked is null or jsonb_array_length(picked) <> n then raise exception 'could not select % questions', n; end if;
  if (select count(distinct x->>'id') from jsonb_array_elements(picked) x) <> n then raise exception 'duplicate question in selection'; end if;
  snap := _bank_snapshot(v.content, strat, picked);

  loop c := lpad((floor(random() * 900000) + 100000)::int::text, 6, '0'); exit when not exists(select 1 from sessions where code = c); end loop;
  insert into sessions(code, version_id, snapshot, settings, host_user, org_id, n_activities) values (c, v.id, snap, st, p_host_user, e.org_id, n) returning id into sid;
  insert into session_secrets values (sid, _hash(tok));
  if p_host_user is not null and strat <> 'fixed' then
    insert into selection_history(host_user, experience_id, activity_ids)
      select p_host_user, e.id, array(select jsonb_array_elements_text(snap->'selection'->'ids'));
    delete from selection_history where id in (select id from selection_history where host_user = p_host_user and experience_id = e.id order by created_at desc offset 10);
  end if;
  return jsonb_build_object('code', c, 'hostToken', tok, 'selection', snap->'selection', 'state', _state(sid, true));
end $$;
revoke all on function pp.create_session(text, jsonb, uuid) from public, anon, authenticated;

-- ---------- _state: + timing settings and a selection summary (no question ids) for the lobby ----------
create or replace function pp._state(p_id uuid, p_host boolean) returns jsonb language plpgsql stable set search_path = pp as $$
declare s sessions; a jsonb; reveal jsonb := null; grp jsonb := null; board jsonb := null; mn int; rv text; kind text; answered int; joined int;
        meta jsonb; late boolean;
begin
  select * into s from sessions where id = p_id;
  if not found then return null; end if;
  mn := coalesce((s.snapshot->'privacy'->>'groupMinimum')::int, 5);
  rv := coalesce(s.snapshot->>'reveal', 'none'); kind := s.snapshot->'scoring'->>'kind';
  joined := (select count(*) from lobby where session_id = p_id);
  if s.stage = 'activity' then
    a := _activity(s.snapshot, s.idx);
    answered := (select count(*) from responses r join players p on p.id = r.player_id where p.session_id = p_id and r.activity_id = a->>'id');
    if s.phase = 'reveal' and rv <> 'none' then
      reveal := jsonb_build_object('distribution', _distribution(p_id, a, mn));
      if rv = 'correct' then
        reveal := reveal || jsonb_build_object('correct', (select o->'id' from jsonb_array_elements(a->'options') o where (o->>'correct')::boolean limit 1), 'explanation', a->'explanation');
      end if;
    end if;
  end if;
  if s.stage in ('group', 'closing') and kind in ('behaviour', 'correct') then grp := _group(p_id); end if;
  if s.stage in ('results', 'group', 'closing') and kind = 'correct' and coalesce((s.settings->>'leaderboard')::boolean, false) then
    select coalesce(jsonb_agg(jsonb_build_object('name', board_name, 'correct', correct) order by correct desc, board_name), '[]'::jsonb) into board
    from (select board_name, correct from _player_stats(p_id) where board_name is not null order by correct desc, board_name limit 10) t;
  end if;
  meta := jsonb_build_object('id', s.snapshot->'id', 'title', s.snapshot->'title', 'tagline', s.snapshot->'tagline', 'emoji', s.snapshot->'emoji',
    'disclaimer', s.snapshot->'disclaimer', 'privacy', s.snapshot->'privacy', 'reveal', rv, 'scoringKind', kind,
    'defaultTiming', s.snapshot->'defaultTiming', 'transitions', s.snapshot->'transitions', 'closing', s.snapshot->'closing',
    'results', s.snapshot->'results', 'insights', case when s.stage in ('results','group','closing') then s.snapshot->'insights' end);
  return jsonb_strip_nulls(jsonb_build_object(
    'now', _ms(now()), 'code', s.code, 'stage', s.stage, 'index', s.idx, 'phase', s.phase,
    'phaseAt', _ms(s.phase_started_at), 'deadline', _ms(s.deadline), 'paused', s.paused, 'pausedRemaining', s.paused_remaining_ms,
    'seq', s.seq, 'total', s.n_activities, 'joined', joined, 'answered', answered,
    'timing', case when a is not null then jsonb_build_object('readSec', _timing(s.snapshot, s.settings, a, 'read'), 'answerSec', _timing(s.snapshot, s.settings, a, 'answer')) end,
    'settings', jsonb_build_object('leaderboard', coalesce((s.settings->>'leaderboard')::boolean, false), 'autoAdvanceSec', s.settings->'autoAdvanceSec',
      'readSec', s.settings->'readSec', 'answerSec', s.settings->'answerSec'),
    'selection', case when s.snapshot ? 'selection' then jsonb_build_object('strategy', s.snapshot->'selection'->'strategy',
      'count', s.snapshot->'selection'->'count', 'bankSize', s.snapshot->'selection'->'bankSize') end,
    'experience', meta, 'activity', case when a is not null then _public_activity(a) end,
    'reveal', reveal, 'group', grp, 'leaderboard', board,
    -- full snapshot only once answers can no longer change: lets phones render result texts and insights for any experience
    'snapshot', case when s.stage in ('results','group','closing') then s.snapshot end,
    'kicked', case when jsonb_array_length(s.kicked) > 0 then s.kicked end,
    'names', case when p_host then (select coalesce(jsonb_agg(jsonb_build_object('i', id, 'n', nickname, 'a', avatar) order by joined_at), '[]'::jsonb) from lobby where session_id = p_id) end
  ));
end $$;

revoke all on function pp._bank_pool(jsonb, text), pp._bank_strategy(jsonb), pp._bank_lengths(jsonb, text), pp._bank_default(jsonb, text),
  pp._bank_select(jsonb, text, int, jsonb), pp._bank_snapshot(jsonb, text, jsonb), pp._session_locked(), pp._state(uuid, boolean) from public, anon, authenticated;
