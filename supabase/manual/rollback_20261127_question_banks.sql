-- Rollback for 20261127_0100_pp_question_banks.sql. Run only with approval.
-- Effect: rooms created afterwards play every question in authored order again (the previous behaviour).
-- Running rooms keep working: their snapshot is complete, only the "selection" key becomes unused.
-- Drops pp.selection_history (it holds only signed-in hosts' recent question ids; losing it only weakens repeat avoidance).
begin;
drop trigger if exists sessions_locked on pp.sessions;
drop function if exists pp._session_locked();
create or replace function pp.create_session(p_experience text, p_settings jsonb, p_host_user uuid default null)
returns jsonb language plpgsql set search_path = pp, extensions as $$
declare v experience_versions; e experiences; c text; tok text := encode(gen_random_bytes(24), 'hex'); sid uuid; st jsonb := '{}'; n int;
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
  select count(*) into n from _activities(v.content);
  loop c := lpad((floor(random() * 900000) + 100000)::int::text, 6, '0'); exit when not exists(select 1 from sessions where code = c); end loop;
  insert into sessions(code, version_id, snapshot, settings, host_user, org_id, n_activities) values (c, v.id, v.content, st, p_host_user, e.org_id, n) returning id into sid;
  insert into session_secrets values (sid, _hash(tok));
  return jsonb_build_object('code', c, 'hostToken', tok, 'state', _state(sid, true));
end $$;
revoke all on function pp.create_session(text, jsonb, uuid) from public, anon, authenticated;
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
    'settings', jsonb_build_object('leaderboard', coalesce((s.settings->>'leaderboard')::boolean, false), 'autoAdvanceSec', s.settings->'autoAdvanceSec'),
    'experience', meta, 'activity', case when a is not null then _public_activity(a) end,
    'reveal', reveal, 'group', grp, 'leaderboard', board,
    -- full snapshot only once answers can no longer change: lets phones render result texts and insights for any experience
    'snapshot', case when s.stage in ('results','group','closing') then s.snapshot end,
    'kicked', case when jsonb_array_length(s.kicked) > 0 then s.kicked end,
    'names', case when p_host then (select coalesce(jsonb_agg(jsonb_build_object('i', id, 'n', nickname, 'a', avatar) order by joined_at), '[]'::jsonb) from lobby where session_id = p_id) end
  ));
end $$;
drop function if exists pp._bank_snapshot(jsonb, text, jsonb);
drop function if exists pp._bank_select(jsonb, text, int, jsonb);
drop function if exists pp._bank_default(jsonb, text);
drop function if exists pp._bank_lengths(jsonb, text);
drop function if exists pp._bank_strategy(jsonb);
drop function if exists pp._bank_pool(jsonb, text);
drop table if exists pp.selection_history;
revoke all on function pp._state(uuid, boolean) from public, anon, authenticated;
commit;
