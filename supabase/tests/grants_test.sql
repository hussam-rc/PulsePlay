-- Privilege checks that must hold identically on CI and production.
create temp table t(name text, ok boolean, detail text);
insert into t values
 ('grants: anon cannot call workspace API', not has_function_privilege('anon', 'public.pp_me()', 'execute'), null),
 ('grants: signed-in users can call workspace API', has_function_privilege('authenticated', 'public.pp_me()', 'execute'), null),
 ('grants: anon cannot call service publish', not has_function_privilege('anon', 'public.pp_publish_validated(uuid,uuid,jsonb,text)', 'execute'), null),
 ('grants: users cannot call service publish', not has_function_privilege('authenticated', 'public.pp_publish_validated(uuid,uuid,jsonb,text)', 'execute'), null),
 ('grants: service role can call service publish', has_function_privilege('service_role', 'public.pp_publish_validated(uuid,uuid,jsonb,text)', 'execute'), null),
 ('grants: every pp table has RLS', (select count(*) from pg_tables where schemaname = 'pp' and not rowsecurity) = 0, null),
 ('grants: anon has no direct table access in pp', not exists(select 1 from information_schema.role_table_grants where grantee = 'anon' and table_schema = 'pp'), null),
 ('grants: anon cannot read published content', not has_function_privilege('anon', 'public.pp_get_published(uuid)', 'execute'), null),
 ('grants: users cannot call the AI quota directly', not has_function_privilege('authenticated', 'public.pp_ai_take(uuid)', 'execute') and not has_function_privilege('anon', 'public.pp_ai_take(uuid)', 'execute'), null),
 ('grants: service role can take AI quota', has_function_privilege('service_role', 'public.pp_ai_take(uuid)', 'execute'), null),
 ('grants: one create_session signature', (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'pp' and p.proname = 'create_session') = 1, null);
select case when ok then 'PASS' else 'FAIL' end || '  ' || name from t order by ok, name;
select count(*) filter (where ok) || ' passed, ' || count(*) filter (where not ok) || ' failed' from t;
