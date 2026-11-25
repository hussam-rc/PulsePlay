#!/usr/bin/env bash
# Start an isolated test environment: fresh database, the local Supabase stand-in, Edge Functions and a mock AI.
# Never touches production. Used by CI (.github/workflows/ci.yml) and locally.
# Env: PGHOST PGPORT PGUSER PGPASSWORD (database server), DB (default e2e), SITE (folder that contains PulsePlay/app), DENO (default deno)
set -euo pipefail
cd "$(dirname "$0")/.."
DB=${DB:-e2e}; SITE=${SITE:-/tmp/ppsite}; DENO=${DENO:-deno}; HERE=$PWD
export PGDATABASE=postgres
psql -qAtc "select pg_terminate_backend(pid) from pg_stat_activity where datname='$DB'" >/dev/null
dropdb --if-exists "$DB" && createdb "$DB"
for f in supabase/tests/setup_local.sql supabase/migrations/2026112[4-9]_*.sql; do
  psql -d "$DB" -q -v ON_ERROR_STOP=1 -f "$f" >/dev/null || { echo "migration failed: $f"; exit 1; }
done
pkill -f test-env/emulator.mjs || true
nohup node test-env/emulator.mjs "$SITE" "$DB" > /tmp/pp-emulator.log 2>&1 &
pkill -f test-env/mock-ai.mjs || true
nohup node test-env/mock-ai.mjs > /tmp/pp-mock-ai.log 2>&1 &
if command -v "$DENO" >/dev/null && ! pgrep -f "test-env/fn-wrap.ts" >/dev/null; then
  common="SUPABASE_URL=http://localhost:8789 SUPABASE_ANON_KEY=testkey SUPABASE_SERVICE_ROLE_KEY=service"
  for spec in "8000 publish" "8001 draft-questions ANTHROPIC_API_KEY=test-key ANTHROPIC_URL=http://localhost:8099/v1/messages" "8003 invite-email APP_URL=http://localhost:8789/PulsePlay/app/"; do
    set -- $spec; port=$1; fn=$2; shift 2
    env $common "$@" PORT=$port FN=file://$HERE/supabase/functions/$fn/index.ts nohup "$DENO" run -A --no-config --node-modules-dir=none test-env/fn-wrap.ts > /tmp/pp-fn-$fn.log 2>&1 &
  done
fi
for i in $(seq 1 60); do curl -sf -o /dev/null http://localhost:8789/PulsePlay/app/ && break; sleep 0.5; done
for p in 8000 8001 8003; do for i in $(seq 1 60); do curl -s -o /dev/null http://localhost:$p/ && break; sleep 0.5; done; done
echo "test environment ready (db=$DB, site=$SITE)"
