-- Rollback for 20261128_0100_pp_scoring_v2.sql. Restores the 3.0A _state and removes the version column.
-- Dropping scoring_version loses only the version tag on summaries written after activation; take a backup first.
drop trigger if exists summaries_scoring_version on pp.session_summaries;
drop function if exists pp._summary_version();
alter table pp.session_summaries drop column if exists scoring_version;

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
