#!/usr/bin/env bash
# Real two-session contention against a fresh, disposable PostgreSQL17 CI database.
set -euo pipefail
capture_test_url="${PUBLIC_CAPTURE_TEST_DATABASE_URL:-${DATABASE_URL:-}}"
capture_psql=(psql)
if [[ -n "$capture_test_url" ]]; then
  capture_psql+=("$capture_test_url")
elif [[ "${PGDATABASE:-}" != public_capture_test ]]; then
  echo 'Set PGDATABASE=public_capture_test or an explicit isolated test connection' >&2
  exit 1
fi
if [[ "$("${capture_psql[@]}" -XAtqc 'select current_database()')" != public_capture_test ]]; then
  echo 'Refusing concurrency fixtures outside isolated public_capture_test' >&2
  exit 1
fi
capture_tmp="$(mktemp -d)"
trap 'rm -rf "$capture_tmp"' EXIT
"${capture_psql[@]}" -Xv ON_ERROR_STOP=1 -q <<'SQL'
SELECT capture_fixture.seed();
CREATE TABLE capture_fixture.concurrent_results(tag text PRIMARY KEY,result jsonb NOT NULL);
GRANT INSERT,SELECT ON capture_fixture.concurrent_results TO service_role;
CREATE FUNCTION capture_fixture.concurrent_submit(submission uuid,phone text) RETURNS jsonb LANGUAGE plpgsql AS $$ BEGIN
  RETURN capture_fixture.capture(submission,phone);
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM='capture_duplicate_recent' THEN RETURN '{"recent_duplicate":true}'::jsonb; END IF;
  RAISE;
END; $$;
REVOKE ALL ON FUNCTION capture_fixture.concurrent_submit(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION capture_fixture.concurrent_submit(uuid,text) TO service_role;
SQL

# Both succeed even when the first receipt is still uncommitted: one new, one replay.
cat > "$capture_tmp/replay-a.sql" <<'SQL'
BEGIN; SET LOCAL ROLE service_role;
INSERT INTO capture_fixture.concurrent_results VALUES ('replay-a',capture_fixture.capture('f0000000-0000-4000-8000-000000000901','+999999000001'));
SELECT pg_sleep(0.5); COMMIT;
SQL
cat > "$capture_tmp/replay-b.sql" <<'SQL'
BEGIN; SET LOCAL ROLE service_role;
INSERT INTO capture_fixture.concurrent_results VALUES ('replay-b',capture_fixture.capture('f0000000-0000-4000-8000-000000000901','+999999000001'));
COMMIT;
SQL
"${capture_psql[@]}" -Xv ON_ERROR_STOP=1 -qf "$capture_tmp/replay-a.sql" > "$capture_tmp/replay-a.log" 2>&1 & capture_pid_a=$!
"${capture_psql[@]}" -Xv ON_ERROR_STOP=1 -qf "$capture_tmp/replay-b.sql" > "$capture_tmp/replay-b.log" 2>&1 & capture_pid_b=$!
capture_failed=0
wait "$capture_pid_a" || capture_failed=1
wait "$capture_pid_b" || capture_failed=1
if ((capture_failed)); then cat "$capture_tmp/replay-a.log" "$capture_tmp/replay-b.log"; exit 1; fi
"${capture_psql[@]}" -Xv ON_ERROR_STOP=1 -q <<'SQL'
DO $$ DECLARE a jsonb; b jsonb; BEGIN
  SELECT result INTO a FROM capture_fixture.concurrent_results WHERE tag='replay-a';
  SELECT result INTO b FROM capture_fixture.concurrent_results WHERE tag='replay-b';
  PERFORM capture_fixture.assert(a->'response'=b->'response','concurrent receipt replay returns identical persisted IDs');
  PERFORM capture_fixture.assert(a->>'replayed'<>b->>'replayed','exactly one concurrent request creates the registration');
  PERFORM capture_fixture.assert((SELECT count(*)=1 FROM public.leads WHERE normalized_phone='+999999000001'),'concurrent replay creates one lead');
  PERFORM capture_fixture.assert((SELECT count(*)=1 FROM public.public_lead_capture_receipts WHERE submission_id='f0000000-0000-4000-8000-000000000901'),'concurrent replay creates one receipt');
END; $$;
SQL

# Different request keys for the same recent form+phone serialize on the phone rule.
cat > "$capture_tmp/phone-a.sql" <<'SQL'
BEGIN; SET LOCAL ROLE service_role;
INSERT INTO capture_fixture.concurrent_results VALUES ('phone-a',capture_fixture.concurrent_submit('f0000000-0000-4000-8000-000000000902','+999999000002'));
SELECT pg_sleep(0.5); COMMIT;
SQL
cat > "$capture_tmp/phone-b.sql" <<'SQL'
BEGIN; SET LOCAL ROLE service_role;
INSERT INTO capture_fixture.concurrent_results VALUES ('phone-b',capture_fixture.concurrent_submit('f0000000-0000-4000-8000-000000000903','+999999000002'));
COMMIT;
SQL
"${capture_psql[@]}" -Xv ON_ERROR_STOP=1 -qf "$capture_tmp/phone-a.sql" > "$capture_tmp/phone-a.log" 2>&1 & capture_pid_a=$!
"${capture_psql[@]}" -Xv ON_ERROR_STOP=1 -qf "$capture_tmp/phone-b.sql" > "$capture_tmp/phone-b.log" 2>&1 & capture_pid_b=$!
capture_failed=0
wait "$capture_pid_a" || capture_failed=1
wait "$capture_pid_b" || capture_failed=1
if ((capture_failed)); then cat "$capture_tmp/phone-a.log" "$capture_tmp/phone-b.log"; exit 1; fi
"${capture_psql[@]}" -Xv ON_ERROR_STOP=1 -q <<'SQL'
DO $$ BEGIN
  PERFORM capture_fixture.assert((SELECT count(*)=1 FROM capture_fixture.concurrent_results WHERE tag IN ('phone-a','phone-b') AND result->>'recent_duplicate'='true'),'one concurrent distinct-key enquiry is rejected by the existing short window');
  PERFORM capture_fixture.assert((SELECT count(*)=1 FROM public.leads WHERE normalized_phone='+999999000002'),'concurrent phone guard cannot leave duplicate or orphaned registrations');
END; $$;
SQL

# SKIP LOCKED prevents two workers owning one pending delivery.
cat > "$capture_tmp/claim-a.sql" <<'SQL'
BEGIN; SET LOCAL ROLE service_role;
INSERT INTO capture_fixture.concurrent_results SELECT 'claim-a',coalesce(jsonb_agg(to_jsonb(d)),'[]'::jsonb)
FROM public.claim_public_lead_deliveries((SELECT (response_json->>'delivery_id')::uuid FROM public.public_lead_capture_receipts WHERE submission_id='f0000000-0000-4000-8000-000000000901'),1) d;
SELECT pg_sleep(0.5); COMMIT;
SQL
cat > "$capture_tmp/claim-b.sql" <<'SQL'
BEGIN; SET LOCAL ROLE service_role;
INSERT INTO capture_fixture.concurrent_results SELECT 'claim-b',coalesce(jsonb_agg(to_jsonb(d)),'[]'::jsonb)
FROM public.claim_public_lead_deliveries((SELECT (response_json->>'delivery_id')::uuid FROM public.public_lead_capture_receipts WHERE submission_id='f0000000-0000-4000-8000-000000000901'),1) d;
COMMIT;
SQL
"${capture_psql[@]}" -Xv ON_ERROR_STOP=1 -qf "$capture_tmp/claim-a.sql" > "$capture_tmp/claim-a.log" 2>&1 & capture_pid_a=$!
"${capture_psql[@]}" -Xv ON_ERROR_STOP=1 -qf "$capture_tmp/claim-b.sql" > "$capture_tmp/claim-b.log" 2>&1 & capture_pid_b=$!
capture_failed=0
wait "$capture_pid_a" || capture_failed=1
wait "$capture_pid_b" || capture_failed=1
if ((capture_failed)); then cat "$capture_tmp/claim-a.log" "$capture_tmp/claim-b.log"; exit 1; fi
"${capture_psql[@]}" -Xv ON_ERROR_STOP=1 -q <<'SQL'
DO $$ BEGIN
  PERFORM capture_fixture.assert((SELECT sum(jsonb_array_length(result))=1 FROM capture_fixture.concurrent_results WHERE tag IN ('claim-a','claim-b')),'concurrent workers obtain one lease');
  PERFORM capture_fixture.assert((SELECT attempt_count=1 AND status='processing' FROM public.public_lead_delivery_outbox WHERE lead_id=(SELECT lead_id FROM public.public_lead_capture_receipts WHERE submission_id='f0000000-0000-4000-8000-000000000901')),'single claim increments attempt exactly once');
END; $$;
SELECT 'PASS: real two-session receipt replay, distinct-key phone serialization and exclusive delivery claim' AS result;
SQL
