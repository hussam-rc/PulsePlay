#!/usr/bin/env bash
# Runs every browser suite against the isolated test environment (test-env/start.sh). Exit code 1 if any check fails.
# Usage: BASE=http://localhost:8789/PulsePlay/app/ web/e2e/run_all.sh [suite ...]
cd "$(dirname "$0")/.."
SUITES=${*:-"e2e release_2a feedback2 live_multiplayer resilience results_keep i18n workspace"}
export SHOTS=${SHOTS:-/tmp/pp-shots}; mkdir -p "$SHOTS"; status=0
for s in $SUITES; do
  echo "::group::$s"; out=$(timeout 600 python3 "e2e/$s.py" 2>&1); code=$?; echo "$out"; echo "::endgroup::"
  fails=$(grep -c '^FAIL' <<<"$out"); summary=$(grep -E '[0-9]+ passed, [0-9]+ failed' <<<"$out" | tail -1)
  if [ $code -ne 0 ] || [ "$fails" -gt 0 ] || grep -q 'Traceback' <<<"$out"; then echo "✗ $s ${summary:-exit $code}"; status=1; else echo "✓ $s ${summary:-ok}"; fi
done
exit $status
