-- Live rooms: push an empty "tick" on Supabase Realtime (public broadcast topic pp-room-<code>) whenever a room changes.
-- The tick carries no data (no names, answers or scores); screens then fetch state through the existing RPCs.
-- Safe: if Realtime is unavailable, or sending fails, the game continues on polling. Additive.
-- Rollback: drop trigger pp_tick_sessions on pp.sessions; drop trigger pp_tick_sessions_del on pp.sessions;
--           drop trigger pp_tick_players on pp.players; drop trigger pp_tick_responses on pp.responses;
--           drop function pp._tick_send(text); drop function pp._tick_trg();
create or replace function pp._tick_send(p_code text) returns void language plpgsql security definer set search_path = pp as $$
begin
  if p_code is null or to_regprocedure('realtime.send(jsonb,text,text,boolean)') is null then return; end if;
  execute 'select realtime.send($1, $2, $3, false)' using '{}'::jsonb, 'tick', 'pp-room-' || p_code;
exception when others then null;          -- never let the push channel break a game
end $$;
revoke all on function pp._tick_send(text) from public, anon, authenticated;

create or replace function pp._tick_trg() returns trigger language plpgsql security definer set search_path = pp as $$
begin
  if tg_table_name = 'sessions' then
    if tg_op = 'DELETE' then perform _tick_send(old.code);
    elsif new.seq is distinct from old.seq or new.paused is distinct from old.paused then perform _tick_send(new.code); end if;
  elsif tg_table_name = 'players' then
    perform _tick_send((select code from sessions where id = new.session_id));
  else
    perform _tick_send((select s.code from players p join sessions s on s.id = p.session_id where p.id = new.player_id));
  end if;
  return null;
end $$;
revoke all on function pp._tick_trg() from public, anon, authenticated;
create trigger pp_tick_sessions after update on pp.sessions for each row execute function pp._tick_trg();
create trigger pp_tick_sessions_del after delete on pp.sessions for each row execute function pp._tick_trg();
create trigger pp_tick_players after insert on pp.players for each row execute function pp._tick_trg();
create trigger pp_tick_responses after insert on pp.responses for each row execute function pp._tick_trg();
