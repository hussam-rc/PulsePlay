create temp table t(name text, ok boolean, detail text);
insert into auth.users(id, email) values ('00000000-0000-0000-0000-0000000000f1', 'q@example.org') on conflict do nothing;
do $$ declare i int; ok boolean; begin
  for i in 1..15 loop perform public.pp_ai_take('00000000-0000-0000-0000-0000000000f1'); end loop;
  insert into t values ('ai: 15 drafts per hour allowed', true, null);
  begin perform public.pp_ai_take('00000000-0000-0000-0000-0000000000f1'); ok := false; exception when others then ok := sqlerrm like 'AI limit reached: 15%'; end;
  insert into t values ('ai: 16th draft in an hour refused', ok, null);
  insert into t values ('ai: only user id and time stored', (select count(*) from information_schema.columns where table_schema = 'pp' and table_name = 'ai_requests') = 3, null);
end $$;
delete from pp.ai_requests; delete from auth.users where id = '00000000-0000-0000-0000-0000000000f1';
select case when ok then 'PASS' else 'FAIL' end || '  ' || name from t order by ok, name;
select count(*) filter (where ok) || ' passed, ' || count(*) filter (where not ok) || ' failed' from t;
