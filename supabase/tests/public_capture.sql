-- Behavioral qualification against the real PostgreSQL RPC, no HTTP mocks.
-- All synthetic data and failure triggers are rolled back at the end.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
  IF current_database() <> 'public_capture_test' THEN
    RAISE EXCEPTION 'This qualification requires isolated database public_capture_test';
  END IF;
END; $$;
SELECT capture_fixture.seed();

-- Roles, RLS and invoker boundary are independently exercised, not just string-checked.
DO $$ DECLARE role_name text; BEGIN
  PERFORM capture_fixture.assert((SELECT bool_and(relrowsecurity) FROM pg_class WHERE oid IN ('public.public_lead_capture_receipts'::regclass,'public.public_lead_delivery_outbox'::regclass)), 'receipt and outbox RLS enabled');
  PERFORM capture_fixture.assert(NOT (SELECT prosecdef FROM pg_proc WHERE oid='public.capture_public_lead_v1(uuid,uuid,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb)'::regprocedure), 'capture does not bypass caller privileges');
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    PERFORM capture_fixture.assert(NOT has_function_privilege(role_name,'public.capture_public_lead_v1(uuid,uuid,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb)','EXECUTE'),role_name||' cannot capture');
    PERFORM capture_fixture.assert(NOT has_table_privilege(role_name,'public.public_lead_delivery_outbox','SELECT'),role_name||' cannot read delivery payloads');
    EXECUTE format('SET LOCAL ROLE %I',role_name);
    BEGIN
      PERFORM public.capture_public_lead_v1(NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL);
      RAISE EXCEPTION 'qualification_failed: anonymous capture unexpectedly allowed';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    BEGIN
      PERFORM * FROM public.claim_public_lead_deliveries(NULL,1);
      RAISE EXCEPTION 'qualification_failed: anonymous worker claim unexpectedly allowed';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    BEGIN
      PERFORM public.get_public_lead_delivery_summary();
      RAISE EXCEPTION 'qualification_failed: anonymous delivery summary unexpectedly allowed';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    EXECUTE 'RESET ROLE';
  END LOOP;
END; $$;

DO $$ DECLARE statement text; BEGIN
  SET LOCAL ROLE service_role;
  FOREACH statement IN ARRAY ARRAY[
    'UPDATE public.public_lead_capture_receipts SET response_json=response_json WHERE false',
    'DELETE FROM public.public_lead_capture_receipts WHERE false',
    'DELETE FROM public.public_lead_delivery_outbox WHERE false',
    'UPDATE public.public_lead_delivery_rechecks SET delivery_count=delivery_count WHERE false',
    'DELETE FROM public.public_lead_delivery_rechecks WHERE false'
  ] LOOP
    BEGIN
      EXECUTE statement;
      RAISE EXCEPTION 'qualification_failed: default GRANT ALL defeated append-only privileges';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  END LOOP;
  RESET ROLE;
END; $$;

DO $$ DECLARE summary jsonb; BEGIN
  SET LOCAL ROLE service_role;
  summary:=public.get_public_lead_delivery_summary();
  PERFORM capture_fixture.assert(summary->'counts'='{"pending":0,"retry":0,"processing":0,"delivered":0,"blocked":0,"uncertain":0,"skipped":0}'::jsonb,'empty summary contains all seven states');
  PERFORM capture_fixture.assert(summary->>'checked_at' ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$','summary timestamp is explicit UTC microseconds');
  RESET ROLE;
END; $$;

DO $$ DECLARE first_result jsonb; replay_result jsonb; before_counts jsonb; lead uuid; BEGIN
  SET LOCAL ROLE service_role;
  first_result:=capture_fixture.capture('f0000000-0000-4000-8000-000000000001','+999000000001');
  PERFORM capture_fixture.assert(first_result->>'replayed'='false','first submission is newly committed');
  PERFORM capture_fixture.assert(capture_fixture.counts()='[1,1,1,1,3,1,1]'::jsonb,'one atomic contact/snapshot/lead/booking/event set/receipt/outbox');
  before_counts:=capture_fixture.counts();
  replay_result:=capture_fixture.capture('f0000000-0000-4000-8000-000000000001','+999000000001');
  PERFORM capture_fixture.assert(replay_result->>'replayed'='true','replay detected');
  PERFORM capture_fixture.assert(replay_result->'response'=first_result->'response','replay returns identical IDs/event/delivery receipt');
  PERFORM capture_fixture.assert(capture_fixture.counts()=before_counts,'replay creates no rows');
  BEGIN
    PERFORM capture_fixture.capture('f0000000-0000-4000-8000-000000000001','+999000000099',request_hash=>repeat('b',64));
    RAISE EXCEPTION 'qualification_failed: changed request reused receipt';
  EXCEPTION WHEN invalid_parameter_value THEN
    IF SQLERRM<>'capture_idempotency_conflict' THEN RAISE; END IF;
  END;
  PERFORM capture_fixture.assert(capture_fixture.counts()=before_counts,'idempotency conflict cannot mutate contact or partial rows');
  lead:=(first_result->'response'->>'lead_id')::uuid;
  PERFORM capture_fixture.assert((SELECT s.lead_id=lead FROM public.leads l JOIN public.lead_source_snapshots s ON s.id=l.source_snapshot_id WHERE l.id=lead),'source snapshot points to the same committed lead');
  PERFORM capture_fixture.assert((SELECT payload_json->>'leadKey'=lead::text AND payload_json->>'secret'='' FROM public.public_lead_delivery_outbox WHERE lead_id=lead),'outbox is bound to immutable lead identity and contains no secret');
  PERFORM capture_fixture.assert((SELECT d.payload_json->>'createdAt'=to_char(l.created_at AT TIME ZONE 'Asia/Hong_Kong','YYYY-MM-DD')
    AND d.payload_json->>'lastUpdatedAt'=d.payload_json->>'createdAt'
    AND d.payload_json->'rowValues'->>0=d.payload_json->>'createdAt'
    AND d.payload_json->'rowValues'->>1=d.payload_json->>'createdAt'
    AND d.payload_json->'rowValues'->>2='preserved-field'
    FROM public.leads l JOIN public.public_lead_delivery_outbox d ON d.lead_id=l.id WHERE l.id=lead),'delivery dates use committed HKT day and preserve other fields');
  RESET ROLE;
  UPDATE public.forms SET status='archived' WHERE id='e0000000-0000-4000-8000-000000000001';
  SET LOCAL ROLE service_role;
  replay_result:=capture_fixture.capture('f0000000-0000-4000-8000-000000000001','+999000000001');
  PERFORM capture_fixture.assert(replay_result->'response'=first_result->'response','committed receipt remains replayable after form configuration changes');
  RESET ROLE;
  UPDATE public.forms SET status='active' WHERE id='e0000000-0000-4000-8000-000000000001';
END; $$;

-- Repeated enquiries are recorded; same phone does not collapse leads across forms/brands/treatments.
DO $$ DECLARE r jsonb; before_counts jsonb:=capture_fixture.counts(); BEGIN
  BEGIN
    PERFORM capture_fixture.capture(gen_random_uuid(),'+999000000001');
    RAISE EXCEPTION 'qualification_failed: rapid same-form duplicate accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'capture_duplicate_recent' THEN RAISE; END IF; END;
  PERFORM capture_fixture.assert(capture_fixture.counts()=before_counts,'short-window rejected duplicate is fully inert');
  r:=capture_fixture.capture(gen_random_uuid(),'+999000000001','e0000000-0000-4000-8000-000000000002');
  PERFORM capture_fixture.assert(r->'response'->>'delivery_status'='skipped','same-brand/treatment 24h enquiry is retained but not re-delivered');
  PERFORM capture_fixture.assert((SELECT lead_status='duplicate' FROM public.leads WHERE id=(r->'response'->>'lead_id')::uuid),'repeat enquiry gets duplicate marker');
  r:=capture_fixture.capture(gen_random_uuid(),'+999000000001','e0000000-0000-4000-8000-000000000003');
  PERFORM capture_fixture.assert(r->'response'->>'delivery_status'='pending','another brand remains an independent lead');
  r:=capture_fixture.capture(gen_random_uuid(),'+999000000001','e0000000-0000-4000-8000-000000000004',
    '{"package_id":"c0000000-0000-4000-8000-000000000002","branch_id":"d0000000-0000-4000-8000-000000000002"}');
  PERFORM capture_fixture.assert(r->'response'->>'delivery_status'='pending','another permitted treatment remains an independent lead');
  PERFORM capture_fixture.assert((SELECT count(*)=4 FROM public.leads WHERE normalized_phone='+999000000001'),'four distinct lead records preserve enquiry identity');
  PERFORM capture_fixture.assert((SELECT count(*)=1 FROM public.contacts WHERE normalized_phone='+999000000001'),'contact reuse does not become global lead deduplication');
END; $$;

DO $$ DECLARE r jsonb; BEGIN
  r:=capture_fixture.capture(gen_random_uuid(),'+999000000010',lead_patch=>'{"source_type":"organic_unknown"}');
  PERFORM capture_fixture.assert((SELECT count(*)=1 FROM public.lead_events WHERE lead_id=(r->'response'->>'lead_id')::uuid AND event_type='organic_source_assigned'),'organic capture includes its source assignment atomically');
  r:=capture_fixture.capture(gen_random_uuid(),'+999000000011',delivery_enabled=>false);
  PERFORM capture_fixture.assert(r->'response'->>'delivery_status'='skipped','disabled sync still persists a valid registration');
  PERFORM capture_fixture.assert((SELECT count(*)=0 FROM public.claim_public_lead_deliveries((r->'response'->>'delivery_id')::uuid,1)),'skipped delivery is not claimed');
END; $$;

-- The newest same-brand/treatment outcome governs the existing 24h duplicate rule.
DO $$ DECLARE older jsonb; latest jsonb; fresh jsonb; phone text; i integer; BEGIN
  FOR i IN 1..2 LOOP
    phone:='+99900000002'||i;
    older:=capture_fixture.capture(gen_random_uuid(),phone);
    UPDATE public.leads SET created_at=now()-interval '2 hours' WHERE id=(older->'response'->>'lead_id')::uuid;
    latest:=capture_fixture.capture(gen_random_uuid(),phone,'e0000000-0000-4000-8000-000000000002');
    UPDATE public.leads SET created_at=now()-interval '1 hour',payment_status=CASE WHEN i=1 THEN 'paid' ELSE 'unpaid' END,
      booking_status=CASE WHEN i=2 THEN 'confirmed' ELSE 'requested' END WHERE id=(latest->'response'->>'lead_id')::uuid;
    fresh:=capture_fixture.capture(gen_random_uuid(),phone);
    PERFORM capture_fixture.assert(fresh->'response'->>'delivery_status'='pending','latest paid/confirmed outcome must not resurrect older unpaid enquiry');
  END LOOP;
  older:=capture_fixture.capture(gen_random_uuid(),'+999000000030');
  UPDATE public.leads SET created_at=now()-interval '25 hours' WHERE id=(older->'response'->>'lead_id')::uuid;
  fresh:=capture_fixture.capture(gen_random_uuid(),'+999000000030');
  PERFORM capture_fixture.assert(fresh->'response'->>'delivery_status'='pending','enquiry outside24h is a new lead');
END; $$;

-- Visitor-visible package/branch membership is revalidated at commit time.
DO $$ DECLARE before_counts jsonb; r jsonb; BEGIN
  before_counts:=capture_fixture.counts();
  BEGIN
    PERFORM capture_fixture.capture(gen_random_uuid(),'+999000000040',lead_patch=>'{"package_id":"c0000000-0000-4000-8000-000000000002"}');
    RAISE EXCEPTION 'qualification_failed: unrelated same-brand package accepted';
  EXCEPTION WHEN invalid_parameter_value THEN IF SQLERRM<>'capture_package_not_allowed' THEN RAISE; END IF; END;
  BEGIN
    PERFORM capture_fixture.capture(gen_random_uuid(),'+999000000041',lead_patch=>'{"branch_id":"d0000000-0000-4000-8000-000000000002"}');
    RAISE EXCEPTION 'qualification_failed: unrelated same-brand branch accepted';
  EXCEPTION WHEN invalid_parameter_value THEN IF SQLERRM<>'capture_branch_not_allowed' THEN RAISE; END IF; END;
  BEGIN
    PERFORM capture_fixture.capture(gen_random_uuid(),'+999000000042',lead_patch=>'{"branch_id":"d0000000-0000-4000-8000-000000000003"}');
    RAISE EXCEPTION 'qualification_failed: cross-brand branch accepted';
  EXCEPTION WHEN invalid_parameter_value THEN IF SQLERRM<>'capture_offer_changed' THEN RAISE; END IF; END;
  PERFORM capture_fixture.assert(capture_fixture.counts()=before_counts,'membership failures leave no partial registration');
  r:=capture_fixture.capture(gen_random_uuid(),'+999000000043','e0000000-0000-4000-8000-000000000005','{"branch_id":"d0000000-0000-4000-8000-000000000002"}');
  PERFORM capture_fixture.assert(r->'response'->>'ok'='true','form without branch selection retains all-active-brand fallback');
  r:=capture_fixture.capture(gen_random_uuid(),'+999000000044','e0000000-0000-4000-8000-000000000006');
  PERFORM capture_fixture.assert(r->'response'->>'ok'='true','empty customer-choice membership retains default package');
  UPDATE public.form_packages SET is_active=false WHERE form_id='e0000000-0000-4000-8000-000000000004';
  UPDATE public.form_branches SET is_active=false WHERE form_id='e0000000-0000-4000-8000-000000000004';
  r:=capture_fixture.capture(gen_random_uuid(),'+999000000045','e0000000-0000-4000-8000-000000000004');
  PERFORM capture_fixture.assert(r->'response'->>'ok'='true','inactive membership falls back to active defaults');
  UPDATE public.form_packages SET is_active=true WHERE form_id='e0000000-0000-4000-8000-000000000004';
  UPDATE public.form_branches SET is_active=true WHERE form_id='e0000000-0000-4000-8000-000000000004';
  UPDATE public.forms SET default_package_id='c0000000-0000-4000-8000-000000000002' WHERE id='e0000000-0000-4000-8000-000000000001';
  before_counts:=capture_fixture.counts();
  BEGIN
    PERFORM capture_fixture.capture(gen_random_uuid(),'+999000000046',lead_patch=>'{"package_id":"c0000000-0000-4000-8000-000000000001"}');
    RAISE EXCEPTION 'qualification_failed: stale package selection survived configuration edit';
  EXCEPTION WHEN invalid_parameter_value THEN IF SQLERRM<>'capture_package_not_allowed' THEN RAISE; END IF; END;
  PERFORM capture_fixture.assert(capture_fixture.counts()=before_counts,'configuration conflict rolls back registration');
  UPDATE public.forms SET default_package_id='c0000000-0000-4000-8000-000000000001' WHERE id='e0000000-0000-4000-8000-000000000001';
  BEGIN
    PERFORM capture_fixture.capture(gen_random_uuid(),'+999000000047',lead_patch=>'{"price":99}');
    RAISE EXCEPTION 'qualification_failed: stale price accepted';
  EXCEPTION WHEN invalid_parameter_value THEN IF SQLERRM<>'capture_offer_changed' THEN RAISE; END IF; END;
END; $$;

-- Fault injection after contact upsert proves all participating tables roll back together.
CREATE FUNCTION capture_fixture.fail_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF current_setting('capture_fixture.fail_table',true)=TG_TABLE_NAME THEN
    RAISE EXCEPTION 'synthetic_insert_failure' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER capture_test_bookings_failure BEFORE INSERT ON public.bookings FOR EACH ROW EXECUTE FUNCTION capture_fixture.fail_insert();
CREATE TRIGGER capture_test_events_failure BEFORE INSERT ON public.lead_events FOR EACH ROW EXECUTE FUNCTION capture_fixture.fail_insert();
CREATE TRIGGER capture_test_delivery_failure BEFORE INSERT ON public.public_lead_delivery_outbox FOR EACH ROW EXECUTE FUNCTION capture_fixture.fail_insert();
DO $$ DECLARE before_counts jsonb; t text; BEGIN
  UPDATE public.contacts SET customer_name='Original fixture' WHERE normalized_phone='+999000000001';
  FOREACH t IN ARRAY ARRAY['bookings','lead_events','public_lead_delivery_outbox'] LOOP
    before_counts:=capture_fixture.counts();
    PERFORM set_config('capture_fixture.fail_table',t,true);
    BEGIN
      -- This form permits any active branch but has no default. Supply the
      -- visitor's valid choice so failure occurs at the injected INSERT.
      -- Reusing an existing contact also exercises rollback of the upsert.
      PERFORM capture_fixture.capture(gen_random_uuid(),'+999000000001','e0000000-0000-4000-8000-000000000005',
        '{"branch_id":"d0000000-0000-4000-8000-000000000001"}');
      RAISE EXCEPTION 'qualification_failed: fault injection did not fire';
    EXCEPTION WHEN check_violation THEN IF SQLERRM<>'synthetic_insert_failure' THEN RAISE; END IF; END;
    PERFORM set_config('capture_fixture.fail_table','',true);
    PERFORM capture_fixture.assert(capture_fixture.counts()=before_counts,t||' failure leaves no orphaned rows');
    PERFORM capture_fixture.assert((SELECT customer_name='Original fixture' FROM public.contacts WHERE normalized_phone='+999000000001'),'failed registration rolls back preexisting contact update');
  END LOOP;
  before_counts:=capture_fixture.counts();
  BEGIN
    PERFORM capture_fixture.capture(gen_random_uuid(),'+999000000060',consent_patch=>'{"consent_text":""}');
    RAISE EXCEPTION 'qualification_failed: missing legal consent accepted';
  EXCEPTION WHEN invalid_parameter_value THEN IF SQLERRM<>'capture_invalid_events' THEN RAISE; END IF; END;
  BEGIN
    PERFORM capture_fixture.capture(gen_random_uuid(),'+999000000061',events_override=>'[{"event_type":"form_submit_success","event_payload_json":{}},{"event_type":"no_show","event_payload_json":{}},{"event_type":"booking_created","event_payload_json":{}}]');
    RAISE EXCEPTION 'qualification_failed: operational event injection accepted';
  EXCEPTION WHEN invalid_parameter_value THEN IF SQLERRM<>'capture_invalid_events' THEN RAISE; END IF; END;
  PERFORM capture_fixture.assert(capture_fixture.counts()=before_counts,'invalid consent/event set leaves all tables unchanged');
END; $$;

-- Durable claim/lease fencing and ambiguous append intent recovery.
DO $$ DECLARE job public.public_lead_delivery_outbox%rowtype; next_job public.public_lead_delivery_outbox%rowtype; stale_token uuid; changed integer; r jsonb; i integer; BEGIN
  SELECT * INTO job FROM public.public_lead_delivery_outbox WHERE status='pending' ORDER BY created_at,id LIMIT 1;
  SELECT * INTO job FROM public.claim_public_lead_deliveries(job.id,1);
  PERFORM capture_fixture.assert(job.status='processing' AND job.attempt_count=1 AND job.lease_token IS NOT NULL AND job.append_started_at IS NULL,'initial claim has a fresh lease without an invented append');
  stale_token:=job.lease_token;
  PERFORM capture_fixture.assert((SELECT count(*)=0 FROM public.claim_public_lead_deliveries(job.id,1)),'active lease is not double-claimed');
  UPDATE public.public_lead_delivery_outbox SET lease_expires_at=now()-interval '1 second' WHERE id=job.id;
  UPDATE public.public_lead_delivery_outbox SET status='delivered' WHERE id=job.id AND lease_token=stale_token AND status='processing' AND lease_expires_at>now();
  GET DIAGNOSTICS changed=ROW_COUNT;
  PERFORM capture_fixture.assert(changed=0,'expired owner cannot journal completion');
  SELECT * INTO next_job FROM public.claim_public_lead_deliveries(job.id,1);
  PERFORM capture_fixture.assert(next_job.lease_token<>stale_token AND next_job.attempt_count=2 AND next_job.append_started_at IS NOT NULL,'expired processing claim rotates lease and forces reconciliation');
  UPDATE public.public_lead_delivery_outbox SET status='delivered' WHERE id=job.id AND lease_token=stale_token AND status='processing' AND lease_expires_at>now();
  GET DIAGNOSTICS changed=ROW_COUNT;
  PERFORM capture_fixture.assert(changed=0,'stale worker cannot overwrite newly claimed work');
  UPDATE public.public_lead_delivery_outbox SET status='uncertain',append_started_at=NULL,lease_token=NULL,lease_expires_at=NULL,next_attempt_at=now() WHERE id=job.id;
  SELECT * INTO next_job FROM public.claim_public_lead_deliveries(job.id,1);
  PERFORM capture_fixture.assert(next_job.append_started_at IS NOT NULL,'uncertain delivery with missing intent is reconciliation-only');
  UPDATE public.public_lead_delivery_outbox SET status='blocked' WHERE id=job.id;
  PERFORM capture_fixture.assert((SELECT count(*)=0 FROM public.claim_public_lead_deliveries(job.id,1)),'blocked job requires explicit operator recovery');
  UPDATE public.public_lead_delivery_outbox SET status='blocked';
  FOR i IN 1..12 LOOP
    r:=capture_fixture.capture(gen_random_uuid(),'+999000001'||lpad(i::text,3,'0'));
  END LOOP;
  PERFORM capture_fixture.assert((SELECT count(*)=10 FROM public.claim_public_lead_deliveries(NULL,999)),'claim batch size is bounded');
  PERFORM capture_fixture.assert((SELECT count(*)=1 FROM public.claim_public_lead_deliveries(NULL,0)),'invalid low batch size clamps safely');
END; $$;

-- Master recheck records an audit and retains ambiguous append/destination evidence.
DO $$ DECLARE a uuid; b uuid; active_id uuid; before_audit bigint; changed integer; BEGIN
  SELECT id INTO a FROM public.public_lead_delivery_outbox ORDER BY id LIMIT 1;
  SELECT id INTO b FROM public.public_lead_delivery_outbox WHERE id<>a ORDER BY id LIMIT 1;
  SELECT id INTO active_id FROM public.public_lead_delivery_outbox WHERE id NOT IN (a,b) ORDER BY id LIMIT 1;
  UPDATE public.public_lead_delivery_outbox SET status='delivered',lease_token=NULL,lease_expires_at=NULL;
  UPDATE public.public_lead_delivery_outbox SET status='blocked',attempt_count=8,append_started_at=NULL,
    destination_json='{"fixture":"pinned"}',result_json='{"code":"prior-error"}' WHERE id=a;
  UPDATE public.public_lead_delivery_outbox SET status='uncertain',attempt_count=8,append_started_at=now(),
    destination_json='{"fixture":"pinned"}',result_json='{"code":"prior-uncertain"}' WHERE id=b;
  UPDATE public.public_lead_delivery_outbox SET status='blocked',lease_expires_at=now()+interval '2 minutes' WHERE id=active_id;
  SELECT count(*) INTO before_audit FROM public.public_lead_delivery_rechecks;
  SET LOCAL ROLE service_role;
  BEGIN
    PERFORM public.recheck_public_lead_deliveries('90000000-0000-4000-8000-000000000002',10);
    RAISE EXCEPTION 'qualification_failed: CS member could recheck';
  EXCEPTION WHEN insufficient_privilege THEN IF SQLERRM<>'delivery_recheck_master_required' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.recheck_public_lead_deliveries('90000000-0000-4000-8000-000000000003',10);
    RAISE EXCEPTION 'qualification_failed: suspended master could recheck';
  EXCEPTION WHEN insufficient_privilege THEN IF SQLERRM<>'delivery_recheck_master_required' THEN RAISE; END IF; END;
  PERFORM capture_fixture.assert((SELECT count(*)=before_audit FROM public.public_lead_delivery_rechecks),'denied recheck cannot add audit rows');
  changed:=public.recheck_public_lead_deliveries('90000000-0000-4000-8000-000000000001',10);
  PERFORM capture_fixture.assert(changed=2,'master rechecks only eligible blocked/uncertain jobs');
  PERFORM capture_fixture.assert((SELECT status='retry' AND attempt_count=0 AND append_started_at IS NULL AND destination_json='{"fixture":"pinned"}'::jsonb AND result_json='{"code":"prior-error"}'::jsonb FROM public.public_lead_delivery_outbox WHERE id=a),'safe preappend recheck preserves pinned destination and error evidence');
  PERFORM capture_fixture.assert((SELECT status='uncertain' AND attempt_count=0 AND append_started_at IS NOT NULL AND destination_json='{"fixture":"pinned"}'::jsonb AND result_json='{"code":"prior-uncertain"}'::jsonb FROM public.public_lead_delivery_outbox WHERE id=b),'ambiguous recheck remains reconciliation-only');
  PERFORM capture_fixture.assert((SELECT status='blocked' AND lease_expires_at>now() FROM public.public_lead_delivery_outbox WHERE id=active_id),'recheck cannot steal an active lease');
  PERFORM capture_fixture.assert((SELECT count(*)=before_audit+1 FROM public.public_lead_delivery_rechecks WHERE actor_member_id='90000000-0000-4000-8000-000000000001' AND delivery_count=2),'recheck audit is attributed and cardinality checked');
  BEGIN
    UPDATE public.public_lead_delivery_rechecks SET delivery_count=0;
    RAISE EXCEPTION 'qualification_failed: service could mutate append-only recheck audit';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;
END; $$;

DO $$ DECLARE summary jsonb; expected jsonb; BEGIN
  SELECT jsonb_object_agg(state,total) INTO expected FROM (
    SELECT s.state,count(d.id) total FROM unnest(ARRAY['pending','retry','processing','delivered','blocked','uncertain','skipped']) s(state)
    LEFT JOIN public.public_lead_delivery_outbox d ON d.status=s.state GROUP BY s.state
  ) totals;
  SET LOCAL ROLE service_role;
  summary:=public.get_public_lead_delivery_summary();
  PERFORM capture_fixture.assert(summary->'counts'=expected,'single aggregate summary matches all persisted delivery states');
  RESET ROLE;
END; $$;

SELECT 'PASS: real PostgreSQL atomic capture/replay/conflict, rollback, selection/membership, duplicate identity, role/RLS and lease-fencing qualification' AS result;
ROLLBACK;
