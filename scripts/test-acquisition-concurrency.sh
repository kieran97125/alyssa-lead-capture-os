#!/usr/bin/env bash
# Real concurrent transactions against the disposable acquisition PostgreSQL17 DB.
set -euo pipefail
acquisition_test_url="${ACQUISITION_TEST_DATABASE_URL:-${PUBLIC_CAPTURE_TEST_DATABASE_URL:-${DATABASE_URL:-}}}"
acquisition_psql=(psql)
if [[ -n "$acquisition_test_url" ]]; then
  acquisition_psql+=("$acquisition_test_url")
elif [[ "${PGDATABASE:-}" != public_capture_test ]]; then
  echo 'Set PGDATABASE=public_capture_test or an explicit isolated test connection' >&2
  exit 1
fi
if [[ "$("${acquisition_psql[@]}" -XAtqc 'select current_database()')" != public_capture_test ]]; then
  echo 'Refusing acquisition concurrency fixtures outside isolated public_capture_test' >&2
  exit 1
fi
acquisition_tmp="$(mktemp -d)"
trap 'rm -rf "$acquisition_tmp"' EXIT
"${acquisition_psql[@]}" -Xv ON_ERROR_STOP=1 -q <<'SQL'
SELECT acquisition_fixture.ensure_seed();
CREATE TABLE acquisition_fixture.concurrent_results(tag text PRIMARY KEY,result jsonb NOT NULL);
GRANT INSERT,SELECT ON acquisition_fixture.concurrent_results TO service_role;
CREATE FUNCTION acquisition_fixture.concurrent_mutation(op text,page uuid,revision bigint,request uuid,payload jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$ BEGIN
  RETURN public.mutate_landing_page_v1(op,page,revision,request,payload);
EXCEPTION
  WHEN serialization_failure THEN RETURN jsonb_build_object('revision_conflict',true);
  WHEN invalid_parameter_value THEN
    IF SQLERRM='landing_form_inactive' THEN RETURN jsonb_build_object('inactive_form',true); END IF;
    RAISE;
END; $$;
REVOKE ALL ON FUNCTION acquisition_fixture.concurrent_mutation(text,uuid,bigint,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION acquisition_fixture.concurrent_mutation(text,uuid,bigint,uuid,jsonb) TO service_role;
SET ROLE service_role;
INSERT INTO acquisition_fixture.concurrent_results VALUES('initial',public.mutate_landing_page_v1('create',NULL,NULL,
  'f2000000-0000-4000-8000-000000000001',acquisition_fixture.page_document('concurrent-save')));
SQL

cat > "$acquisition_tmp/save-a.sql" <<'SQL'
BEGIN; SET LOCAL ROLE service_role;
INSERT INTO acquisition_fixture.concurrent_results VALUES('save-a',acquisition_fixture.concurrent_mutation('save',
  (SELECT (result->'page'->>'id')::uuid FROM acquisition_fixture.concurrent_results WHERE tag='initial'),1,
  'f2000000-0000-4000-8000-000000000002','{"title":"Editor A"}'));
SELECT pg_sleep(0.5); COMMIT;
SQL
cat > "$acquisition_tmp/save-b.sql" <<'SQL'
BEGIN; SET LOCAL ROLE service_role;
INSERT INTO acquisition_fixture.concurrent_results VALUES('save-b',acquisition_fixture.concurrent_mutation('save',
  (SELECT (result->'page'->>'id')::uuid FROM acquisition_fixture.concurrent_results WHERE tag='initial'),1,
  'f2000000-0000-4000-8000-000000000003','{"title":"Editor B"}'));
COMMIT;
SQL
"${acquisition_psql[@]}" -Xv ON_ERROR_STOP=1 -qf "$acquisition_tmp/save-a.sql" > "$acquisition_tmp/save-a.log" 2>&1 & acquisition_pid_a=$!
"${acquisition_psql[@]}" -Xv ON_ERROR_STOP=1 -qf "$acquisition_tmp/save-b.sql" > "$acquisition_tmp/save-b.log" 2>&1 & acquisition_pid_b=$!
acquisition_failed=0
wait "$acquisition_pid_a" || acquisition_failed=1
wait "$acquisition_pid_b" || acquisition_failed=1
if ((acquisition_failed)); then cat "$acquisition_tmp/save-a.log" "$acquisition_tmp/save-b.log"; exit 1; fi
"${acquisition_psql[@]}" -Xv ON_ERROR_STOP=1 -q <<'SQL'
DO $$ DECLARE p uuid; BEGIN
  SELECT (result->'page'->>'id')::uuid INTO p FROM acquisition_fixture.concurrent_results WHERE tag='initial';
  PERFORM capture_fixture.assert((SELECT count(*)=1 FROM acquisition_fixture.concurrent_results WHERE tag IN('save-a','save-b') AND result->>'revision_conflict'='true'),'same-revision concurrent editors have one explicit conflict');
  PERFORM capture_fixture.assert((SELECT revision=2 FROM public.landing_pages WHERE id=p),'concurrent saves advance revision once');
  PERFORM capture_fixture.assert((SELECT count(*)=2 AND max(version_number)=2 FROM public.landing_page_versions WHERE page_id=p),'concurrent save cannot reuse version number or leave orphan version');
END; $$;
SQL

# The compound receipt serializes retries while the first form/page are uncommitted.
cat > "$acquisition_tmp/assets-a.sql" <<'SQL'
BEGIN; SET LOCAL ROLE service_role;
INSERT INTO acquisition_fixture.concurrent_results VALUES('assets-a',public.create_acquisition_assets_v1(
  'f2000000-0000-4000-8000-000000000004',jsonb_build_object('brand_id','a0000000-0000-4000-8000-000000000001',
  'form',acquisition_fixture.form_document(),'page',acquisition_fixture.page_document('concurrent-assets'))));
SELECT pg_sleep(0.5); COMMIT;
SQL
cat > "$acquisition_tmp/assets-b.sql" <<'SQL'
BEGIN; SET LOCAL ROLE service_role;
INSERT INTO acquisition_fixture.concurrent_results VALUES('assets-b',public.create_acquisition_assets_v1(
  'f2000000-0000-4000-8000-000000000004',jsonb_build_object('brand_id','a0000000-0000-4000-8000-000000000001',
  'form',acquisition_fixture.form_document(),'page',acquisition_fixture.page_document('concurrent-assets'))));
COMMIT;
SQL
"${acquisition_psql[@]}" -Xv ON_ERROR_STOP=1 -qf "$acquisition_tmp/assets-a.sql" > "$acquisition_tmp/assets-a.log" 2>&1 & acquisition_pid_a=$!
"${acquisition_psql[@]}" -Xv ON_ERROR_STOP=1 -qf "$acquisition_tmp/assets-b.sql" > "$acquisition_tmp/assets-b.log" 2>&1 & acquisition_pid_b=$!
acquisition_failed=0
wait "$acquisition_pid_a" || acquisition_failed=1
wait "$acquisition_pid_b" || acquisition_failed=1
if ((acquisition_failed)); then cat "$acquisition_tmp/assets-a.log" "$acquisition_tmp/assets-b.log"; exit 1; fi
"${acquisition_psql[@]}" -Xv ON_ERROR_STOP=1 -q <<'SQL'
DO $$ DECLARE a jsonb; b jsonb; BEGIN
  SELECT result INTO a FROM acquisition_fixture.concurrent_results WHERE tag='assets-a';
  SELECT result INTO b FROM acquisition_fixture.concurrent_results WHERE tag='assets-b';
  PERFORM capture_fixture.assert(a->'form'->>'id'=b->'form'->>'id' AND a->'page'->>'id'=b->'page'->>'id','concurrent compound retry preserves both identities');
  PERFORM capture_fixture.assert(a->>'replayed'<>b->>'replayed','one concurrent compound command creates; the other replays');
  PERFORM capture_fixture.assert((SELECT count(*)=1 FROM public.landing_pages WHERE slug='concurrent-assets'),'compound concurrency leaves one page');
END; $$;
SET ROLE service_role;
INSERT INTO acquisition_fixture.concurrent_results VALUES('archive-initial',public.mutate_landing_page_v1('create',NULL,NULL,
  'f2000000-0000-4000-8000-000000000005',acquisition_fixture.page_document('archive-race')));
SQL

# Observe the archive transaction holding its form lock before starting publish.
cat > "$acquisition_tmp/archive.sql" <<'SQL'
BEGIN; SET LOCAL ROLE service_role;
SET LOCAL application_name='acquisition-archive-lock';
UPDATE public.forms SET status='archived' WHERE id='e0000000-0000-4000-8000-000000000001';
SELECT pg_sleep(1.5); COMMIT;
SQL
"${acquisition_psql[@]}" -Xv ON_ERROR_STOP=1 -qf "$acquisition_tmp/archive.sql" > "$acquisition_tmp/archive.log" 2>&1 & acquisition_pid_a=$!
acquisition_lock_seen=0
for acquisition_attempt in {1..50}; do
  if [[ "$("${acquisition_psql[@]}" -XAtqc "select exists(select 1 from pg_stat_activity where application_name='acquisition-archive-lock' and wait_event='PgSleep')")" == t ]]; then
    acquisition_lock_seen=1; break
  fi
  sleep 0.05
done
if (( !acquisition_lock_seen )); then cat "$acquisition_tmp/archive.log"; echo 'Archive lock was not observed' >&2; exit 1; fi
"${acquisition_psql[@]}" -Xv ON_ERROR_STOP=1 -q <<'SQL'
SET ROLE service_role;
INSERT INTO acquisition_fixture.concurrent_results VALUES('archive-publish',acquisition_fixture.concurrent_mutation('publish',
  (SELECT (result->'page'->>'id')::uuid FROM acquisition_fixture.concurrent_results WHERE tag='archive-initial'),1,
  'f2000000-0000-4000-8000-000000000006','{}'));
SQL
wait "$acquisition_pid_a" || { cat "$acquisition_tmp/archive.log"; exit 1; }
"${acquisition_psql[@]}" -Xv ON_ERROR_STOP=1 -q <<'SQL'
DO $$ DECLARE p uuid; BEGIN
  SELECT (result->'page'->>'id')::uuid INTO p FROM acquisition_fixture.concurrent_results WHERE tag='archive-initial';
  PERFORM capture_fixture.assert((SELECT result->>'inactive_form'='true' FROM acquisition_fixture.concurrent_results WHERE tag='archive-publish'),'publish waits for form archive then rejects inactive form');
  PERFORM capture_fixture.assert((SELECT revision=1 AND status='draft' AND published_version_id IS NULL FROM public.landing_pages WHERE id=p),'archive race leaves page unpublished without partial version/revision');
  PERFORM capture_fixture.assert((SELECT count(*)=1 FROM public.landing_page_versions WHERE page_id=p),'failed concurrent publish leaves no version');
END; $$;
SELECT 'PASS: two-session LP CAS, compound replay and concurrent form archive/publication fence' AS result;
SQL
