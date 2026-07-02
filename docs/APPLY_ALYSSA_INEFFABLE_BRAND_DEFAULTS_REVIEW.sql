begin;

-- Alyssa / Ineffable LaunchHub brand defaults review.
--
-- Purpose:
--   Align database brand/form defaults with the LaunchHub thank-you redirect model.
--
-- Safety:
--   - Proposal only. Ends with rollback by default.
--   - Does not touch leads, source snapshots, CRM records, Google Sheets sync, Pixel code, or Wix code.
--   - Does not add data-pixel-id to generated embeds.
--   - Preserves valid explicit success_redirect_url values by only filling missing values here.
--
-- Manual apply checklist:
--   1. Review preview queries.
--   2. Confirm brand rows use slugs alyssa and ineffable / ineffable-beauty.
--   3. Confirm active production Alyssa forms are intended to use /thankyou.
--   4. Confirm active production Ineffable forms are intended to use /thank-you.
--   5. Keep legacy/test records archived, not production-active.
--   6. Change rollback to commit only after review.

select
  id,
  name,
  slug,
  default_thank_you_url,
  updated_at
from public.brands
where slug in ('alyssa', 'ineffable', 'ineffable-beauty')
order by slug;

select
  f.id,
  f.form_name,
  f.public_form_token,
  b.slug as brand_slug,
  t.slug as treatment_slug,
  p.promo_price,
  f.status,
  f.conversion_mode,
  f.success_redirect_url
from public.forms f
join public.brands b on b.id = f.brand_id
left join public.treatments t on t.id = f.default_treatment_id
left join public.packages p on p.id = f.default_package_id
where b.slug in ('alyssa', 'ineffable', 'ineffable-beauty')
order by b.slug, f.form_name;

update public.brands
set
  default_thank_you_url = 'https://www.alyssa.hk/thankyou',
  updated_at = now()
where slug = 'alyssa';

update public.brands
set
  default_thank_you_url = 'https://www.ineffablebeautyhk.com/thank-you',
  updated_at = now()
where slug in ('ineffable', 'ineffable-beauty');

-- Fill missing Alyssa thank-you redirect config for non-archived records.
-- Existing valid explicit URLs are left untouched by this proposal.
with alyssa_form_targets as (
  select
    f.id,
    concat(
      'https://www.alyssa.hk/thankyou?submitted=1&treatment=',
      coalesce(nullif(t.slug, ''), 'offer'),
      case
        when coalesce(p.promo_price, p.original_price) is null then ''
        else concat('&value=', round(coalesce(p.promo_price, p.original_price))::text)
      end
    ) as success_redirect_url
  from public.forms f
  join public.brands b on b.id = f.brand_id
  left join public.treatments t on t.id = f.default_treatment_id
  left join public.packages p on p.id = f.default_package_id
  where b.slug = 'alyssa'
    and coalesce(f.status, 'active') <> 'archived'
    and (
      f.success_redirect_url is null
      or f.success_redirect_url = ''
      or f.success_redirect_url ilike '%/thank-you%'
    )
)
update public.forms
set
  conversion_mode = 'thank_you_redirect',
  success_redirect_url = alyssa_form_targets.success_redirect_url,
  updated_at = now()
from alyssa_form_targets
where public.forms.id = alyssa_form_targets.id;

with ineffable_form_targets as (
  select
    f.id,
    concat(
      'https://www.ineffablebeautyhk.com/thank-you?submitted=1&treatment=',
      coalesce(nullif(t.slug, ''), 'offer'),
      case
        when coalesce(p.promo_price, p.original_price) is null then ''
        else concat('&value=', round(coalesce(p.promo_price, p.original_price))::text)
      end
    ) as success_redirect_url
  from public.forms f
  join public.brands b on b.id = f.brand_id
  left join public.treatments t on t.id = f.default_treatment_id
  left join public.packages p on p.id = f.default_package_id
  where b.slug in ('ineffable', 'ineffable-beauty')
    and coalesce(f.status, 'active') <> 'archived'
    and (
      f.success_redirect_url is null
      or f.success_redirect_url = ''
    )
)
update public.forms
set
  conversion_mode = 'thank_you_redirect',
  success_redirect_url = ineffable_form_targets.success_redirect_url,
  updated_at = now()
from ineffable_form_targets
where public.forms.id = ineffable_form_targets.id;

select
  f.id,
  f.form_name,
  f.public_form_token,
  b.slug as brand_slug,
  f.status,
  f.conversion_mode,
  f.success_redirect_url
from public.forms f
join public.brands b on b.id = f.brand_id
where b.slug in ('alyssa', 'ineffable', 'ineffable-beauty')
order by b.slug, f.form_name;

rollback;
