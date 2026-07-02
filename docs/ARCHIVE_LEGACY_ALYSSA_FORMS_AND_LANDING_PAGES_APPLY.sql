begin;

-- Legacy Alyssa cleanup review plan.
--
-- Purpose:
--   Hide old UXV2/test/demo Alyssa Landing Pages and Forms from active LaunchHub UI.
--
-- Safety:
--   - Non-destructive: archives records by status only.
--   - Does not delete leads, forms, landing pages, source snapshots, or CRM data.
--   - Does not touch active Ineffable production pages/forms.
--   - Ends with rollback for review. Change rollback to commit only after manual review.
--
-- Apply checklist:
--   1. Run the preview queries below.
--   2. Confirm the listed slugs/tokens are the intended legacy/test records.
--   3. Confirm no active Ineffable $388/$588/$780 forms/pages are included.
--   4. Review dependency counts. If unsure, archive only and do not hard delete.
--   5. Run this file in a transaction.
--   6. Verify active UI hides archived records.
--   7. Change rollback to commit only after the review is complete.

with legacy_landing_pages(slug) as (
  values
    ('alyssa-uxv2-new-lp-50969-20260615135105-8af3bf'),
    ('alyssa-uxv2-existing-form-lp-50969-20260615135105-2d0173'),
    ('alyssa-alyssa-test-lp-campaign-38463d'),
    ('alyssa-main-trial-offer')
),
legacy_forms(public_form_token) as (
  values
    ('alyssa-alyssa-hifu-trial-form-form-27a9bf'),
    ('alyssa-main-form-dev-token'),
    ('alyssa-alyssa-test-lp-campaign-form-097743'),
    ('alyssa-alyssa-test-lp-campaign-form-form-599a6b'),
    ('alyssa-alyssa-test-wix-form-form-78930d'),
    ('alyssa-uxv2-new-lp-50969-20260615135105-for-form-36b78f'),
    ('alyssa-uxv2-wix-form-50969-20260615135105-form-2736b4')
)
select
  'landing_page_preview' as section,
  lp.id::text as record_id,
  lp.slug as key,
  lp.title,
  lp.status::text,
  lp.form_id::text,
  lp.updated_at::text
from public.landing_pages lp
join legacy_landing_pages legacy on legacy.slug = lp.slug
union all
select
  'form_preview' as section,
  f.id::text as record_id,
  f.public_form_token as key,
  f.form_name as title,
  f.status::text,
  null as form_id,
  f.updated_at::text
from public.forms f
join legacy_forms legacy on legacy.public_form_token = f.public_form_token
order by section, key;

with legacy_landing_pages(slug) as (
  values
    ('alyssa-uxv2-new-lp-50969-20260615135105-8af3bf'),
    ('alyssa-uxv2-existing-form-lp-50969-20260615135105-2d0173'),
    ('alyssa-alyssa-test-lp-campaign-38463d'),
    ('alyssa-main-trial-offer')
),
legacy_forms(public_form_token) as (
  values
    ('alyssa-alyssa-hifu-trial-form-form-27a9bf'),
    ('alyssa-main-form-dev-token'),
    ('alyssa-alyssa-test-lp-campaign-form-097743'),
    ('alyssa-alyssa-test-lp-campaign-form-form-599a6b'),
    ('alyssa-alyssa-test-wix-form-form-78930d'),
    ('alyssa-uxv2-new-lp-50969-20260615135105-for-form-36b78f'),
    ('alyssa-uxv2-wix-form-50969-20260615135105-form-2736b4')
),
matched_forms as (
  select f.id, f.public_form_token
  from public.forms f
  join legacy_forms legacy on legacy.public_form_token = f.public_form_token
),
matched_pages as (
  select lp.id, lp.slug, lp.form_id
  from public.landing_pages lp
  join legacy_landing_pages legacy on legacy.slug = lp.slug
)
select
  'form_lead_dependencies' as check_name,
  count(*)::bigint as dependency_count
from public.leads l
join matched_forms f on f.id = l.form_id
union all
select
  'form_landing_page_dependencies' as check_name,
  count(*)::bigint as dependency_count
from public.landing_pages lp
join matched_forms f on f.id = lp.form_id
union all
select
  'landing_page_version_dependencies' as check_name,
  count(*)::bigint as dependency_count
from public.landing_page_versions lpv
join matched_pages lp on lp.id = lpv.page_id
union all
select
  'landing_page_linked_form_dependencies' as check_name,
  count(*)::bigint as dependency_count
from matched_pages
where form_id is not null;

with legacy_landing_pages(slug) as (
  values
    ('alyssa-uxv2-new-lp-50969-20260615135105-8af3bf'),
    ('alyssa-uxv2-existing-form-lp-50969-20260615135105-2d0173'),
    ('alyssa-alyssa-test-lp-campaign-38463d'),
    ('alyssa-main-trial-offer')
)
update public.landing_pages lp
set
  status = 'archived'::public.landing_page_status,
  updated_at = now()
from legacy_landing_pages legacy
where lp.slug = legacy.slug
  and lp.status <> 'archived'::public.landing_page_status;

with legacy_forms(public_form_token) as (
  values
    ('alyssa-alyssa-hifu-trial-form-form-27a9bf'),
    ('alyssa-main-form-dev-token'),
    ('alyssa-alyssa-test-lp-campaign-form-097743'),
    ('alyssa-alyssa-test-lp-campaign-form-form-599a6b'),
    ('alyssa-alyssa-test-wix-form-form-78930d'),
    ('alyssa-uxv2-new-lp-50969-20260615135105-for-form-36b78f'),
    ('alyssa-uxv2-wix-form-50969-20260615135105-form-2736b4')
)
update public.forms f
set
  status = 'archived',
  updated_at = now()
from legacy_forms legacy
where f.public_form_token = legacy.public_form_token
  and coalesce(f.status, '') <> 'archived';

select
  'post_archive_landing_pages' as section,
  slug,
  title,
  status::text,
  updated_at
from public.landing_pages
where slug in (
  'alyssa-uxv2-new-lp-50969-20260615135105-8af3bf',
  'alyssa-uxv2-existing-form-lp-50969-20260615135105-2d0173',
  'alyssa-alyssa-test-lp-campaign-38463d',
  'alyssa-main-trial-offer'
)
union all
select
  'post_archive_forms' as section,
  public_form_token as slug,
  form_name as title,
  status::text,
  updated_at
from public.forms
where public_form_token in (
  'alyssa-alyssa-hifu-trial-form-form-27a9bf',
  'alyssa-main-form-dev-token',
  'alyssa-alyssa-test-lp-campaign-form-097743',
  'alyssa-alyssa-test-lp-campaign-form-form-599a6b',
  'alyssa-alyssa-test-wix-form-form-78930d',
  'alyssa-uxv2-new-lp-50969-20260615135105-for-form-36b78f',
  'alyssa-uxv2-wix-form-50969-20260615135105-form-2736b4'
)
order by section, slug;

rollback;
