-- PulsePlay core: experiences, immutable versions, and ONE generic live-session engine for every game.
-- All tables live in schema "pp" with no direct client access. Clients call SECURITY DEFINER wrappers public.pp_*.
-- Rollback: drop the public.pp_* functions (list at the end) and `drop schema pp cascade`. Ego Check legacy (schema egocheck) is untouched.

create schema if not exists pp;
revoke all on schema pp from public, anon, authenticated;

-- ---------- Content ----------
create table pp.experiences (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique check (slug ~ '^[a-z0-9-]{1,40}$'),
  owner_user  uuid,                         -- null = platform (built-in)
  org_id      uuid,                         -- FK added with organisations
  title       text not null check (char_length(title) between 1 and 60),
  visibility  text not null default 'private' check (visibility in ('private','org','unlisted','public')),
  status      text not null default 'draft'   check (status in ('draft','review','published','archived')),
  built_in    boolean not null default false,
  draft       jsonb,                        -- editable working copy (builder writes here)
  template_of uuid references pp.experiences(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table pp.experience_versions (
  id             uuid primary key default gen_random_uuid(),
  experience_id  uuid not null references pp.experiences(id) on delete cascade,
  version        int  not null check (version > 0),
  content        jsonb not null,
  schema_version int  not null,
  published_by   uuid,
  published_at   timestamptz not null default now(),
  unique (experience_id, version)
);
create or replace function pp._immutable() returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'experience versions are immutable; publish a new version instead'; end $$;
create trigger versions_immutable before update on pp.experience_versions for each row execute function pp._immutable();

-- ---------- Live sessions (shared by all games) ----------
create table pp.sessions (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique check (code ~ '^[0-9]{6}$'),
  version_id       uuid not null references pp.experience_versions(id),
  snapshot         jsonb not null,            -- immutable copy used for the whole session
  settings         jsonb not null default '{}',
  host_user        uuid,
  org_id           uuid,
  stage            text not null default 'lobby' check (stage in ('lobby','intro','activity','results','group','closing')),
  idx              int  not null default 0,
  phase            text check (phase in ('read','answer','reveal')),
  phase_started_at timestamptz not null default now(),
  deadline         timestamptz,
  paused           boolean not null default false,
  paused_remaining_ms int,
  seq              int not null default 1,
  n_activities     int not null,
  created_at       timestamptz not null default now(),
  expires_at       timestamptz not null default now() + interval '24 hours'
);
create table pp.session_secrets (session_id uuid primary key references pp.sessions(id) on delete cascade, host_hash text not null);
-- Presence: what the projector shows. No link to answers.
create table pp.lobby (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references pp.sessions(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 20),
  avatar text not null default '🙂' check (char_length(avatar) between 1 and 8),
  joined_at timestamptz not null default now()
);
-- Answer identity: a token hash. board_name is set ONLY when the player opts into a trivia leaderboard.
create table pp.players (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references pp.sessions(id) on delete cascade,
  token_hash text not null unique,
  board_name text check (board_name is null or char_length(board_name) between 1 and 20),
  created_at timestamptz not null default now()
);
create table pp.responses (
  player_id uuid not null references pp.players(id) on delete cascade,
  activity_id text not null,
  value jsonb not null,
  created_at timestamptz not null default now(),
  primary key (player_id, activity_id)
);
-- Kept after a session ends: aggregates only, never names or individual answers.
create table pp.session_summaries (
  session_id uuid primary key, experience_id uuid, version_id uuid, host_user uuid, org_id uuid,
  title text, joined int, completed int, average int, per_activity jsonb,
  started_at timestamptz, ended_at timestamptz not null default now()
);
create table pp.rate_limits (key text not null, window_start timestamptz not null, n int not null default 0, primary key (key, window_start));

create index on pp.lobby (session_id);
create index on pp.players (session_id);
create index on pp.experience_versions (experience_id, version desc);

alter table pp.experiences enable row level security;
alter table pp.experience_versions enable row level security;
alter table pp.sessions enable row level security;
alter table pp.session_secrets enable row level security;
alter table pp.lobby enable row level security;
alter table pp.players enable row level security;
alter table pp.responses enable row level security;
alter table pp.session_summaries enable row level security;
alter table pp.rate_limits enable row level security;

-- ---------- Helpers ----------
create or replace function pp._hash(t text) returns text language sql immutable set search_path = pp, extensions as
$$ select encode(digest(t, 'sha256'), 'hex') $$;
create or replace function pp._ms(t timestamptz) returns bigint language sql immutable set search_path = '' as
$$ select (extract(epoch from t) * 1000)::bigint $$;

create or replace function pp._activities(s jsonb) returns table(i int, a jsonb) language sql immutable set search_path = '' as $$
  select (row_number() over (order by r.o, x.o) - 1)::int, x.v
  from jsonb_array_elements(s->'rounds') with ordinality as r(v, o)
  cross join lateral jsonb_array_elements(r.v->'activities') with ordinality as x(v, o)
$$;
create or replace function pp._activity(s jsonb, p_i int) returns jsonb language sql immutable set search_path = pp as
$$ select a from _activities(s) where i = p_i $$;

create or replace function pp._timing(s jsonb, settings jsonb, a jsonb, part text) returns int language sql immutable set search_path = '' as $$
  select coalesce((settings->>(part || 'Sec'))::int, (a->'timing'->>(part || 'Sec'))::int, (s->'defaultTiming'->>(part || 'Sec'))::int, 5)
$$;

-- Simple fixed-window rate limiter keyed by caller IP (taken from PostgREST request headers).
create or replace function pp._rate(p_action text, p_max int, p_window interval) returns void language plpgsql set search_path = pp as $$
declare h json := nullif(current_setting('request.headers', true), '')::json;
        ip text := coalesce(h->>'cf-connecting-ip', h->>'x-real-ip', split_part(coalesce(h->>'x-forwarded-for', ''), ',', 1), 'local');
        w timestamptz := to_timestamp(floor(extract(epoch from now()) / extract(epoch from p_window)) * extract(epoch from p_window));
        n int;
begin
  insert into rate_limits(key, window_start, n) values (p_action || ':' || ip, w, 1)
    on conflict (key, window_start) do update set n = rate_limits.n + 1 returning rate_limits.n into n;
  if n > p_max then raise exception 'rate limited: please wait a moment and try again'; end if;
  delete from rate_limits where window_start < now() - interval '1 day';
end $$;

create or replace function pp._session(p_code text) returns pp.sessions language sql stable set search_path = pp as
$$ select * from sessions where code = p_code and expires_at > now() $$;

create or replace function pp._is_host(p_session uuid, p_token text) returns boolean language sql stable set search_path = pp as
$$ select exists(select 1 from session_secrets where session_id = p_session and host_hash = _hash(coalesce(p_token, ''))) $$;

-- ---------- Server-clock progression ----------
-- Called on every read: timed phases advance by the server clock, so a closed presenter tab never freezes scoring or deadlines.
create or replace function pp._tick(p_id uuid) returns void language plpgsql set search_path = pp as $$
declare s sessions; a jsonb; changed boolean; auto int; guard int := 0;
begin
  loop
    guard := guard + 1; exit when guard > 5;
    select * into s from sessions where id = p_id for update;
    if not found or s.stage <> 'activity' or s.paused then return; end if;
    a := _activity(s.snapshot, s.idx); changed := false;
    if s.phase = 'read' and now() >= s.phase_started_at + make_interval(secs => _timing(s.snapshot, s.settings, a, 'read')) then
      update sessions set phase = 'answer',
        phase_started_at = s.phase_started_at + make_interval(secs => _timing(s.snapshot, s.settings, a, 'read')),
        deadline = s.phase_started_at + make_interval(secs => _timing(s.snapshot, s.settings, a, 'read') + _timing(s.snapshot, s.settings, a, 'answer')),
        seq = seq + 1 where id = p_id;
      changed := true;
    elsif s.phase = 'answer' and now() >= s.deadline then
      update sessions set phase = 'reveal', phase_started_at = s.deadline, seq = seq + 1 where id = p_id; changed := true;
    elsif s.phase = 'reveal' then
      auto := nullif(s.settings->>'autoAdvanceSec', '')::int;
      if auto is not null and now() >= s.phase_started_at + make_interval(secs => auto) then
        if s.idx < s.n_activities - 1 then
          update sessions set idx = idx + 1, phase = 'read', phase_started_at = s.phase_started_at + make_interval(secs => auto), deadline = null, seq = seq + 1 where id = p_id;
        else
          update sessions set stage = 'results', phase = null, deadline = null, phase_started_at = now(), seq = seq + 1 where id = p_id;
        end if;
        changed := true;
      end if;
    end if;
    exit when not changed;
  end loop;
end $$;

-- ---------- Scoring (driven by the snapshot; same rules as web/src/engine/scoring.ts) ----------
create or replace function pp._player_stats(p_session uuid)
returns table(player_id uuid, board_name text, answered int, total int, score int, correct int, valid boolean)
language sql stable set search_path = pp as $$
  with s as (select snapshot from sessions where id = p_session),
  acts as (select x.a from s, _activities(s.snapshot) x where x.a->>'type' = 'choice'),
  tot as (select count(*)::int total from acts),
  r as (
    select p.id pid, x.a, rsp.value #>> '{}' val
    from players p join responses rsp on rsp.player_id = p.id join acts x on x.a->>'id' = rsp.activity_id
    where p.session_id = p_session),
  sc as (
    select pid, count(*)::int answered,
      sum((select (o->>'points')::int from jsonb_array_elements(a->'options') o where o->>'id' = val)) pts,
      sum((select max((o->>'points')::int) from jsonb_array_elements(a->'options') o)) maxpts,
      sum(case when (select (o->>'correct')::boolean from jsonb_array_elements(a->'options') o where o->>'id' = val) then 1 else 0 end)::int correct
    from r group by pid)
  select p.id, p.board_name, coalesce(sc.answered, 0), tot.total,
    case (select snapshot->'scoring'->>'kind' from s)
      when 'behaviour' then case when sc.maxpts > 0 then round(100.0 * sc.pts / sc.maxpts)::int end
      when 'correct'   then case when tot.total > 0 then round(100.0 * coalesce(sc.correct, 0) / tot.total)::int end
    end,
    coalesce(sc.correct, 0),
    tot.total > 0 and coalesce(sc.answered, 0) >= ceil(tot.total * coalesce((select (snapshot->'scoring'->>'minAnsweredRatio')::numeric from s), 0.7))
  from players p left join sc on sc.pid = p.id cross join tot
  where p.session_id = p_session
$$;

create or replace function pp._distribution(p_session uuid, a jsonb, p_min int) returns jsonb language sql stable set search_path = pp as $$
  with v as (select rsp.value #>> '{}' val from responses rsp join players p on p.id = rsp.player_id
             where p.session_id = p_session and rsp.activity_id = a->>'id'),
  n as (select count(*)::int n from v)
  select jsonb_build_object('n', n.n, 'suppressed', n.n < p_min,
    'counts', case when n.n < p_min then '{}'::jsonb else coalesce((select jsonb_object_agg(val, c) from (select val, count(*)::int c from v group by val) g), '{}'::jsonb) end)
  from n
$$;

create or replace function pp._group(p_session uuid) returns jsonb language plpgsql stable set search_path = pp as $$
declare s sessions; mn int; nvalid int; avg_ int; bands jsonb := null;
begin
  select * into s from sessions where id = p_session;
  mn := coalesce((s.snapshot->'privacy'->>'groupMinimum')::int, 5);
  select count(*), round(avg(score))::int into nvalid, avg_ from _player_stats(p_session) where valid and score is not null;
  if nvalid < mn then
    return jsonb_build_object('joined', (select count(*) from lobby where session_id = p_session), 'valid', nvalid, 'average', null, 'bands', null, 'suppressed', true);
  end if;
  if nvalid >= 2 * mn then
    select jsonb_agg((select count(*) from _player_stats(p_session) st where st.valid and st.score between (b->>'min')::int and (b->>'max')::int) order by o)
      into bands from jsonb_array_elements(s.snapshot->'results') with ordinality as t(b, o);
  end if;
  return jsonb_build_object('joined', (select count(*) from lobby where session_id = p_session), 'valid', nvalid, 'average', avg_, 'bands', bands, 'suppressed', false);
end $$;

-- What phones may see of an activity: never points, correct flags or explanations before the reveal.
create or replace function pp._public_activity(a jsonb) returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', a->'id', 'type', a->'type', 'prompt', a->'prompt', 'theme', a->'theme',
    'shuffle', coalesce(a->'shuffle', 'true'::jsonb), 'min', a->'min', 'max', a->'max', 'minLabel', a->'minLabel', 'maxLabel', a->'maxLabel',
    'options', (select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', o->'id', 'text', o->'text', 'emoji', o->'emoji')) order by n)
                from jsonb_array_elements(a->'options') with ordinality as t(o, n))))
$$;

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
    'names', case when p_host then (select coalesce(jsonb_agg(jsonb_build_object('n', nickname, 'a', avatar) order by joined_at), '[]'::jsonb) from lobby where session_id = p_id) end
  ));
end $$;

-- ---------- Commands ----------
create or replace function pp.create_session(p_experience text, p_settings jsonb, p_host_user uuid default null)
returns jsonb language plpgsql set search_path = pp, extensions as $$
declare v experience_versions; e experiences; c text; tok text := encode(gen_random_bytes(24), 'hex'); sid uuid; st jsonb := '{}'; n int;
begin
  perform _rate('create', 30, interval '1 hour');
  delete from sessions where expires_at < now();
  select * into e from experiences where (slug = p_experience or id::text = p_experience) and status = 'published' and visibility in ('public', 'unlisted');
  if not found then raise exception 'experience not found'; end if;
  select * into v from experience_versions where experience_id = e.id order by version desc limit 1;
  if not found then raise exception 'experience has no published version'; end if;
  -- validated, whitelisted settings only
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
  insert into sessions(code, version_id, snapshot, settings, host_user, n_activities) values (c, v.id, v.content, st, p_host_user, n) returning id into sid;
  insert into session_secrets values (sid, _hash(tok));
  return jsonb_build_object('code', c, 'hostToken', tok, 'state', _state(sid, true));
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
    if s.stage <> 'activity' or s.phase <> 'answer' or s.paused then raise exception 'can only pause while answering'; end if;
    update sessions set paused = true, paused_remaining_ms = greatest(0, _ms(deadline) - _ms(now())), seq = seq + 1 where id = s.id;
  elsif p_cmd = 'resume' then
    if not s.paused then raise exception 'not paused'; end if;
    update sessions set paused = false, deadline = now() + make_interval(secs => paused_remaining_ms / 1000.0), paused_remaining_ms = null, seq = seq + 1 where id = s.id;
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

create or replace function pp.join_session(p_code text, p_nickname text, p_avatar text, p_board_name text, p_consent boolean)
returns jsonb language plpgsql set search_path = pp, extensions as $$
declare s sessions; tok text := encode(gen_random_bytes(24), 'hex'); nick text := left(trim(coalesce(p_nickname, '')), 20); bn text := nullif(left(trim(coalesce(p_board_name, '')), 20), '');
begin
  perform _rate('join', 300, interval '10 minutes');
  if not coalesce(p_consent, false) then raise exception 'please confirm that you want to take part'; end if;
  if nick = '' then raise exception 'please enter a nickname'; end if;
  s := _session(p_code);
  if s.id is null then raise exception 'no game with that code'; end if;
  if s.stage not in ('lobby', 'intro', 'activity') then raise exception 'this game has already finished'; end if;
  if (select count(*) from lobby where session_id = s.id) >= 200 then raise exception 'this game is full'; end if;
  if bn is not null and not coalesce((s.settings->>'leaderboard')::boolean, false) then bn := null; end if;
  insert into lobby(session_id, nickname, avatar) values (s.id, nick, coalesce(nullif(left(p_avatar, 8), ''), '🙂'));
  insert into players(session_id, token_hash, board_name) values (s.id, _hash(tok), bn);
  return jsonb_build_object('token', tok, 'state', _state(s.id, false));
end $$;

create or replace function pp.submit(p_token text, p_activity text, p_value jsonb) returns text
language plpgsql set search_path = pp as $$
declare pl players; s sessions; a jsonb; v text;
begin
  select * into pl from players where token_hash = _hash(coalesce(p_token, ''));
  if not found then return 'unknown_player'; end if;
  perform _tick(pl.session_id);
  select * into s from sessions where id = pl.session_id;
  if s.stage <> 'activity' or s.phase <> 'answer' or s.paused then return 'not_open'; end if;
  a := _activity(s.snapshot, s.idx);
  if a->>'id' <> p_activity then return 'not_open'; end if;
  if now() > s.deadline + interval '400 milliseconds' then return 'late'; end if;
  v := p_value #>> '{}';
  if a->>'type' in ('choice', 'poll') then
    if jsonb_typeof(p_value) <> 'string' or not exists(select 1 from jsonb_array_elements(a->'options') o where o->>'id' = v) then return 'invalid'; end if;
  elsif a->>'type' = 'scale' then
    if jsonb_typeof(p_value) <> 'number' or v::numeric <> floor(v::numeric) or v::int not between (a->>'min')::int and (a->>'max')::int then return 'invalid'; end if;
  elsif a->>'type' = 'reflection' then
    return 'private';  -- reflections never leave the phone
  else return 'invalid'; end if;
  insert into responses(player_id, activity_id, value) values (pl.id, p_activity, p_value) on conflict do nothing;
  if not found then return 'duplicate'; end if;
  return 'ok';
end $$;

-- A participant's own data: requires their token. Never exposes anyone else.
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

create or replace function pp.forget_me(p_token text) returns void language sql set search_path = pp as
$$ delete from players where token_hash = _hash(coalesce(p_token, '')) $$;

create or replace function pp.state(p_code text) returns jsonb language plpgsql set search_path = pp as $$
declare s sessions;
begin
  s := _session(p_code);
  if s.id is null then return jsonb_build_object('now', _ms(now()), 'ended', true); end if;
  perform _tick(s.id);
  return _state(s.id, false);
end $$;

create or replace function pp.host_state(p_code text, p_token text) returns jsonb language plpgsql set search_path = pp as $$
declare s sessions;
begin
  s := _session(p_code);
  if s.id is null then return jsonb_build_object('now', _ms(now()), 'ended', true); end if;
  if not _is_host(s.id, p_token) then raise exception 'not host'; end if;
  perform _tick(s.id);
  return _state(s.id, true);
end $$;

revoke all on all functions in schema pp from public, anon, authenticated;
revoke all on all tables in schema pp from public, anon, authenticated;

-- ---------- Public API (the only client entry points) ----------
create or replace function public.pp_state(p_code text) returns jsonb language sql security definer set search_path = '' as $$ select pp.state(p_code) $$;
create or replace function public.pp_create_session(p_experience text, p_settings jsonb default '{}') returns jsonb language sql security definer set search_path = '' as
  $$ select pp.create_session(p_experience, coalesce(p_settings, '{}'::jsonb), auth.uid()) $$;
create or replace function public.pp_host_state(p_code text, p_token text) returns jsonb language sql security definer set search_path = '' as $$ select pp.host_state(p_code, p_token) $$;
create or replace function public.pp_host_command(p_code text, p_token text, p_cmd text, p_args jsonb default '{}') returns jsonb language sql security definer set search_path = '' as
  $$ select pp.host_command(p_code, p_token, p_cmd, coalesce(p_args, '{}'::jsonb)) $$;
create or replace function public.pp_join(p_code text, p_nickname text, p_avatar text default null, p_board_name text default null, p_consent boolean default false) returns jsonb
  language sql security definer set search_path = '' as $$ select pp.join_session(p_code, p_nickname, p_avatar, p_board_name, p_consent) $$;
create or replace function public.pp_submit(p_token text, p_activity text, p_value jsonb) returns text language sql security definer set search_path = '' as $$ select pp.submit(p_token, p_activity, p_value) $$;
create or replace function public.pp_my_state(p_token text) returns jsonb language sql security definer set search_path = '' as $$ select pp.my_state(p_token) $$;
create or replace function public.pp_forget_me(p_token text) returns void language sql security definer set search_path = '' as $$ select pp.forget_me(p_token) $$;

revoke all on function public.pp_state(text), public.pp_create_session(text, jsonb), public.pp_host_state(text, text), public.pp_host_command(text, text, text, jsonb),
  public.pp_join(text, text, text, text, boolean), public.pp_submit(text, text, jsonb), public.pp_my_state(text), public.pp_forget_me(text) from public;
grant execute on function public.pp_state(text), public.pp_create_session(text, jsonb), public.pp_host_state(text, text), public.pp_host_command(text, text, text, jsonb),
  public.pp_join(text, text, text, text, boolean), public.pp_submit(text, text, jsonb), public.pp_my_state(text), public.pp_forget_me(text) to anon, authenticated;
