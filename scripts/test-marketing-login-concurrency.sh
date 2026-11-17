#!/usr/bin/env bash
set -euo pipefail
test "${PGDATABASE:-}" = marketing_platform_test
test "$(psql -XAtq -c 'select current_database()')" = marketing_platform_test
TASK_LOGIN_TMP=$(mktemp -d)
trap 'rm -rf "$TASK_LOGIN_TMP"' EXIT
psql -XAtq -v ON_ERROR_STOP=1 -c "set role service_role; select public.claim_marketing_login_link(repeat('e',64),repeat('f',64));" > "$TASK_LOGIN_TMP/first" &
TASK_LOGIN_FIRST=$!
psql -XAtq -v ON_ERROR_STOP=1 -c "set role service_role; select public.claim_marketing_login_link(repeat('e',64),repeat('f',64));" > "$TASK_LOGIN_TMP/second" &
TASK_LOGIN_SECOND=$!
wait "$TASK_LOGIN_FIRST"
wait "$TASK_LOGIN_SECOND"
test "$(cat "$TASK_LOGIN_TMP/first" "$TASK_LOGIN_TMP/second" | awk '$0=="t"{n++} END{print n+0}')" = 1
test "$(cat "$TASK_LOGIN_TMP/first" "$TASK_LOGIN_TMP/second" | awk '$0=="f"{n++} END{print n+0}')" = 1
TASK_LOGIN_COUNT=$(psql -XAtq -c "select count(*) from public.marketing_login_link_requests where email_hash=repeat('e',64)")
test "$TASK_LOGIN_COUNT" = 1
echo 'PASS: concurrent login requests admit exactly one email and persist one receipt'
