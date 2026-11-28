-- PulsePlay: Open Answer questions (participants type their own words) shown as a live word cloud, answer wall or list.
-- Generic platform capability: any experience may contain 'open' activities. They are never scored.
-- Privacy: answers are anonymous (no nickname is stored with them and the host never sees who wrote what),
-- held for host approval by default, checked for links and basic offensive words, and deleted with the room
-- (sessions/players -> open_answers cascade). Session summaries keep only the number of answers, never the words.
-- Rollback: supabase/manual/rollback_20261128_open_answers.sql

create table pp.open_answers (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references pp.sessions(id) on delete cascade,
  player_id   uuid not null references pp.players(id) on delete cascade,
  activity_id text not null,
  body        text not null check (char_length(body) between 1 and 140),
  key         text not null,                         -- grouping key: case-insensitive, no surrounding punctuation
  status      text not null check (status in ('pending', 'shown', 'hidden')),
  flagged     boolean not null default false,        -- caught by the basic filter: always waits for the host
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index open_answers_room on pp.open_answers (session_id, activity_id, created_at);
create index open_answers_player on pp.open_answers (player_id, activity_id);
alter table pp.open_answers enable row level security;   -- no policies: only the functions below read or write it

create or replace function pp._activity_by_id(s jsonb, p_id text) returns jsonb language sql immutable set search_path = pp as $$
  select x.a from _activities(s) x where x.a->>'id' = p_id limit 1
$$;

-- Same cleaning and grouping rules as web/src/engine/openAnswer.ts
create or replace function pp._open_clean(t text) returns text language sql immutable set search_path = '' as $$
  select btrim(regexp_replace(regexp_replace(normalize(coalesce(t, ''), NFC),
    '[\u0001-\u001f\u007f-\u009f​-‏‪-‮⁠-⁯﻿]', ' ', 'g'), '\s+', ' ', 'g'))
$$;
create or replace function pp._open_key(t text) returns text language sql immutable set search_path = pp as $$
  select regexp_replace(regexp_replace(lower(_open_clean(t)), '[ً-ٰٟـ]', '', 'g'),
    '^[[:punct:][:space:]$+<=>^`|~]+|[[:punct:][:space:]$+<=>^`|~]+$', '', 'g')
$$;
create or replace function pp._open_link(t text) returns boolean language sql immutable set search_path = '' as $$
  select t ~* '(https?://|www\.|\m[a-z0-9-]{2,}\.(com|net|org|io|ch|de|fr|ly|me|app|xyz|info|biz|co|ru|cn)\M|@[a-z0-9_]{3,})'
$$;
create or replace function pp._open_fold(w text) returns text language sql immutable set search_path = '' as $$
  select regexp_replace(translate(regexp_replace(lower(w), '[ً-ٰٟـ]', '', 'g'),
    'àâäáãåéèêëíìîïóòôöõúùûüçñ@41!|03$5', 'aaaaaaeeeeiiiiooooouuuucnaaiiioess'), '(.)\1{2,}', '\1\1', 'g')
$$;
-- Deliberately short and conservative: a flag only holds an answer back for the host; it never decides on its own.
create or replace function pp._open_flag(t text) returns boolean language sql immutable set search_path = pp as $$
  with bl(w) as (select _open_fold(x) from unnest(array[
    'fuck','fucking','shit','bitch','bastard','asshole','cunt','whore','slut','nigger','nigga','faggot','retard','rape',
    'scheisse','scheiße','arschloch','fotze','hure','wichser','schlampe','hurensohn','missgeburt','schwuchtel','spast','kanake',
    'merde','putain','connard','connasse','salope','encule','enculé','pute','batard','bâtard','nique','bougnoule',
    'شرموط','شرموطة','عاهرة','قحبة','منيوك','زب','كس','خول','يلعن','حقير','زبالة']) x),
  words(w) as (select _open_fold(x) from regexp_split_to_table(lower(_open_clean(t)), '[^[:alnum:]@$!|]+') x where x <> '')
  select exists(select 1 from words join bl on bl.w = words.w or bl.w = regexp_replace(words.w, '(.)\1+', '\1', 'g'))
$$;

create or replace function pp._timing(s jsonb, settings jsonb, a jsonb, part text) returns int language sql immutable set search_path = '' as $$
  select case
    -- open answers keep their own submission window (0 = open until the host closes it); host presets do not shorten it
    when a->>'type' = 'open' and part = 'answer' then coalesce(nullif((a->>'submitSec')::int, 0), 86400)
    else coalesce((settings->>(part || 'Sec'))::int, (a->'timing'->>(part || 'Sec'))::int, (s->'defaultTiming'->>(part || 'Sec'))::int, 5) end
$$;

-- Phones and screens need the open-question settings (limits, display); nothing else changes in what they receive.
create or replace function pp._public_activity(a jsonb) returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', a->'id', 'type', a->'type', 'prompt', a->'prompt', 'theme', a->'theme',
    'shuffle', coalesce(a->'shuffle', 'true'::jsonb), 'min', a->'min', 'max', a->'max', 'minLabel', a->'minLabel', 'maxLabel', a->'maxLabel',
    'options', (select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', o->'id', 'text', o->'text', 'emoji', o->'emoji')) order by n)
                from jsonb_array_elements(a->'options') with ordinality as t(o, n)),
    'open', case when a->>'type' = 'open' then jsonb_strip_nulls(jsonb_build_object('display', coalesce(a->'display', '"cloud"'), 'maxChars', coalesce(a->'maxChars', '25'),
      'maxWords', a->'maxWords', 'maxResponses', coalesce(a->'maxResponses', '1'), 'editSec', coalesce(a->'editSec', '15'),
      'moderation', coalesce(a->'moderation', '"approve"'), 'showAnswers', coalesce(a->'showAnswers', '"live"'), 'placeholder', a->'placeholder')) end))
$$;

-- What the screens get for the current open question. Only the host gets the answers themselves (anonymous) to moderate and display.
create or replace function pp._open_view(s pp.sessions, a jsonb, p_host boolean) returns jsonb language sql stable set search_path = pp as $$
  with st as (select coalesce(s.settings->'open'->(a->>'id'), '{}'::jsonb) o),
  rws as (select * from open_answers where session_id = s.id and activity_id = a->>'id')
  select jsonb_strip_nulls(jsonb_build_object(
    'n', (select count(*) from rws where status <> 'hidden'),
    'people', (select count(distinct player_id) from rws),
    'pending', (select count(*) from rws where status = 'pending'),
    'closed', s.phase = 'reveal',
    'visible', (a->>'showAnswers') is distinct from 'closed' or s.phase = 'reveal' or coalesce((st.o->>'revealed')::boolean, false),
    'clearedAt', (st.o->>'clearedAt')::bigint,
    'rev', (select coalesce(sum(_ms(updated_at) % 1000003), 0) + count(*) from rws) + coalesce((st.o->>'clearedAt')::bigint % 997, 0),
    'items', case when p_host then (select coalesce(jsonb_agg(jsonb_build_object('id', id, 't', body, 'k', key, 's', status, 'f', flagged, 'at', _ms(created_at))
                   order by created_at), '[]'::jsonb) from (select * from rws order by created_at desc limit 600) r) end))
  from st
$$;

create or replace function pp._open_command(s pp.sessions, p_cmd text, p_args jsonb) returns void language plpgsql set search_path = pp as $$
declare a jsonb := _activity(s.snapshot, s.idx); aid text; ids uuid[] := '{}';
begin
  if s.stage <> 'activity' or a->>'type' <> 'open' then raise exception 'not an open question'; end if;
  aid := a->>'id';
  if jsonb_typeof(p_args->'ids') = 'array' then
    select coalesce(array_agg(x::uuid), '{}') into ids from jsonb_array_elements_text(p_args->'ids') x where x ~ '^[0-9a-f-]{36}$';
  end if;
  if p_cmd = 'open_approve' then
    if coalesce((p_args->>'all')::boolean, false) then      -- "approve all" never approves flagged answers
      update open_answers set status = 'shown', updated_at = now() where session_id = s.id and activity_id = aid and status = 'pending' and not flagged;
    else update open_answers set status = 'shown', updated_at = now() where session_id = s.id and activity_id = aid and id = any(ids); end if;
  elsif p_cmd = 'open_hide' then
    update open_answers set status = 'hidden', updated_at = now() where session_id = s.id and activity_id = aid and id = any(ids);
  elsif p_cmd = 'open_close' then
    if s.phase = 'answer' and not s.paused then update sessions set phase = 'reveal', phase_started_at = now(), deadline = now() where id = s.id; end if;
  elsif p_cmd in ('open_reveal', 'open_clear') then   -- reveal: show answers now; clear: empty the screen (answers stay for the host)
    update sessions set settings = settings || jsonb_build_object('open', coalesce(settings->'open', '{}') ||
      jsonb_build_object(aid, coalesce(settings->'open'->aid, '{}') ||
        case when p_cmd = 'open_reveal' then '{"revealed": true}'::jsonb else jsonb_build_object('clearedAt', _ms(now())) end)) where id = s.id;
  else raise exception 'unknown command'; end if;
  update sessions set seq = seq + 1 where id = s.id;
end $$;

-- A participant sends (or, within the edit window, changes) one answer. Returns {status, id, editUntil}; status is one of
-- ok | duplicate | not_open | late | unknown_player | invalid | empty | too_long | too_many_words | link | limit | edit_closed | rate.
create or replace function pp.open_submit(p_token text, p_activity text, p_text text, p_id uuid default null) returns jsonb
language plpgsql set search_path = pp as $$
declare pl players; s sessions; a jsonb; txt text; k text; fl boolean; st text; cnt int; row_id uuid; created timestamptz; n int;
        edit_s int; w timestamptz := date_trunc('minute', now());
begin
  select * into pl from players where token_hash = _hash(coalesce(p_token, ''));
  if not found then return jsonb_build_object('status', 'unknown_player'); end if;
  -- limited per participant, not per IP: a whole room may share one venue Wi-Fi
  insert into rate_limits(key, window_start, n) values ('open:' || pl.id, w, 1)
    on conflict (key, window_start) do update set n = rate_limits.n + 1 returning rate_limits.n into n;
  if n > 20 then return jsonb_build_object('status', 'rate'); end if;
  perform _tick(pl.session_id);
  select * into s from sessions where id = pl.session_id;
  if s.stage <> 'activity' or s.phase <> 'answer' or s.paused then return jsonb_build_object('status', 'not_open'); end if;
  a := _activity(s.snapshot, s.idx);
  if a->>'id' <> p_activity or a->>'type' <> 'open' then return jsonb_build_object('status', 'not_open'); end if;
  if now() > s.deadline + interval '400 milliseconds' then return jsonb_build_object('status', 'late'); end if;
  if p_text is null or char_length(p_text) > 1000 then return jsonb_build_object('status', 'invalid'); end if;
  txt := _open_clean(p_text);
  if txt = '' then return jsonb_build_object('status', 'empty'); end if;
  if char_length(txt) > coalesce((a->>'maxChars')::int, 25) then return jsonb_build_object('status', 'too_long'); end if;
  if a ? 'maxWords' and array_length(regexp_split_to_array(txt, ' '), 1) > (a->>'maxWords')::int then return jsonb_build_object('status', 'too_many_words'); end if;
  if _open_link(txt) then return jsonb_build_object('status', 'link'); end if;
  k := _open_key(txt); fl := _open_flag(txt); edit_s := coalesce((a->>'editSec')::int, 15);
  if k = '' then return jsonb_build_object('status', 'empty'); end if;
  st := case when a->>'moderation' = 'live' and not fl then 'shown' else 'pending' end;
  if p_id is not null then
    select id, created_at into row_id, created from open_answers where id = p_id and player_id = pl.id and activity_id = p_activity and status <> 'hidden';
    if row_id is null then return jsonb_build_object('status', 'invalid'); end if;
    if edit_s = 0 or now() > created + make_interval(secs => edit_s) then return jsonb_build_object('status', 'edit_closed'); end if;
    if exists(select 1 from open_answers where player_id = pl.id and activity_id = p_activity and key = k and id <> p_id) then
      return jsonb_build_object('status', 'duplicate'); end if;
    update open_answers set body = txt, key = k, flagged = fl, status = st, updated_at = now() where id = p_id;
  else
    select id, created_at into row_id, created from open_answers where player_id = pl.id and activity_id = p_activity and key = k;
    if row_id is not null then   -- the same answer again (double tap, retry after a lost connection): nothing new is stored
      return jsonb_build_object('status', 'duplicate', 'id', row_id, 'editUntil', _ms(created + make_interval(secs => edit_s)));
    end if;
    select count(*) into cnt from open_answers where player_id = pl.id and activity_id = p_activity;
    if cnt >= coalesce((a->>'maxResponses')::int, 1) then return jsonb_build_object('status', 'limit'); end if;
    insert into open_answers(session_id, player_id, activity_id, body, key, status, flagged) values (s.id, pl.id, p_activity, txt, k, st, fl)
      returning id, created_at into row_id, created;
  end if;
  return jsonb_build_object('status', 'ok', 'id', row_id, 'editUntil', _ms(created + make_interval(secs => edit_s)));
end $$;

create or replace function pp._state(p_id uuid, p_host boolean) returns jsonb language plpgsql stable set search_path = pp as $$
declare s sessions; a jsonb; reveal jsonb := null; grp jsonb := null; board jsonb := null; mn int; rv text; kind text; answered int; joined int;
        meta jsonb; late boolean; op jsonb := null;
begin
  select * into s from sessions where id = p_id;
  if not found then return null; end if;
  mn := coalesce((s.snapshot->'privacy'->>'groupMinimum')::int, 5);
  rv := coalesce(s.snapshot->>'reveal', 'none'); kind := s.snapshot->'scoring'->>'kind';
  joined := (select count(*) from lobby where session_id = p_id);
  if s.stage = 'activity' then
    a := _activity(s.snapshot, s.idx);
    if a->>'type' = 'open' then
      answered := (select count(distinct player_id) from open_answers where session_id = p_id and activity_id = a->>'id');
      op := _open_view(s, a, p_host);
    else
      answered := (select count(*) from responses r join players p on p.id = r.player_id where p.session_id = p_id and r.activity_id = a->>'id');
    end if;
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
    'reveal', reveal, 'group', grp, 'leaderboard', board, 'open', op,
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
         from _activities(s.snapshot) x where x.a->>'type' in ('poll','choice') and (s.snapshot->>'reveal') <> 'none')
        -- open answers: only how many were given; the words are deleted with the room
        || coalesce((select jsonb_object_agg(x.a->>'id', jsonb_build_object('n', (select count(*) from open_answers o where o.session_id = s.id and o.activity_id = x.a->>'id' and o.status <> 'hidden')))
             from _activities(s.snapshot) x where x.a->>'type' = 'open'), '{}'::jsonb),
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
      if a->>'type' <> 'open' then   -- open answers: Next closes submissions at any time
        n_players := (select count(*) from players where session_id = s.id);
        n_ans := (select count(*) from responses r join players p on p.id = r.player_id where p.session_id = s.id and r.activity_id = a->>'id');
        if n_players = 0 or n_ans < n_players then raise exception 'answer window still open'; end if;
      end if;
      update sessions set phase = 'reveal', phase_started_at = now(), seq = seq + 1 where id = s.id;
    elsif s.stage = 'activity' and s.phase = 'reveal' then
      if s.idx < s.n_activities - 1 then update sessions set idx = idx + 1, phase = 'read', phase_started_at = now(), deadline = null, seq = seq + 1 where id = s.id;
      else update sessions set stage = 'results', phase = null, deadline = null, phase_started_at = now(), seq = seq + 1 where id = s.id; end if;
    elsif s.stage = 'results' then
      update sessions set stage = case when kind in ('behaviour','correct') then 'group' else 'closing' end, phase_started_at = now(), seq = seq + 1 where id = s.id;
    elsif s.stage = 'group' then update sessions set stage = 'closing', phase_started_at = now(), seq = seq + 1 where id = s.id;
    else raise exception 'nothing to advance'; end if;
  elsif p_cmd in ('open_approve', 'open_hide', 'open_close', 'open_reveal', 'open_clear') then
    perform _open_command(s, p_cmd, p_args);
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
    -- own open answers only (text and edit window); others' answers never reach a phone
    'open', (select coalesce(jsonb_object_agg(activity_id, items), '{}'::jsonb) from (
        select o.activity_id, jsonb_agg(jsonb_build_object('id', o.id, 't', o.body, 'at', _ms(o.created_at),
          'editUntil', _ms(o.created_at + make_interval(secs => coalesce((_activity_by_id(s2.snapshot, o.activity_id)->>'editSec')::int, 15))))
          order by o.created_at) items
        from open_answers o join sessions s2 on s2.id = o.session_id where o.player_id = pl.id and o.status <> 'hidden' group by o.activity_id) t),
    -- how many answers this phone has used per question, removed ones included (removing an answer does not give a new one)
    'openUsed', (select coalesce(jsonb_object_agg(activity_id, n), '{}'::jsonb) from (
        select activity_id, count(*) n from open_answers where player_id = pl.id group by activity_id) u),
    'result', case when (select stage from sessions where id = pl.session_id) in ('results', 'group', 'closing')
      then jsonb_build_object('answered', st.answered, 'total', st.total, 'score', st.score, 'correct', st.correct, 'valid', st.valid) end);
end $$;

create or replace function public.pp_open_submit(p_token text, p_activity text, p_text text, p_id uuid default null) returns jsonb
  language sql security definer set search_path = '' as $$ select pp.open_submit(p_token, p_activity, p_text, p_id) $$;
revoke all on function public.pp_open_submit(text, text, text, uuid) from public;
grant execute on function public.pp_open_submit(text, text, text, uuid) to anon, authenticated;
revoke all on function pp._open_command(pp.sessions, text, jsonb), pp._open_view(pp.sessions, jsonb, boolean),
  pp.open_submit(text, text, text, uuid) from public, anon, authenticated;
