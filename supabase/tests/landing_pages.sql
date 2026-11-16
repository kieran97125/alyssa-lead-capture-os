-- Real transaction qualification against synthetic, disposable PostgreSQL17 only.
\set ON_ERROR_STOP on
BEGIN;
SELECT acquisition_fixture.ensure_seed();
SET LOCAL ROLE service_role;
DO $$
DECLARE a jsonb; b jsonb; c jsonb; p uuid; pointer uuid; before_forms bigint; before_receipts bigint; rev bigint;
BEGIN
  PERFORM capture_fixture.assert((SELECT metadata_json=jsonb_build_object(
    'slug','legacy-public-fixture','title','原有標題 $ 388','brand_id',NULL,'treatment_id',NULL,
    'package_id',NULL,'branch_id',NULL,'form_id',NULL,'template_key','legacy-template','mode','form_only',
    'metadata_source','legacy_current_row')
    FROM public.landing_page_versions WHERE id='a1200000-0000-4000-8000-000000000001'),
    'legacy snapshot captures literal current row metadata without guessed context');
  PERFORM capture_fixture.assert((SELECT content_json->>'heroTitle'='Literal authored title' AND title='原有標題 $ 388'
    AND published_version_id='a1200000-0000-4000-8000-000000000001' FROM public.landing_pages
    WHERE id='a1100000-0000-4000-8000-000000000001'),'migration preserves original routing/title/content/pointer');

  a:=public.mutate_landing_page_v1('create',NULL,NULL,'f1000000-0000-4000-8000-000000000001',acquisition_fixture.page_document());
  p:=(a->'page'->>'id')::uuid;
  PERFORM capture_fixture.assert((a->'page'->>'revision')::int=1 AND (a->'version'->>'version_number')::int=1,'create stores first version atomically');
  b:=public.mutate_landing_page_v1('create',NULL,NULL,'f1000000-0000-4000-8000-000000000001',acquisition_fixture.page_document());
  PERFORM capture_fixture.assert(b->>'replayed'='true' AND b->'page'->>'id'=p::text,'create retries return original page identity');
  BEGIN
    PERFORM public.mutate_landing_page_v1('create',NULL,NULL,'f1000000-0000-4000-8000-000000000001',acquisition_fixture.page_document('changed-retry'));
    RAISE EXCEPTION 'changed idempotency payload should fail';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    PERFORM capture_fixture.assert(SQLERRM='acquisition_request_conflict','changed retry is explicit conflict');
  END;

  a:=public.mutate_landing_page_v1('publish',p,1,'f1000000-0000-4000-8000-000000000002','{}');
  pointer:=(a->'version'->>'id')::uuid;
  b:=public.mutate_landing_page_v1('save',p,2,'f1000000-0000-4000-8000-000000000003',
    jsonb_build_object('slug','draft-route','title','Draft title','form_id','e0000000-0000-4000-8000-000000000002',
      'content_json',jsonb_build_object('heroTitle','Draft customer headline','ctaText','Draft book now')));
  PERFORM capture_fixture.assert((SELECT slug='synthetic-page' AND title='Synthetic page'
    AND form_id='e0000000-0000-4000-8000-000000000001' AND published_version_id=pointer
    AND content_json->>'heroTitle'='Customer title' AND revision=3 AND status='published'
    FROM public.landing_pages WHERE id=p),'draft save leaves published URL/title/form/content/pointer untouched');
  PERFORM capture_fixture.assert(b->'version'->'metadata_json'->>'slug'='draft-route'
    AND b->'version'->'metadata_json'->>'form_id'='e0000000-0000-4000-8000-000000000002'
    AND b->'version'->>'page_revision'='3','draft metadata and exact preview revision are stored together');

  BEGIN
    PERFORM public.mutate_landing_page_v1('save',p,2,'f1000000-0000-4000-8000-000000000004',jsonb_build_object('title','stale overwrite'));
    RAISE EXCEPTION 'stale save should fail';
  EXCEPTION WHEN serialization_failure THEN
    PERFORM capture_fixture.assert(SQLERRM='acquisition_revision_conflict','stale editor gets revision conflict');
  END;
  PERFORM capture_fixture.assert((SELECT count(*)=3 FROM public.landing_page_versions WHERE page_id=p),'failed CAS leaves no extra version');
  PERFORM capture_fixture.assert(NOT EXISTS(SELECT 1 FROM public.acquisition_operation_receipts
    WHERE request_id='f1000000-0000-4000-8000-000000000004'),'failed CAS leaves no receipt');

  UPDATE public.forms SET status='archived' WHERE id='e0000000-0000-4000-8000-000000000002';
  BEGIN
    PERFORM public.mutate_landing_page_v1('publish',p,3,'f1000000-0000-4000-8000-000000000005','{}');
    RAISE EXCEPTION 'archived form publish should fail';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    PERFORM capture_fixture.assert(SQLERRM='landing_form_inactive','archived linked form is blocked at commit');
  END;
  PERFORM capture_fixture.assert((SELECT revision=3 AND published_version_id=pointer FROM public.landing_pages WHERE id=p),'failed publish preserves approved version and revision');
  UPDATE public.forms SET status='active' WHERE id='e0000000-0000-4000-8000-000000000002';
  a:=public.mutate_landing_page_v1('publish',p,3,'f1000000-0000-4000-8000-000000000006','{}');
  PERFORM capture_fixture.assert((SELECT slug='draft-route' AND title='Draft title'
    AND form_id='e0000000-0000-4000-8000-000000000002' AND content_json->>'heroTitle'='Draft customer headline'
    AND revision=4 AND published_version_id=(a->'version'->>'id')::uuid FROM public.landing_pages WHERE id=p),
    'publish atomically activates saved metadata and authored content');

  BEGIN
    PERFORM public.mutate_landing_page_v1('save',p,4,'f1000000-0000-4000-8000-000000000007',
      jsonb_build_object('form_id','e0000000-0000-4000-8000-000000000003'));
    RAISE EXCEPTION 'cross-brand form should fail';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    PERFORM capture_fixture.assert(SQLERRM='landing_brand_mismatch','cross-brand form cannot be selected');
  END;
  BEGIN
    UPDATE public.landing_page_versions SET content_json='{}' WHERE id=pointer;
    RAISE EXCEPTION 'published version update should fail';
  EXCEPTION WHEN foreign_key_violation THEN
    PERFORM capture_fixture.assert(SQLERRM='landing_version_immutable','published document is immutable');
  END;
  BEGIN
    UPDATE public.landing_pages SET published_version_id='a1200000-0000-4000-8000-000000000001' WHERE id=p;
    RAISE EXCEPTION 'foreign page version pointer should fail';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;

  a:=public.mutate_landing_page_v1('archive',p,4,'f1000000-0000-4000-8000-000000000008','{}');
  BEGIN
    PERFORM public.mutate_landing_page_v1('save',p,5,'f1000000-0000-4000-8000-000000000009',jsonb_build_object('title','reactivate'));
    RAISE EXCEPTION 'archived save should fail';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    PERFORM capture_fixture.assert(SQLERRM='landing_page_archived','save cannot reactivate archived page');
  END;
  b:=public.mutate_landing_page_v1('restore',p,5,'f1000000-0000-4000-8000-000000000010','{}');
  PERFORM capture_fixture.assert(b->'page'->>'status'='draft','restore requires an explicit new publish');
  BEGIN
    PERFORM public.mutate_landing_page_v1('delete',p,6,'f1000000-0000-4000-8000-000000000011','{}');
    RAISE EXCEPTION 'published history delete should fail';
  EXCEPTION WHEN foreign_key_violation THEN
    PERFORM capture_fixture.assert(SQLERRM='landing_delete_has_dependencies','published history requires archive');
  END;

  a:=public.mutate_landing_page_v1('create',NULL,NULL,'f1000000-0000-4000-8000-000000000012',acquisition_fixture.page_document('unused-draft'));
  b:=public.mutate_landing_page_v1('delete',(a->'page'->>'id')::uuid,1,'f1000000-0000-4000-8000-000000000013','{}');
  PERFORM capture_fixture.assert(b->>'deleted'='true' AND NOT EXISTS(SELECT 1 FROM public.landing_pages WHERE id=(a->'page'->>'id')::uuid),
    'unused draft and versions can be removed together');
  PERFORM capture_fixture.assert(EXISTS(SELECT 1 FROM public.forms WHERE id='e0000000-0000-4000-8000-000000000001'),'deleting a draft retains its shared form');

  -- A form referenced only by a draft version is protected from independent deletion.
  c:=public.mutate_managed_form_v1('create',NULL,NULL,'f1000000-0000-4000-8000-000000000014',acquisition_fixture.form_document());
  a:=public.mutate_landing_page_v1('save',p,6,'f1000000-0000-4000-8000-000000000015',jsonb_build_object('form_id',c->'form'->>'id'));
  BEGIN
    PERFORM public.mutate_managed_form_v1('delete',(c->'form'->>'id')::uuid,1,NULL,'{}');
    RAISE EXCEPTION 'draft referenced form should not delete';
  EXCEPTION WHEN foreign_key_violation THEN
    PERFORM capture_fixture.assert(SQLERRM='landing_form_has_version_references','draft-only form reference fences deletion');
  END;

  SELECT count(*) INTO before_forms FROM public.forms;
  SELECT count(*) INTO before_receipts FROM public.acquisition_operation_receipts;
  BEGIN
    PERFORM public.create_acquisition_assets_v1('f1000000-0000-4000-8000-000000000016',jsonb_build_object(
      'brand_id','a0000000-0000-4000-8000-000000000001','form',acquisition_fixture.form_document(),
      'page',acquisition_fixture.page_document('bad-compound')||jsonb_build_object('title',repeat('x',201))));
    RAISE EXCEPTION 'invalid LP should roll back whole compound command';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    PERFORM capture_fixture.assert(SQLERRM='landing_invalid_metadata','invalid compound LP rejected');
  END;
  PERFORM capture_fixture.assert((SELECT count(*)=before_forms FROM public.forms),'failed first LP leaves no orphan form');
  PERFORM capture_fixture.assert((SELECT count(*)=before_receipts FROM public.acquisition_operation_receipts),'failed compound leaves no inner/outer receipts');
  PERFORM capture_fixture.assert(NOT EXISTS(SELECT 1 FROM public.forms WHERE public_form_token LIKE '%f1000000000040008000000000000016'),'failed compound leaves no token');

  a:=public.create_acquisition_assets_v1('f1000000-0000-4000-8000-000000000017',jsonb_build_object(
    'brand_id','a0000000-0000-4000-8000-000000000001','form',acquisition_fixture.form_document(),'page',acquisition_fixture.page_document('atomic-new-assets')));
  b:=public.create_acquisition_assets_v1('f1000000-0000-4000-8000-000000000017',jsonb_build_object(
    'brand_id','a0000000-0000-4000-8000-000000000001','form',acquisition_fixture.form_document()||'{"token_base":"different-derived-default","conversion_mode":"thank_you_redirect","success_redirect_url":"https://changed.example.test/thanks"}'::jsonb,
    'page',acquisition_fixture.page_document('atomic-new-assets')));
  PERFORM capture_fixture.assert(a->'page'->>'form_id'=a->'form'->>'id' AND b->'page'->>'id'=a->'page'->>'id'
    AND b->'form'->>'id'=a->'form'->>'id' AND b->>'replayed'='true','compound retry returns same form/page after derived defaults change');
  PERFORM capture_fixture.assert(b->'form'=a->'form'
    AND (SELECT conversion_mode='form_submit_pixel' AND success_redirect_url IS NULL
      FROM public.forms WHERE id=(a->'form'->>'id')::uuid),'derived defaults changing after commit cannot rewrite the accepted form');
  BEGIN
    PERFORM public.create_acquisition_assets_v1('f1000000-0000-4000-8000-000000000017',jsonb_build_object(
      'brand_id','a0000000-0000-4000-8000-000000000001',
      'form',acquisition_fixture.form_document()||'{"form_name":"Changed business intent"}'::jsonb,
      'page',acquisition_fixture.page_document('atomic-new-assets')));
    RAISE EXCEPTION 'changed form intent must not replay';
  EXCEPTION WHEN invalid_parameter_value THEN
    PERFORM capture_fixture.assert(SQLERRM='acquisition_request_conflict','compound fingerprint preserves editable form intent');
  END;
  BEGIN
    PERFORM public.create_acquisition_assets_v1('f1000000-0000-4000-8000-000000000017',jsonb_build_object(
      'brand_id','a0000000-0000-4000-8000-000000000001','form',acquisition_fixture.form_document(),
      'page',acquisition_fixture.page_document('atomic-new-assets')||'{"title":"Changed page intent"}'::jsonb));
    RAISE EXCEPTION 'changed page intent must not replay';
  EXCEPTION WHEN invalid_parameter_value THEN
    PERFORM capture_fixture.assert(SQLERRM='acquisition_request_conflict','compound fingerprint preserves authored page intent');
  END;
  BEGIN
    PERFORM public.create_acquisition_assets_v1('f1000000-0000-4000-8000-000000000018',jsonb_build_object(
      'brand_id','a0000000-0000-4000-8000-000000000001','form',acquisition_fixture.form_document(),'page',acquisition_fixture.page_document('atomic-new-assets')));
    RAISE EXCEPTION 'slug conflict should roll back form';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  PERFORM capture_fixture.assert(NOT EXISTS(SELECT 1 FROM public.acquisition_operation_receipts WHERE request_id='f1000000-0000-4000-8000-000000000018'),
    'slug conflict rolls back all compound receipts');
END; $$;
RESET ROLE;
DO $$ BEGIN
  PERFORM capture_fixture.assert(NOT has_function_privilege('anon','public.mutate_landing_page_v1(text,uuid,bigint,uuid,jsonb)','EXECUTE'),'anon cannot mutate pages');
  PERFORM capture_fixture.assert(NOT has_function_privilege('authenticated','public.create_acquisition_assets_v1(uuid,jsonb)','EXECUTE'),'authenticated cannot invoke service compound writer');
  PERFORM capture_fixture.assert(NOT has_table_privilege('anon','public.landing_page_versions','SELECT'),'anon cannot read draft documents');
END; $$;
ROLLBACK;
SELECT 'PASS: LP snapshots/CAS/atomic publication/form validation/archival/compound rollback/permissions' AS result;
