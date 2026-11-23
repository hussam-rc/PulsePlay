-- Ego Check LIVE (PulsePlay): isolated inside an existing Supabase project.
-- Everything lives in schema "egocheck". The only objects outside it are 8 public
-- wrapper functions named egocheck_* (the API entry points). Nothing existing is altered.
create schema if not exists egocheck;
revoke all on schema egocheck from public, anon, authenticated;
-- SECURITY DEFINER functions; the server clock decides deadlines.


-- ---------- Tables ----------
create table egocheck.rooms (
  code             text primary key check (code ~ '^[0-9]{6}$'),
  stage            text not null default 'welcome'
                   check (stage in ('welcome','join','ready','q','results','company','reflect','ended')),
  q                int  not null default 0 check (q between 0 and 9),
  phase            text check (phase in ('count','read','answer','locked')),
  read_ms          int  not null default 5000 check (read_ms between 1000 and 30000),
  ans_ms           int  not null default 3000 check (ans_ms between 1000 and 60000),
  phase_started_at timestamptz not null default now(),
  answer_deadline  timestamptz,
  seq              int  not null default 1,
  created_at       timestamptz not null default now(),
  expires_at       timestamptz not null default now() + interval '24 hours'
);

create table egocheck.room_secrets (          -- host credential, never readable by clients
  code       text primary key references egocheck.rooms(code) on delete cascade,
  token_hash text not null
);

create table egocheck.lobby (                 -- attendance only: what the projector shows
  id         uuid primary key default gen_random_uuid(),
  room_code  text not null references egocheck.rooms(code) on delete cascade,
  nickname   text not null check (char_length(nickname) between 1 and 20),
  joined_at  timestamptz not null default now()
);

create table egocheck.players (               -- answer identity: NO nickname, NO link to lobby
  id         uuid primary key default gen_random_uuid(),
  room_code  text not null references egocheck.rooms(code) on delete cascade,
  token_hash text not null unique
);

create table egocheck.answers (
  player_id  uuid not null references egocheck.players(id) on delete cascade,
  q          int  not null check (q between 0 and 9),
  option     int  not null check (option between 0 and 3),
  primary key (player_id, q)                -- duplicate answers impossible
);

create table egocheck.question_points (       -- transparent rubric, mirrors the app (0 = reflective, 3 = ego)
  q int, option int, points int not null check (points between 0 and 3), primary key (q, option)
);
insert into egocheck.question_points values
 (0,0,3),(0,1,2),(0,2,0),(0,3,0), (1,0,2),(1,1,3),(1,2,0),(1,3,0),
 (2,0,0),(2,1,2),(2,2,3),(2,3,0), (3,0,2),(3,1,0),(3,2,0),(3,3,3),
 (4,0,0),(4,1,0),(4,2,3),(4,3,2), (5,0,2),(5,1,0),(5,2,3),(5,3,0),
 (6,0,2),(6,1,0),(6,2,3),(6,3,0), (7,0,2),(7,1,0),(7,2,3),(7,3,0),
 (8,0,0),(8,1,3),(8,2,0),(8,3,2), (9,0,3),(9,1,0),(9,2,1),(9,3,0);

-- ---------- RLS: clients read only public state; everything else via functions ----------
alter table egocheck.rooms           enable row level security;
alter table egocheck.room_secrets    enable row level security;
alter table egocheck.lobby           enable row level security;
alter table egocheck.players         enable row level security;
alter table egocheck.answers         enable row level security;
alter table egocheck.question_points enable row level security;

create policy rooms_read on egocheck.rooms for select to anon, authenticated using (stage <> 'ended');
create policy lobby_read on egocheck.lobby for select to anon, authenticated using (true);
-- No policies on room_secrets / players / answers / question_points => no direct access.


-- ---------- Helpers ----------
create or replace function egocheck._hash(t text) returns text
language sql immutable set search_path = egocheck, extensions as $$ select encode(digest(t, 'sha256'), 'hex') $$;

create or replace function egocheck._host_ok(p_code text, p_token text) returns boolean
language sql stable security definer set search_path = egocheck, extensions as $$
  select exists(select 1 from room_secrets where code = p_code and token_hash = _hash(p_token))
$$;

-- ---------- Host functions ----------
create or replace function egocheck.create_room(p_read_s int default 5, p_ans_s int default 3)
returns table(code text, host_token text)
language plpgsql security definer set search_path = egocheck, extensions as $$
declare c text; t text := encode(gen_random_bytes(24), 'hex');
begin
  perform purge_expired();
  loop
    c := lpad((floor(random()*900000)+100000)::int::text, 6, '0');
    exit when not exists(select 1 from rooms r where r.code = c);
  end loop;
  insert into rooms(code, read_ms, ans_ms) values (c, p_read_s*1000, p_ans_s*1000);
  insert into room_secrets values (c, _hash(t));
  return query select c, t;
end $$;

-- p_action: 'next' | 'set_timer' | 'end'
create or replace function egocheck.host_advance(p_code text, p_token text, p_action text,
  p_read_s int default null, p_ans_s int default null)
returns egocheck.rooms language plpgsql security definer set search_path = egocheck, extensions as $$
declare r rooms;
begin
  if not _host_ok(p_code, p_token) then raise exception 'not host'; end if;
  select * into r from rooms where code = p_code for update;
  if p_action = 'end' then
    update rooms set stage = 'ended', seq = seq + 1 where code = p_code returning * into r;
    delete from rooms where code = p_code;        -- cascades lobby, players, answers
    return r;
  elsif p_action = 'set_timer' and r.stage = 'q' then
    return r;
  elsif p_action = 'set_timer' then
    update rooms set read_ms = coalesce(p_read_s*1000, read_ms), ans_ms = coalesce(p_ans_s*1000, ans_ms), seq = seq + 1
      where code = p_code returning * into r;
    return r;
  end if;
  if p_action <> 'next' then raise exception 'bad action'; end if;
  -- state machine, server clock decides
  if r.stage = 'welcome' then update rooms set stage='join', phase=null where code=p_code;
  elsif r.stage = 'join'  then update rooms set stage='ready', phase=null where code=p_code;
  elsif r.stage = 'ready' and r.phase is null then update rooms set phase='count', phase_started_at=now() where code=p_code;
  elsif r.stage = 'ready' and r.phase = 'count' then
    update rooms set stage='q', q=0, phase='read', phase_started_at=now(), answer_deadline=null where code=p_code;
  elsif r.stage = 'q' and r.phase = 'read' then
    update rooms set phase='answer', phase_started_at=now(),
      answer_deadline = now() + make_interval(secs => ans_ms/1000.0) where code=p_code;
  elsif r.stage = 'q' and r.phase = 'answer' then
    if now() < r.answer_deadline and not (
         (select count(*) from lobby where room_code = p_code) > 0 and
         answer_count(p_code, r.q) >= (select count(*) from lobby where room_code = p_code)) then
      raise exception 'answer window still open'; end if;
    update rooms set phase='locked', phase_started_at=now() where code=p_code;
  elsif r.stage = 'q' and r.phase = 'locked' then
    if r.q < 9 then update rooms set q=q+1, phase='read', phase_started_at=now(), answer_deadline=null where code=p_code;
    else update rooms set stage='results', phase=null where code=p_code; end if;
  elsif r.stage = 'results' then update rooms set stage='company' where code=p_code;
  elsif r.stage = 'company' then update rooms set stage='reflect' where code=p_code;
  end if;
  update rooms set seq = seq + 1 where code = p_code returning * into r;
  return r;
end $$;

-- live count for the projector: numbers only
create or replace function egocheck.answer_count(p_code text, p_q int) returns int
language sql stable security definer set search_path = egocheck, extensions as $$
  select count(*)::int from answers a join players p on p.id = a.player_id
  where p.room_code = p_code and a.q = p_q
$$;

-- team result: only after the reveal, only valid games (>=7 answered), only if >=5 of them
create or replace function egocheck.team_result(p_code text)
returns table(valid_n int, joined_n int, avg_score int, dist int[])
language plpgsql stable security definer set search_path = egocheck, extensions as $$
declare st text;
begin
  select stage into st from rooms where code = p_code;
  if st not in ('company','reflect') then raise exception 'not revealed yet'; end if;
  return query
  with s as (
    select p.id, count(*) n, round(100.0*sum(qp.points)/(3*count(*)))::int sc
    from players p join answers a on a.player_id = p.id
    join question_points qp on qp.q = a.q and qp.option = a.option
    where p.room_code = p_code group by p.id having count(*) >= 7)
  select (select count(*) from s)::int,
         (select count(*) from lobby where room_code = p_code)::int,
         case when (select count(*) from s) >= 5 then (select round(avg(sc))::int from s) end,
         case when (select count(*) from s) >= 10 then array[
           (select count(*) from s where sc<=25)::int, (select count(*) from s where sc between 26 and 50)::int,
           (select count(*) from s where sc between 51 and 75)::int, (select count(*) from s where sc>=76)::int] end;
end $$;

-- ---------- Participant functions ----------
create or replace function egocheck.join_room(p_code text, p_nickname text)
returns table(lobby_id uuid, player_token text)
language plpgsql security definer set search_path = egocheck, extensions as $$
declare t text := encode(gen_random_bytes(24), 'hex'); l uuid;
begin
  if not exists(select 1 from rooms where code = p_code and stage <> 'ended' and expires_at > now()) then
    raise exception 'room not found'; end if;
  insert into lobby(room_code, nickname) values (p_code, left(trim(p_nickname), 20)) returning id into l;
  insert into players(room_code, token_hash) values (p_code, _hash(t));   -- separate row, no link to lobby
  return query select l, t;
end $$;

create or replace function egocheck.submit_answer(p_token text, p_q int, p_option int)
returns text language plpgsql security definer set search_path = egocheck, extensions as $$
declare pl players; r rooms;
begin
  select * into pl from players where token_hash = _hash(p_token);
  if pl.id is null then return 'unknown_player'; end if;
  select * into r from rooms where code = pl.room_code;
  if r.stage <> 'q' or r.q <> p_q or r.phase <> 'answer' then return 'not_open'; end if;
  if now() > r.answer_deadline + interval '400 milliseconds' then return 'late'; end if;  -- small network grace
  insert into answers(player_id, q, option) values (pl.id, p_q, p_option) on conflict do nothing;
  if not found then return 'duplicate'; end if;
  return 'ok';
end $$;

-- private result: only the token holder can read it (token lives on the phone; reconnect = same token)
create or replace function egocheck.my_result(p_token text)
returns table(answered int, score int, answers int[])
language sql stable security definer set search_path = egocheck, extensions as $$
  select count(a.q)::int,
         case when count(a.q) > 0 then round(100.0*sum(qp.points)/(3*count(a.q)))::int end,
         array(select coalesce((select a2.option from answers a2 where a2.player_id = p.id and a2.q = g), -1)
               from generate_series(0,9) g)
  from players p left join answers a on a.player_id = p.id
  left join question_points qp on qp.q = a.q and qp.option = a.option
  where p.token_hash = _hash(p_token) group by p.id
$$;

create or replace function egocheck.forget_me(p_token text) returns void
language sql security definer set search_path = egocheck, extensions as $$
  delete from players where token_hash = _hash(p_token)
$$;

-- ---------- Retention ----------
create or replace function egocheck.purge_expired() returns void
language sql security definer set search_path = egocheck, extensions as $$
  delete from rooms where expires_at < now()
$$;
-- Expired rooms are purged whenever a new room is created (no cron job added to the shared project).


-- ---------- JSON API used by the web client (polling, no realtime needed) ----------
create or replace function egocheck._ms(t timestamptz) returns bigint
language sql immutable set search_path = egocheck as $$ select (extract(epoch from t)*1000)::bigint $$;

create or replace function egocheck._pub(r egocheck.rooms) returns jsonb
language sql stable set search_path = egocheck as $$
  select case when r.code is null then null else jsonb_build_object(
    'stage', r.stage, 'q', r.q, 'phase', r.phase, 'readMs', r.read_ms, 'ansMs', r.ans_ms, 'seq', r.seq,
    'phaseAt', _ms(r.phase_started_at), 'deadline', _ms(r.answer_deadline)) end
$$;

create or replace function egocheck.room_state(p_code text) returns jsonb
language sql stable security definer set search_path = egocheck, extensions as $$
  select jsonb_build_object('now', _ms(now()), 'room',
    (select _pub(r) from rooms r where r.code = p_code and r.stage <> 'ended' and r.expires_at > now()))
$$;

create or replace function egocheck.host_state(p_code text, p_token text) returns jsonb
language plpgsql stable security definer set search_path = egocheck, extensions as $$
declare r rooms; team jsonb := null;
begin
  if not _host_ok(p_code, p_token) then raise exception 'not host'; end if;
  select * into r from rooms where code = p_code;
  if r.stage in ('company','reflect') then
    select jsonb_build_object('n', t.valid_n, 'avg', t.avg_score, 'dist', to_jsonb(t.dist)) into team from team_result(p_code) t;
  end if;
  return jsonb_build_object(
    'now', _ms(now()), 'room', _pub(r),
    'names', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'n', l.nickname) order by l.joined_at) from lobby l where l.room_code = p_code), '[]'::jsonb),
    'counts', (select jsonb_agg(answer_count(p_code, g) order by g) from generate_series(0,9) g),
    'finished', (select count(*) from (select p.id from players p join answers a on a.player_id = p.id
                  where p.room_code = p_code group by p.id having count(*) >= 7) f),
    'team', team);
end $$;

create or replace function egocheck.host_step(p_code text, p_token text, p_action text,
  p_read_s int default null, p_ans_s int default null) returns jsonb
language plpgsql security definer set search_path = egocheck, extensions as $$
declare r rooms;
begin
  r := host_advance(p_code, p_token, p_action, p_read_s, p_ans_s);
  if p_action = 'end' then return jsonb_build_object('now', _ms(now()), 'room', null); end if;
  return jsonb_build_object('now', _ms(now()), 'room', _pub(r));
end $$;

create or replace function egocheck.create_room_json(p_read_s int default 5, p_ans_s int default 3) returns jsonb
language plpgsql security definer set search_path = egocheck, extensions as $$
declare c record;
begin
  if p_read_s not in (3,5,8) or p_ans_s not in (3,5,8,12,20) then raise exception 'bad timer'; end if;
  select * into c from create_room(p_read_s, p_ans_s);
  return jsonb_build_object('code', c.code, 'hostToken', c.host_token, 'now', _ms(now()));
end $$;

create or replace function egocheck.join_json(p_code text, p_nickname text) returns jsonb
language plpgsql security definer set search_path = egocheck, extensions as $$
declare j record;
begin
  if length(trim(coalesce(p_nickname,''))) = 0 then raise exception 'no nickname'; end if;
  if (select count(*) from lobby where room_code = p_code) >= 80 then raise exception 'room full'; end if;
  select * into j from join_room(p_code, p_nickname);
  return jsonb_build_object('lobbyId', j.lobby_id, 'token', j.player_token, 'now', _ms(now()));
end $$;

create or replace function egocheck.me_json(p_token text) returns jsonb
language sql stable security definer set search_path = egocheck, extensions as $$
  select jsonb_build_object('now', _ms(now()), 'answers',
    (select to_jsonb(answers) from my_result(p_token)))
$$;


-- ---------- Lock down the schema (no direct client access at all) ----------
revoke all on all tables in schema egocheck from public, anon, authenticated;
revoke all on all functions in schema egocheck from public, anon, authenticated;

-- ---------- Public API: thin wrappers, the only objects outside the schema ----------
create or replace function public.egocheck_room_state(p_code text) returns jsonb
language sql security definer set search_path = '' as $$ select egocheck.room_state(p_code) $$;
create or replace function public.egocheck_host_state(p_code text, p_token text) returns jsonb
language sql security definer set search_path = '' as $$ select egocheck.host_state(p_code, p_token) $$;
create or replace function public.egocheck_host_step(p_code text, p_token text, p_action text, p_read_s int default null, p_ans_s int default null) returns jsonb
language sql security definer set search_path = '' as $$ select egocheck.host_step(p_code, p_token, p_action, p_read_s, p_ans_s) $$;
create or replace function public.egocheck_create_room_json(p_read_s int default 5, p_ans_s int default 3) returns jsonb
language sql security definer set search_path = '' as $$ select egocheck.create_room_json(p_read_s, p_ans_s) $$;
create or replace function public.egocheck_join_json(p_code text, p_nickname text) returns jsonb
language sql security definer set search_path = '' as $$ select egocheck.join_json(p_code, p_nickname) $$;
create or replace function public.egocheck_me_json(p_token text) returns jsonb
language sql security definer set search_path = '' as $$ select egocheck.me_json(p_token) $$;
create or replace function public.egocheck_submit_answer(p_token text, p_q int, p_option int) returns text
language sql security definer set search_path = '' as $$ select egocheck.submit_answer(p_token, p_q, p_option) $$;
create or replace function public.egocheck_forget_me(p_token text) returns void
language sql security definer set search_path = '' as $$ select egocheck.forget_me(p_token) $$;

-- To remove the game completely later:
--   drop schema egocheck cascade;
--   drop function public.egocheck_room_state(text), public.egocheck_host_state(text,text),
--     public.egocheck_host_step(text,text,text,int,int), public.egocheck_create_room_json(int,int),
--     public.egocheck_join_json(text,text), public.egocheck_me_json(text),
--     public.egocheck_submit_answer(text,int,int), public.egocheck_forget_me(text);
