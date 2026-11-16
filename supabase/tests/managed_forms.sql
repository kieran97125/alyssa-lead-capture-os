-- Real PostgreSQL behavior. Isolated synthetic fixtures are rolled back.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
  IF current_database()<>'public_capture_test' THEN RAISE EXCEPTION 'Isolated database public_capture_test required'; END IF;
END; $$;
SELECT capture_fixture.seed();
CREATE FUNCTION capture_fixture.managed_payload(name text DEFAULT 'Synthetic managed form') RETURNS jsonb
LANGUAGE sql SECURITY INVOKER AS $$
  SELECT jsonb_build_object('form_name',name,'brand_id','a0000000-0000-4000-8000-000000000001',
    'default_treatment_id','b0000000-0000-4000-8000-000000000001',
    'default_package_id','c0000000-0000-4000-8000-000000000001',
    'default_branch_id','d0000000-0000-4000-8000-000000000001',
    'package_selection_mode','fixed','package_ids',jsonb_build_array('c0000000-0000-4000-8000-000000000001'),
    'branch_ids',jsonb_build_array('d0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000002'),
    'allowed_domains',jsonb_build_array('https://example.test'),'conversion_mode','form_submit_pixel',
    'success_redirect_url',null,'placement_kind','wix','placement_url','https://example.test/offer','token_base','synthetic-form');
$$;
REVOKE ALL ON FUNCTION capture_fixture.managed_payload(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION capture_fixture.managed_payload(text) TO service_role;

DO $$ DECLARE role_name text; statement text; BEGIN
  PERFORM capture_fixture.assert(NOT (SELECT prosecdef FROM pg_proc WHERE oid='public.mutate_managed_form_v1(text,uuid,bigint,uuid,jsonb)'::regprocedure),'form RPC is invoker');
  PERFORM capture_fixture.assert((SELECT relrowsecurity FROM pg_class WHERE oid='public.acquisition_operation_receipts'::regclass),'settings receipts use RLS');
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    EXECUTE format('SET LOCAL ROLE %I',role_name);
    BEGIN
      PERFORM public.mutate_managed_form_v1('create',NULL,NULL,NULL,'{}');
      RAISE EXCEPTION 'qualification_failed: public form write allowed';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    BEGIN
      PERFORM * FROM public.get_managed_form_activity_v1('{}'::uuid[]);
      RAISE EXCEPTION 'qualification_failed: public form activity allowed';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    EXECUTE 'RESET ROLE';
  END LOOP;
  SET LOCAL ROLE service_role;
  FOREACH statement IN ARRAY ARRAY['UPDATE public.acquisition_operation_receipts SET response_json=response_json WHERE false','DELETE FROM public.acquisition_operation_receipts WHERE false'] LOOP
    BEGIN EXECUTE statement; RAISE EXCEPTION 'qualification_failed: settings receipts mutable';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  END LOOP;
  RESET ROLE;
END; $$;

DO $$ DECLARE first_result jsonb; replay jsonb; edited jsonb; f uuid; token text; before_count bigint; BEGIN
  SET LOCAL ROLE service_role;
  first_result:=public.mutate_managed_form_v1('create',NULL,NULL,'f1000000-0000-4000-8000-000000000001',capture_fixture.managed_payload());
  f:=(first_result->'form'->>'id')::uuid;
  token:=first_result->'form'->>'public_form_token';
  PERFORM capture_fixture.assert(first_result->'form'->>'revision'='1','created form starts revision one');
  PERFORM capture_fixture.assert((SELECT count(*)=2 FROM public.form_branches WHERE form_id=f),'all branch links committed');
  PERFORM capture_fixture.assert((SELECT count(*)=1 FROM public.form_packages WHERE form_id=f),'fixed offer link committed');
  SELECT count(*) INTO before_count FROM public.forms;
  replay:=public.mutate_managed_form_v1('create',NULL,NULL,'f1000000-0000-4000-8000-000000000001',capture_fixture.managed_payload());
  PERFORM capture_fixture.assert(replay->>'replayed'='true' AND replay->'form'=first_result->'form','creation retry returns exact record');
  PERFORM capture_fixture.assert((SELECT count(*)=before_count FROM public.forms),'retry creates no duplicate form');
  BEGIN
    PERFORM public.mutate_managed_form_v1('create',NULL,NULL,'f1000000-0000-4000-8000-000000000001',capture_fixture.managed_payload('Different operation body'));
    RAISE EXCEPTION 'qualification_failed: reused identity accepted changed body';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  replay:=public.mutate_managed_form_v1('create',NULL,NULL,'f1000000-0000-4000-8000-000000000001',capture_fixture.managed_payload()||'{"token_base":"changed-server-default","conversion_mode":"thank_you_redirect","success_redirect_url":"https://example.test/thanks"}');
  PERFORM capture_fixture.assert(replay->>'replayed'='true' AND replay->'form'=first_result->'form','derived server defaults do not break accepted request replay');
  PERFORM public.mutate_managed_form_v1('archive',f,1,NULL,'{}');
  edited:=public.mutate_managed_form_v1('update',f,2,NULL,capture_fixture.managed_payload('Renamed archived form'));
  PERFORM capture_fixture.assert(edited->'form'->>'status'='archived','ordinary save cannot reactivate archived form');
  PERFORM capture_fixture.assert(edited->'form'->>'public_form_token'=token,'rename preserves installed token');
  PERFORM capture_fixture.assert(edited->'form'->>'id'=f::text AND edited->'form'->>'revision'='3','same record revision advances once');
  BEGIN
    PERFORM public.mutate_managed_form_v1('update',f,2,NULL,capture_fixture.managed_payload('Stale overwrite'));
    RAISE EXCEPTION 'qualification_failed: stale editor accepted';
  EXCEPTION WHEN serialization_failure THEN NULL; END;
  BEGIN
    PERFORM public.mutate_managed_form_v1('update',f,NULL,NULL,capture_fixture.managed_payload('Missing revision'));
    RAISE EXCEPTION 'qualification_failed: missing revision accepted';
  EXCEPTION WHEN serialization_failure THEN NULL; END;
  PERFORM capture_fixture.assert((SELECT revision=3 AND form_name='Renamed archived form' FROM public.forms WHERE id=f),'failed stale writes preserve settings');
  edited:=public.mutate_managed_form_v1('restore',f,3,NULL,'{}');
  PERFORM capture_fixture.assert(edited->'form'->>'status'='active','explicit restore enables form');
  first_result:=public.mutate_managed_form_v1('duplicate',f,4,'f1000000-0000-4000-8000-000000000002','{}');
  replay:=public.mutate_managed_form_v1('duplicate',f,4,'f1000000-0000-4000-8000-000000000002','{}');
  PERFORM capture_fixture.assert(first_result->'form'->>'id'<>f::text AND replay->'form'=first_result->'form','duplicate has fresh identity and stable retry');
  PERFORM public.mutate_managed_form_v1('delete',(first_result->'form'->>'id')::uuid,1,NULL,'{}');
  PERFORM capture_fixture.assert(NOT EXISTS(SELECT 1 FROM public.forms WHERE id=(first_result->'form'->>'id')::uuid),'unused clone deleted');
  PERFORM capture_fixture.assert(NOT EXISTS(SELECT 1 FROM public.form_branches WHERE form_id=(first_result->'form'->>'id')::uuid),'unused clone links atomically removed');
  RESET ROLE;
END; $$;

-- Legacy explicit choices are retained by lifecycle operations; only a missing
-- default is normalized to the first already-visible member.
DO $$ DECLARE cloned jsonb; restored jsonb; f uuid; BEGIN
  SET LOCAL ROLE service_role;
  cloned:=public.mutate_managed_form_v1('duplicate','e0000000-0000-4000-8000-000000000004',1,'f1000000-0000-4000-8000-000000000006','{}');
  f:=(cloned->'form'->>'id')::uuid;
  PERFORM capture_fixture.assert(cloned->'form'->>'default_package_id'='c0000000-0000-4000-8000-000000000002' AND cloned->'form'->>'default_treatment_id'='b0000000-0000-4000-8000-000000000002','legacy duplicate defaults match first allowed offer and its treatment');
  PERFORM capture_fixture.assert(cloned->'form'->>'default_branch_id'='d0000000-0000-4000-8000-000000000002','legacy duplicate default matches allowed branch');
  PERFORM capture_fixture.assert((SELECT array_agg(package_id)=ARRAY['c0000000-0000-4000-8000-000000000002'::uuid] FROM public.form_packages WHERE form_id=f),'duplicate does not add an unconfigured offer');
  PERFORM capture_fixture.assert((SELECT array_agg(branch_id)=ARRAY['d0000000-0000-4000-8000-000000000002'::uuid] FROM public.form_branches WHERE form_id=f),'duplicate does not add an unconfigured branch');
  PERFORM public.mutate_managed_form_v1('archive','e0000000-0000-4000-8000-000000000004',1,NULL,'{}');
  restored:=public.mutate_managed_form_v1('restore','e0000000-0000-4000-8000-000000000004',2,NULL,'{}');
  PERFORM capture_fixture.assert(restored->'form'->>'default_package_id'='c0000000-0000-4000-8000-000000000002','restore normalizes default to already-allowed offer');
  PERFORM capture_fixture.assert((SELECT count(*)=1 FROM public.form_packages WHERE form_id='e0000000-0000-4000-8000-000000000004'),'restore preserves explicit offer set');
  PERFORM capture_fixture.assert((SELECT count(*)=1 FROM public.form_branches WHERE form_id='e0000000-0000-4000-8000-000000000004'),'restore preserves explicit branch set');
  RESET ROLE;
END; $$;

-- Cross-brand/domain membership is enforced in PostgreSQL even if server validation is bypassed.
DO $$ DECLARE body jsonb; mutation jsonb; n bigint; BEGIN
  SET LOCAL ROLE service_role;
  SELECT count(*) INTO n FROM public.forms;
  FOREACH mutation IN ARRAY ARRAY[
    '{"brand_id":"a0000000-0000-4000-8000-000000000002"}'::jsonb,
    '{"default_package_id":"c0000000-0000-4000-8000-000000000003","package_ids":["c0000000-0000-4000-8000-000000000003"]}'::jsonb,
    '{"default_branch_id":"d0000000-0000-4000-8000-000000000003","branch_ids":["d0000000-0000-4000-8000-000000000003"]}'::jsonb,
    '{"allowed_domains":["javascript:alert(1)"]}'::jsonb,
    '{"placement_url":"https://user:secret@example.test"}'::jsonb
  ] LOOP
    body:=capture_fixture.managed_payload()||mutation;
    BEGIN
      PERFORM public.mutate_managed_form_v1('create',NULL,NULL,gen_random_uuid(),body);
      RAISE EXCEPTION 'qualification_failed: invalid membership or domain accepted';
    EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  END LOOP;
  PERFORM capture_fixture.assert((SELECT count(*)=n FROM public.forms),'invalid selections create no forms');
  body:=capture_fixture.managed_payload('Cross-treatment choice')||'{"package_selection_mode":"customer_choice","package_ids":["c0000000-0000-4000-8000-000000000002","c0000000-0000-4000-8000-000000000001"]}';
  mutation:=public.mutate_managed_form_v1('create',NULL,NULL,'f1000000-0000-4000-8000-000000000005',body);
  PERFORM capture_fixture.assert((SELECT array_agg(package_id ORDER BY display_order)=ARRAY['c0000000-0000-4000-8000-000000000002'::uuid,'c0000000-0000-4000-8000-000000000001'::uuid] FROM public.form_packages WHERE form_id=(mutation->'form'->>'id')::uuid),'same-brand legacy choices retain membership ordering across active treatments');
  RESET ROLE;
END; $$;

CREATE FUNCTION capture_fixture.reject_managed_membership() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF EXISTS(SELECT 1 FROM public.forms WHERE id=NEW.form_id AND form_name='Fail membership') THEN
    RAISE EXCEPTION 'synthetic membership failure' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER reject_managed_membership BEFORE INSERT ON public.form_packages
FOR EACH ROW EXECUTE FUNCTION capture_fixture.reject_managed_membership();
DO $$ DECLARE forms_before bigint; branches_before bigint; receipts_before bigint; BEGIN
  SET LOCAL ROLE service_role;
  SELECT count(*) INTO forms_before FROM public.forms;
  SELECT count(*) INTO branches_before FROM public.form_branches;
  SELECT count(*) INTO receipts_before FROM public.acquisition_operation_receipts;
  BEGIN
    PERFORM public.mutate_managed_form_v1('create',NULL,NULL,'f1000000-0000-4000-8000-000000000003',capture_fixture.managed_payload('Fail membership'));
    RAISE EXCEPTION 'qualification_failed: expected synthetic rollback';
  EXCEPTION WHEN check_violation THEN NULL; END;
  PERFORM capture_fixture.assert((SELECT count(*)=forms_before FROM public.forms),'child failure rolls back parent');
  PERFORM capture_fixture.assert((SELECT count(*)=branches_before FROM public.form_branches),'child failure rolls back earlier branch links');
  PERFORM capture_fixture.assert((SELECT count(*)=receipts_before FROM public.acquisition_operation_receipts),'child failure leaves no accepted operation receipt');
  BEGIN
    PERFORM public.mutate_managed_form_v1('update','e0000000-0000-4000-8000-000000000002',1,NULL,capture_fixture.managed_payload('Fail membership'));
    RAISE EXCEPTION 'qualification_failed: expected edit rollback';
  EXCEPTION WHEN check_violation THEN NULL; END;
  PERFORM capture_fixture.assert((SELECT revision=1 AND form_name='Synthetic Fixed A2' FROM public.forms WHERE id='e0000000-0000-4000-8000-000000000002'),'failed child edit preserves name/revision');
  PERFORM capture_fixture.assert((SELECT count(*)=0 FROM public.form_branches WHERE form_id='e0000000-0000-4000-8000-000000000002'),'failed edit restores previous branch selection');
  RESET ROLE;
END; $$;
DROP TRIGGER reject_managed_membership ON public.form_packages;

DO $$ DECLARE result jsonb; n bigint; BEGIN
  SET LOCAL ROLE service_role;
  result:=capture_fixture.capture('f1000000-0000-4000-8000-000000000004','+999000000004');
  BEGIN
    PERFORM public.mutate_managed_form_v1('delete','e0000000-0000-4000-8000-000000000001',1,NULL,'{}');
    RAISE EXCEPTION 'qualification_failed: used form deleted';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;
  PERFORM capture_fixture.assert(EXISTS(SELECT 1 FROM public.forms WHERE id='e0000000-0000-4000-8000-000000000001'),'used form preserved');
  SELECT count(*) INTO n FROM public.get_managed_form_activity_v1(ARRAY['e0000000-0000-4000-8000-000000000001'::uuid,'e0000000-0000-4000-8000-000000000002'::uuid]);
  PERFORM capture_fixture.assert(n=2,'activity includes requested unused form with truthful zero counts');
  PERFORM capture_fixture.assert((SELECT last_registration_at IS NOT NULL AND pending_count=1 AND blocked_count=0 FROM public.get_managed_form_activity_v1(ARRAY['e0000000-0000-4000-8000-000000000001'::uuid])),'activity reflects actual accepted lead and pending delivery');
  PERFORM capture_fixture.assert((SELECT last_registration_at IS NULL AND last_delivery_at IS NULL AND pending_count=0 FROM public.get_managed_form_activity_v1(ARRAY['e0000000-0000-4000-8000-000000000002'::uuid])),'unused form has no fabricated registration or delivery time');
  BEGIN
    PERFORM * FROM public.get_managed_form_activity_v1(array_fill('e0000000-0000-4000-8000-000000000001'::uuid,ARRAY[201]));
    RAISE EXCEPTION 'qualification_failed: unbounded activity read allowed';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  RESET ROLE;
END; $$;
ROLLBACK;
\echo 'Managed form transactions, CAS, lifecycle, replay, roles and activity qualification passed.'
