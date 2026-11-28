-- Rollback for 20261128_0200_pp_open_answers.sql: restores the previous functions and removes open answers (their words are deleted).
-- Unpublish experiences with open questions first; their rooms would otherwise reject those questions.
drop function if exists public.pp_open_submit(text, text, text, uuid);
drop function if exists pp.open_submit(text, text, text, uuid);

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

create or replace function pp.host_command(p_code text, p_token text, p_cmd text, p_args jsonb default '{}')
returns jsonb language plpgsql set search_path = pp as $$
declare s sessions; a jsonb; n_players int; n_ans int; kind text;
begin
  s := _session(p_code);
  if s.id is null or not _is_host(s.id, p_token) then raise exception 'not host'; end if;
  perform _tick(s.id);
  select * into s from sessions where id = s.id for update;
  kind := s.snapshot->'scoring'->>'kind';
  if p_cmd = 'end' then
    insert into session_summaries(session_id, experience_id, version_id, host_user, org_id, title, joined, completed, average, per_activity, started_at)
    select s.id, v.experience_id, s.version_id, s.host_user, s.org_id, s.snapshot->>'title',
      (select count(*) from lobby where session_id = s.id),
      (select count(*) from _player_stats(s.id) where valid),
      (case when kind in ('behaviour','correct') then (_group(s.id)->>'average')::int end),
      (select jsonb_object_agg(x.a->>'id', _distribution(s.id, x.a, coalesce((s.snapshot->'privacy'->>'groupMinimum')::int, 5)))
         from _activities(s.snapshot) x where x.a->>'type' in ('poll','choice') and (s.snapshot->>'reveal') <> 'none'),
      s.created_at
    from experience_versions v where v.id = s.version_id
    on conflict (session_id) do nothing;
    delete from sessions where id = s.id;               -- cascades lobby, players, responses
    return jsonb_build_object('ended', true);
  elsif p_cmd = 'pause' then
    if s.stage <> 'activity' or s.phase not in ('read', 'answer') or s.paused then raise exception 'can only pause during a question'; end if;
    a := _activity(s.snapshot, s.idx);
    update sessions set paused = true, seq = seq + 1,
      paused_remaining_ms = greatest(0, case when s.phase = 'answer' then _ms(deadline) - _ms(now())
        else _ms(phase_started_at + make_interval(secs => _timing(s.snapshot, s.settings, a, 'read'))) - _ms(now()) end) where id = s.id;
  elsif p_cmd = 'resume' then
    if not s.paused then raise exception 'not paused'; end if;
    a := _activity(s.snapshot, s.idx);
    if s.phase = 'read' then   -- keep the reading time that was left
      update sessions set paused = false, phase_started_at = now() + make_interval(secs => s.paused_remaining_ms / 1000.0) - make_interval(secs => _timing(s.snapshot, s.settings, a, 'read')),
        paused_remaining_ms = null, seq = seq + 1 where id = s.id;
    else
      update sessions set paused = false, deadline = now() + make_interval(secs => paused_remaining_ms / 1000.0), paused_remaining_ms = null, seq = seq + 1 where id = s.id;
    end if;
  elsif p_cmd = 'kick' then
    -- removes the nickname from the screen; the phone sees its seat in "kicked" and deletes its own answers.
    if not exists(select 1 from lobby where id = (p_args->>'seat')::uuid and session_id = s.id) then raise exception 'player not found'; end if;
    delete from lobby where id = (p_args->>'seat')::uuid and session_id = s.id;
    update sessions set kicked = kicked || to_jsonb(p_args->>'seat'), seq = seq + 1 where id = s.id;
  elsif p_cmd = 'next' then
    if s.paused then raise exception 'resume first'; end if;
    if s.stage = 'lobby' then update sessions set stage = 'intro', phase_started_at = now(), seq = seq + 1 where id = s.id;
    elsif s.stage = 'intro' then update sessions set stage = 'activity', idx = 0, phase = 'read', phase_started_at = now(), deadline = null, seq = seq + 1 where id = s.id;
    elsif s.stage = 'activity' and s.phase = 'read' then
      a := _activity(s.snapshot, s.idx);
      update sessions set phase = 'answer', phase_started_at = now(), deadline = now() + make_interval(secs => _timing(s.snapshot, s.settings, a, 'answer')), seq = seq + 1 where id = s.id;
    elsif s.stage = 'activity' and s.phase = 'answer' then
      a := _activity(s.snapshot, s.idx);
      n_players := (select count(*) from players where session_id = s.id);
      n_ans := (select count(*) from responses r join players p on p.id = r.player_id where p.session_id = s.id and r.activity_id = a->>'id');
      if n_players = 0 or n_ans < n_players then raise exception 'answer window still open'; end if;
      update sessions set phase = 'reveal', phase_started_at = now(), seq = seq + 1 where id = s.id;
    elsif s.stage = 'activity' and s.phase = 'reveal' then
      if s.idx < s.n_activities - 1 then update sessions set idx = idx + 1, phase = 'read', phase_started_at = now(), deadline = null, seq = seq + 1 where id = s.id;
      else update sessions set stage = 'results', phase = null, deadline = null, phase_started_at = now(), seq = seq + 1 where id = s.id; end if;
    elsif s.stage = 'results' then
      update sessions set stage = case when kind in ('behaviour','correct') then 'group' else 'closing' end, phase_started_at = now(), seq = seq + 1 where id = s.id;
    elsif s.stage = 'group' then update sessions set stage = 'closing', phase_started_at = now(), seq = seq + 1 where id = s.id;
    else raise exception 'nothing to advance'; end if;
  elsif p_cmd = 'set_timing' then
    if s.stage not in ('lobby', 'intro') then raise exception 'timing can only change before the first question'; end if;
    if (p_args->>'readSec')::int not between 0 and 30 or (p_args->>'answerSec')::int not between 3 and 120 then raise exception 'timing out of range'; end if;
    update sessions set settings = settings || jsonb_build_object('readSec', (p_args->>'readSec')::int, 'answerSec', (p_args->>'answerSec')::int), seq = seq + 1 where id = s.id;
  else raise exception 'unknown command'; end if;
  return _state(s.id, true);
end $$;

create or replace function pp.my_state(p_token text) returns jsonb language plpgsql set search_path = pp as $$
declare pl players; st record;
begin
  select * into pl from players where token_hash = _hash(coalesce(p_token, ''));
  if not found then return null; end if;
  perform _tick(pl.session_id);
  select * into st from _player_stats(pl.session_id) x where x.player_id = pl.id;
  return jsonb_build_object(
    'answers', (select coalesce(jsonb_object_agg(activity_id, value), '{}'::jsonb) from responses where player_id = pl.id),
    'boardName', pl.board_name,
    'result', case when (select stage from sessions where id = pl.session_id) in ('results', 'group', 'closing')
      then jsonb_build_object('answered', st.answered, 'total', st.total, 'score', st.score, 'correct', st.correct, 'valid', st.valid) end);
end $$;

create or replace function pp._timing(s jsonb, settings jsonb, a jsonb, part text) returns int language sql immutable set search_path = '' as $$
  select coalesce((settings->>(part || 'Sec'))::int, (a->'timing'->>(part || 'Sec'))::int, (s->'defaultTiming'->>(part || 'Sec'))::int, 5)
$$;
create or replace function pp._public_activity(a jsonb) returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', a->'id', 'type', a->'type', 'prompt', a->'prompt', 'theme', a->'theme',
    'shuffle', coalesce(a->'shuffle', 'true'::jsonb), 'min', a->'min', 'max', a->'max', 'minLabel', a->'minLabel', 'maxLabel', a->'maxLabel',
    'options', (select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', o->'id', 'text', o->'text', 'emoji', o->'emoji')) order by n)
                from jsonb_array_elements(a->'options') with ordinality as t(o, n))))
$$;
drop function if exists pp._open_command(pp.sessions, text, jsonb);
drop function if exists pp._open_view(pp.sessions, jsonb, boolean);
drop function if exists pp._open_flag(text);
drop function if exists pp._open_fold(text);
drop function if exists pp._open_link(text);
drop function if exists pp._open_key(text);
drop function if exists pp._open_clean(text);
drop function if exists pp._activity_by_id(jsonb, text);
drop table if exists pp.open_answers;
