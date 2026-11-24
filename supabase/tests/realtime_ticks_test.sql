-- Uses a stand-in realtime.send that records calls (production uses Supabase's).
create schema if not exists realtime;
create table if not exists realtime.sent(topic text, event text, payload jsonb, private boolean);
create or replace function realtime.send(payload jsonb, event text, topic text, private boolean default true) returns void language sql as $$ insert into realtime.sent values (topic, event, payload, private) $$;
truncate realtime.sent;
create temp table t(name text, ok boolean, detail text);
grant all on t to anon;
set role anon;
do $$ declare c jsonb; code text; h text; tok text; n int; begin
  c := public.pp_create_session('would-you-rather', '{}'); code := c->>'code'; h := c->>'hostToken';
  tok := public.pp_join(code, 'A', null, null, true)->>'token';
  perform public.pp_host_command(code, h, 'next'); perform public.pp_host_command(code, h, 'next'); perform public.pp_host_command(code, h, 'next');
  perform public.pp_submit(tok, 'w1', '"a"');
  perform public.pp_host_command(code, h, 'end');
  perform set_config('t.code', code, false);
end $$;
reset role;
insert into t select 'ticks: join, 3 steps, answer and end each pushed a tick', count(*) >= 6, count(*)::text from realtime.sent where topic = 'pp-room-' || current_setting('t.code');
insert into t select 'ticks: carry no data and use a public topic', bool_and(payload = '{}'::jsonb and event = 'tick' and private = false), null from realtime.sent;
create or replace function realtime.send(payload jsonb, event text, topic text, private boolean default true) returns void language plpgsql as $$ begin raise exception 'realtime down'; end $$;
set role anon;
do $$ declare ok boolean; begin
  perform public.pp_create_session('would-you-rather', '{}'); ok := true;
  insert into t values ('ticks: a failing push channel never breaks the game', ok, null);
exception when others then insert into t values ('ticks: a failing push channel never breaks the game', false, sqlerrm); end $$;
reset role;
drop schema realtime cascade;
select case when ok then 'PASS' else 'FAIL' end || '  ' || name from t order by ok, name;
select count(*) filter (where ok) || ' passed, ' || count(*) filter (where not ok) || ' failed' from t;
