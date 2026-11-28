-- Open Answer questions: submission rules, moderation, privacy and scoring isolation. Runs on a clean local database (CI).
create temp table t(name text, ok boolean, detail text);
grant all on t to anon, authenticated;

-- An experience mixing a scored choice with three open questions (cloud with approval, live wall, list shown only after closing).
do $$ declare base jsonb; eid uuid; begin
  select content into base from pp.experience_versions v join pp.experiences e on e.id = v.experience_id where e.slug = 'ego-check' order by version desc limit 1;
  insert into pp.experiences(slug, title, visibility, status, built_in) values ('open-test', 'Open test', 'public', 'published', false) returning id into eid;
  insert into pp.experience_versions(experience_id, version, content, schema_version) values (eid, 1, (base - 'insights' - 'bank') || jsonb_build_object('id', 'open-test',
    'rounds', jsonb_build_array(jsonb_build_object('id', 'main', 'activities', jsonb_build_array(
      jsonb_build_object('id', 'w1', 'type', 'open', 'prompt', 'Describe our team in one word', 'display', 'cloud', 'maxChars', 25, 'maxWords', 1,
        'maxResponses', 3, 'submitSec', 0, 'editSec', 2, 'moderation', 'approve', 'showAnswers', 'live'),
      jsonb_build_object('id', 'c1', 'type', 'choice', 'prompt', 'Scored', 'shuffle', true,
        'options', '[{"id":"a","text":"A","points":0},{"id":"b","text":"B","points":3}]'::jsonb),
      jsonb_build_object('id', 'w2', 'type', 'open', 'prompt', 'One idea', 'display', 'wall', 'maxChars', 80, 'maxResponses', 1, 'submitSec', 30,
        'editSec', 0, 'moderation', 'live', 'showAnswers', 'live'),
      jsonb_build_object('id', 'w3', 'type', 'open', 'prompt', 'Hidden until closed', 'display', 'list', 'maxChars', 140, 'maxResponses', 1, 'submitSec', 30,
        'editSec', 10, 'moderation', 'live', 'showAnswers', 'closed'))))), 1);
end $$;

create or replace function pg_temp.room() returns jsonb language plpgsql as $$
begin perform set_config('request.headers', json_build_object('x-real-ip', 'oa-' || gen_random_uuid())::text, true); return public.pp_create_session('open-test', '{}'); end $$;
create or replace function pg_temp.sql(q text) returns text language plpgsql security definer as $$ declare r text; begin execute q into r; return r; end $$;

set role anon;
do $$
declare c jsonb; code text; h text; toks text[] := '{}'; r jsonb; st jsonb; id1 text; my jsonb; i int; hs jsonb;
begin
  c := pg_temp.room(); code := c->>'code'; h := c->>'hostToken';
  for i in 1..6 loop toks := toks || (public.pp_join(code, 'P' || i, '🦊', null, true)->>'token'); end loop;
  perform public.pp_host_command(code, h, 'next'); perform public.pp_host_command(code, h, 'next');   -- intro -> w1 read
  r := public.pp_open_submit(toks[1], 'w1', 'Kind');
  insert into t values ('not open during the reading time', r->>'status' = 'not_open', r::text);
  perform public.pp_host_command(code, h, 'next');                                                   -- read -> answer
  st := public.pp_state(code);
  insert into t values ('submitSec 0: open until the host closes it (deadline far away)', (st->>'deadline')::bigint - (st->>'now')::bigint > 3600 * 1000, null);

  r := public.pp_open_submit(toks[1], 'w1', '  Kind  '); id1 := r->>'id';
  insert into t values ('submit: ok, trimmed, with an edit window', r->>'status' = 'ok' and (r->>'editUntil')::bigint > 0, r::text);
  r := public.pp_open_submit(toks[1], 'w1', 'KIND!');
  insert into t values ('same answer again (case/punctuation) = duplicate, nothing stored', r->>'status' = 'duplicate' and r->>'id' = id1, r::text);
  insert into t values ('too many words rejected', public.pp_open_submit(toks[1], 'w1', 'very kind')->>'status' = 'too_many_words', null);
  insert into t values ('too long rejected', public.pp_open_submit(toks[1], 'w1', repeat('x', 26))->>'status' = 'too_long', null);
  insert into t values ('empty / only spaces rejected', public.pp_open_submit(toks[1], 'w1', '   ')->>'status' = 'empty', null);
  insert into t values ('only punctuation rejected', public.pp_open_submit(toks[1], 'w1', '!!!')->>'status' = 'empty', null);
  insert into t values ('links rejected', public.pp_open_submit(toks[2], 'w1', 'www.spam.com')->>'status' = 'link'
                        and public.pp_open_submit(toks[2], 'w1', 'evil.ru')->>'status' = 'link' and public.pp_open_submit(toks[2], 'w1', '@someone')->>'status' = 'link', null);
  insert into t values ('oversized input rejected before processing', public.pp_open_submit(toks[2], 'w1', repeat('a', 1001))->>'status' = 'invalid', null);
  insert into t values ('unknown token rejected', public.pp_open_submit('nope', 'w1', 'x')->>'status' = 'unknown_player', null);
  insert into t values ('wrong question rejected', public.pp_open_submit(toks[2], 'w2', 'x')->>'status' = 'not_open', null);
  r := public.pp_open_submit(toks[1], 'w1', 'Smart'); r := public.pp_open_submit(toks[1], 'w1', 'Fast');
  insert into t values ('maxResponses: a 4th answer is refused', public.pp_open_submit(toks[1], 'w1', 'Funny')->>'status' = 'limit', null);

  -- HTML and control characters are stored as plain text, never interpreted; bidi overrides removed
  r := public.pp_open_submit(toks[3], 'w1', '<b>x</b>');
  insert into t values ('HTML-like text: stored as plain text and held for review (reason markup)', r->>'status' = 'ok'
                        and pg_temp.sql(format('select flagged::text || reason from pp.open_answers where id = %L', r->>'id')) = 'truemarkup', r::text);
  insert into t values ('markup detection: entities, script URLs, template syntax', pg_temp.sql($q$select (pp._open_markup('&lt;') and pp._open_markup('javascript:x') and pp._open_markup('{{x}}')
                        and pp._open_markup('${x}') and not pp._open_markup('5 < 6') and not pp._open_markup('R&D'))::text$q$) = 'true', null);
  r := public.pp_open_submit(toks[3], 'w1', E'Te‮am');
  insert into t values ('bidi override character removed', r->>'status' = 'too_many_words' or pg_temp.sql(format('select body from pp.open_answers where id = %L', r->>'id')) = 'Te am', r::text);
  -- Arabic and accents, grouped case-insensitively but never merged across different words
  perform public.pp_open_submit(toks[4], 'w1', 'kind'); perform public.pp_open_submit(toks[5], 'w1', 'Kind.');
  perform public.pp_open_submit(toks[6], 'w1', 'لطيف'); perform public.pp_open_submit(toks[5], 'w1', 'لطيفٌ'); perform public.pp_open_submit(toks[4], 'w1', 'gentil');
  -- basic filter: flagged answers wait for the host
  r := public.pp_open_submit(toks[6], 'w1', 'sh1t');
  insert into t values ('filter: leetspeak profanity flagged', pg_temp.sql(format('select flagged::text from pp.open_answers where id = %L', r->>'id')) = 'true', r::text);
  r := public.pp_open_submit(toks[2], 'w1', 'Scheisse');
  insert into t values ('filter: German flagged', pg_temp.sql(format('select flagged::text from pp.open_answers where id = %L', r->>'id')) = 'true', r::text);
  r := public.pp_open_submit(toks[2], 'w1', 'Shitake');
  insert into t values ('filter: no false positive on a word containing a blocked word', pg_temp.sql(format('select flagged::text from pp.open_answers where id = %L', r->>'id')) = 'false', r::text);

  st := public.pp_state(code);
  insert into t values ('public state: counts only, no answer texts, no ids', (st->'open') ? 'n' and not (st->'open') ? 'items' and st::text not like '%Smart%' and st::text not like '%gentil%', st->>'open');
  insert into t values ('answered = people who answered (not answers)', (st->>'answered')::int = 6, st->>'answered');
  hs := public.pp_host_state(code, h);
  insert into t values ('counts: received = shown + pending + removed', (hs->'open'->>'n')::int = (hs->'open'->>'shown')::int + (hs->'open'->>'pending')::int + (hs->'open'->>'removed')::int, hs->>'open');
  insert into t values ('approval mode: every answer waits (pending), host sees them', (hs->'open'->>'pending')::int = (hs->'open'->>'n')::int
                        and jsonb_array_length(hs->'open'->'items') >= 12, hs->'open'->>'pending');
  insert into t values ('host items carry no nickname or player id', hs->'open'->'items'->0 ?& array['id','t','k','s','f','at'] and not hs->'open'->'items'->0 ? 'player_id'
                        and (hs->'open')::text not like '%P1%', null);
  insert into t values ('grouping key: Kind / kind / Kind. share one key', (select count(distinct x->>'k') from jsonb_array_elements(hs->'open'->'items') x where lower(x->>'t') like 'kind%') = 1, null);
  insert into t values ('grouping key: Arabic vowel marks ignored, translations not merged', (select count(distinct x->>'k') from jsonb_array_elements(hs->'open'->'items') x where x->>'t' in ('لطيف','لطيفٌ')) = 1
                        and (select count(distinct x->>'k') from jsonb_array_elements(hs->'open'->'items') x where x->>'t' in ('kind','gentil','لطيف')) = 3, null);

  -- moderation
  -- permissions: a participant token is never a host token, a wrong token never moderates
  begin perform public.pp_host_command(code, toks[1], 'open_approve', jsonb_build_object('ids', (select jsonb_agg(x->'id') from jsonb_array_elements(hs->'open'->'items') x)));
    insert into t values ('participant cannot approve (host_command with a player token)', false, null);
  exception when others then insert into t values ('participant cannot approve (host_command with a player token)', sqlerrm like '%not host%', sqlerrm); end;
  begin perform public.pp_host_command(code, 'wrong-token', 'open_hide', jsonb_build_object('ids', jsonb_build_array(id1)));
    insert into t values ('wrong token cannot remove', false, null);
  exception when others then insert into t values ('wrong token cannot remove', sqlerrm like '%not host%', sqlerrm); end;
  begin perform public.pp_host_command(code, toks[2], 'open_reveal');
    insert into t values ('participant cannot reveal or clear', false, null);
  exception when others then insert into t values ('participant cannot reveal or clear', sqlerrm like '%not host%', sqlerrm); end;
  insert into t values ('no moderation happened through the refused calls', pg_temp.sql('select count(*) from pp.open_answers where status <> ''pending''') = '0', null);
  -- "show all" without the host's list approves nothing; with the list, never flagged ones and never later arrivals
  perform public.pp_host_command(code, h, 'open_approve', '{"all": true}');
  insert into t values ('show all without a list approves nothing', pg_temp.sql('select count(*) from pp.open_answers where status = ''shown''') = '0', null);
  r := public.pp_open_submit(toks[6], 'w1', 'Latecomer');
  perform public.pp_host_command(code, h, 'open_approve', jsonb_build_object('all', true, 'ids', (select jsonb_agg(x->'id') from jsonb_array_elements(hs->'open'->'items') x)));
  insert into t values ('show all: an answer that arrived after the host looked stays pending', pg_temp.sql(format('select status from pp.open_answers where id = %L', r->>'id')) = 'pending', null);
  hs := public.pp_host_state(code, h);
  insert into t values ('approve all: never approves flagged answers', (select bool_and((x->>'s') = case when (x->>'f')::boolean then 'pending' else 'shown' end) from jsonb_array_elements(hs->'open'->'items') x where x->>'t' <> 'Latecomer'), null);
  perform public.pp_host_command(code, h, 'open_hide', jsonb_build_object('ids', jsonb_build_array(id1)));
  hs := public.pp_host_state(code, h);
  insert into t values ('hide: answer removed from the display at once', (select x->>'s' from jsonb_array_elements(hs->'open'->'items') x where x->>'id' = id1) = 'hidden', null);
  my := public.pp_my_state(toks[1]);
  insert into t values ('phone sees only its own answers, hidden ones dropped', jsonb_array_length(my->'open'->'w1') = 2 and my::text not like '%gentil%', my->>'open');
  insert into t values ('removed answers still count toward the per-person limit (openUsed)', (my->'openUsed'->>'w1')::int >= jsonb_array_length(my->'open'->'w1'), my->>'openUsed');
  -- edit window: 2 s
  r := public.pp_open_submit(toks[4], 'w1', 'Generous', (select x->>'id' from jsonb_array_elements(hs->'open'->'items') x where x->>'t' = 'kind')::uuid);
  insert into t values ('edit within the window: ok, back to pending for approval', r->>'status' = 'ok'
                        and pg_temp.sql(format('select status from pp.open_answers where id = %L', r->>'id')) = 'pending', r::text);
  insert into t values ('cannot edit someone else''s answer', public.pp_open_submit(toks[5], 'w1', 'x', id1::uuid)->>'status' = 'invalid', null);
  perform public.pp_host_command(code, h, 'open_clear');
  perform pg_sleep(0.01);
  perform public.pp_host_command(code, h, 'open_approve', jsonb_build_object('ids', jsonb_build_array(r->>'id')));
  hs := public.pp_host_state(code, h);
  insert into t values ('after clear: an answer approved later carries a shown time at or after the clear',
    (select (x->>'sa')::bigint >= (hs->'open'->>'clearedAt')::bigint from jsonb_array_elements(hs->'open'->'items') x where x->>'id' = r->>'id'), null);
  insert into t values ('clear: screen emptied (clearedAt set), answers kept for the host', (public.pp_host_state(code, h)->'open'->>'clearedAt') is not null
                        and jsonb_array_length(public.pp_host_state(code, h)->'open'->'items') >= 12, null);
  -- Next closes submissions on an open question even if not everyone answered
  st := public.pp_host_command(code, h, 'next');
  insert into t values ('Next closes submissions any time (no "answer window still open")', st->>'phase' = 'reveal' and (st->'open'->>'closed')::boolean, st->>'phase');
  insert into t values ('after closing: submissions refused', public.pp_open_submit(toks[2], 'w1', 'Late')->>'status' = 'not_open', null);

  -- c1 (scored choice)
  perform public.pp_host_command(code, h, 'next'); perform public.pp_host_command(code, h, 'next');
  for i in 1..6 loop perform public.pp_submit(toks[i], 'c1', '"b"'); end loop;
  begin perform public.pp_host_command(code, h, 'open_clear'); insert into t values ('open commands outside an open question are refused', false, null);
  exception when others then insert into t values ('open commands outside an open question are refused', sqlerrm like '%not an open question%', sqlerrm); end;
  perform public.pp_host_command(code, h, 'next'); perform public.pp_host_command(code, h, 'next'); perform public.pp_host_command(code, h, 'next');
  -- w2: live moderation (unflagged answers show at once, flagged ones wait), editSec 0, default timing from submitSec
  r := public.pp_open_submit(toks[1], 'w2', 'More coffee breaks');
  insert into t values ('live mode: unflagged answer shown at once', pg_temp.sql(format('select status from pp.open_answers where id = %L', r->>'id')) = 'shown', r::text);
  r := public.pp_open_submit(toks[3], 'w2', '<img src=x>');
  insert into t values ('live mode: markup waits for the host', pg_temp.sql(format('select status || reason from pp.open_answers where id = %L', r->>'id')) = 'pendingmarkup', r::text);
  r := public.pp_open_submit(toks[2], 'w2', 'this is shit');
  insert into t values ('live mode: flagged answer still waits for the host', pg_temp.sql(format('select status from pp.open_answers where id = %L', r->>'id')) = 'pending', r::text);
  insert into t values ('editSec 0: no edits', public.pp_open_submit(toks[1], 'w2', 'Fewer meetings', (pg_temp.sql(format('select id from pp.open_answers where body = %L', 'More coffee breaks')))::uuid)->>'status' = 'edit_closed', null);
  st := public.pp_state(code);
  insert into t values ('submitSec 30 is the answer window (host presets do not change it)', abs(((st->>'deadline')::bigint - (st->>'now')::bigint) / 1000 - 30) <= 2, null);
  perform public.pp_host_command(code, h, 'next'); perform public.pp_host_command(code, h, 'next'); perform public.pp_host_command(code, h, 'next');
  -- w3: answers hidden from the screen until submissions close; reveal shows them earlier
  perform public.pp_open_submit(toks[1], 'w3', 'A thought');
  hs := public.pp_host_state(code, h);
  insert into t values ('showAnswers=closed: not visible while answering', not (hs->'open'->>'visible')::boolean, hs->>'open');
  perform public.pp_host_command(code, h, 'open_close');
  hs := public.pp_host_state(code, h);
  insert into t values ('showAnswers=closed: still hidden after closing until the host reveals', (hs->'open'->>'closed')::boolean and not (hs->'open'->>'visible')::boolean, hs->>'open');
  perform public.pp_host_command(code, h, 'open_reveal');
  insert into t values ('host Reveal: all approved answers visible at once', (public.pp_host_state(code, h)->'open'->>'visible')::boolean, null);
  r := public.pp_open_submit(toks[2], 'w3', '<script>x</script>');
  insert into t values ('after closing nothing new is accepted', r->>'status' = 'not_open', r::text);

  -- results: open answers never count in scoring; one scored question => score from c1 only
  perform public.pp_host_command(code, h, 'next');
  my := public.pp_my_state(toks[1]);
  insert into t values ('scoring: total = 1 scored question (open questions excluded), score 100', (my->'result'->>'total')::int = 1 and (my->'result'->>'score')::int = 100, my->>'result');
  perform set_config('t.code', code, false); perform set_config('t.h', h, false);
  perform public.pp_host_command(code, h, 'end');
end $$;
reset role;
insert into t select 'room ended: all answers deleted with the room', count(*) = 0, count(*)::text from pp.open_answers;
insert into t select 'summary keeps only counts per open question, never words', per_activity ? 'w1' and (per_activity->'w1') ? 'n' and per_activity::text not like '%Kind%' and per_activity::text not like '%coffee%',
  per_activity::text from pp.session_summaries where title = 'Open test';
insert into t select 'browsers cannot read the table directly', not has_table_privilege('anon', 'pp.open_answers', 'select') and not has_table_privilege('authenticated', 'pp.open_answers', 'select'), null;
insert into t select 'internal helpers not callable by browsers', not has_function_privilege('anon', 'pp._open_command(pp.sessions, text, jsonb)', 'execute'), null;

-- forget me: a participant's answers disappear with them
set role anon;
do $$ declare c jsonb; code text; h text; tok text; begin
  c := pg_temp.room(); code := c->>'code'; h := c->>'hostToken'; tok := public.pp_join(code, 'Zed', '🦊', null, true)->>'token';
  perform public.pp_host_command(code, h, 'next'); perform public.pp_host_command(code, h, 'next'); perform public.pp_host_command(code, h, 'next');
  perform public.pp_open_submit(tok, 'w1', 'Bye'); perform public.pp_forget_me(tok);
  perform set_config('t.code2', code, false);
end $$;
reset role;
-- edit window over time (separate transactions, because now() is fixed within one)
set role anon;
do $$ declare c jsonb; code text; h text; tok text; r jsonb; begin
  c := pg_temp.room(); code := c->>'code'; h := c->>'hostToken'; tok := public.pp_join(code, 'Edi', '🦊', null, true)->>'token';
  perform public.pp_host_command(code, h, 'next'); perform public.pp_host_command(code, h, 'next'); perform public.pp_host_command(code, h, 'next');
  r := public.pp_open_submit(tok, 'w1', 'First');
  perform set_config('t.tok3', tok, false); perform set_config('t.h3', h, false); perform set_config('t.id3', r->>'id', false); perform set_config('t.code3', code, false);
end $$;
select pg_sleep(2.3);
-- clear across transactions: answers shown before the clear stay off screen, later approvals appear
do $$ begin perform public.pp_open_submit(current_setting('t.tok3'), 'w1', 'Second'); end $$;
do $$ declare hs jsonb; begin
  hs := public.pp_host_state(current_setting('t.code3'), current_setting('t.h3'));
  perform public.pp_host_command(current_setting('t.code3'), current_setting('t.h3'), 'open_approve',
    jsonb_build_object('ids', (select jsonb_agg(x->'id') from jsonb_array_elements(hs->'open'->'items') x where x->>'t' = 'First'))); end $$;
do $$ begin perform public.pp_host_command(current_setting('t.code3'), current_setting('t.h3'), 'open_clear'); end $$;
do $$ declare hs jsonb; begin
  hs := public.pp_host_state(current_setting('t.code3'), current_setting('t.h3'));
  perform public.pp_host_command(current_setting('t.code3'), current_setting('t.h3'), 'open_approve',
    jsonb_build_object('ids', (select jsonb_agg(x->'id') from jsonb_array_elements(hs->'open'->'items') x where x->>'t' = 'Second')));
  hs := public.pp_host_state(current_setting('t.code3'), current_setting('t.h3'));
  insert into t values ('clear: earlier answers stay off screen, a later approval appears (also after a host refresh)',
    (select bool_and(case x->>'t' when 'First' then (x->>'sa')::bigint < (hs->'open'->>'clearedAt')::bigint else (x->>'sa')::bigint > (hs->'open'->>'clearedAt')::bigint end)
       from jsonb_array_elements(hs->'open'->'items') x), hs->>'open'); end $$;
do $$ begin
  insert into t values ('edit after the 2 s window: refused', public.pp_open_submit(current_setting('t.tok3'), 'w1', 'Late', current_setting('t.id3')::uuid)->>'status' = 'edit_closed', null);
end $$;
reset role;
-- retention: rooms expire after 24 h; expired rooms (and their answers) are purged when the next room is created
update pp.sessions set expires_at = now() - interval '1 minute' where code = current_setting('t.code3');
set role anon; select pg_temp.room(); reset role;
insert into t select 'retention: expired room purged with its answers', count(*) = 0, count(*)::text from pp.open_answers where body = 'First';
delete from pp.sessions where code = current_setting('t.code3');
insert into t select 'forget me: the participant''s answers are deleted', count(*) = 0, count(*)::text from pp.open_answers o join pp.sessions s on s.id = o.session_id where s.code = current_setting('t.code2');
delete from pp.sessions where code = current_setting('t.code2');
delete from pp.sessions where version_id in (select v.id from pp.experience_versions v join pp.experiences e on e.id = v.experience_id where e.slug = 'open-test');
delete from pp.session_summaries where title = 'Open test'; delete from pp.experiences where slug = 'open-test';
select case when ok then 'PASS' else 'FAIL' end || '  ' || name || coalesce('  [' || detail || ']', '') from t order by ok, name;
select count(*) filter (where ok) || ' passed, ' || count(*) filter (where not ok) || ' failed' from t;
