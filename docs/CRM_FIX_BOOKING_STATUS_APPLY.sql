-- CRM booking-status hotfix cleanup.
-- Review in Supabase SQL editor before applying.
-- This fixes obvious CRM cases that were incorrectly marked booked only because
-- a website form lead contained a customer preferred appointment date/time.
--
-- Business rule:
-- - Form submission = new / 待跟進.
-- - Customer appointment date/time = preference only.
-- - booked / 已預約 means CS confirmed the booking internally.

begin;

-- Preview rows that this cleanup would update.
select
  lc.id,
  lc.source_lead_id,
  lc.brand_slug,
  lc.source_type,
  lc.status,
  lc.booking_id,
  lc.metadata_json,
  lc.created_at,
  lc.updated_at
from public.crm_lead_cases lc
where lc.source_type = 'landing_form'
  and lc.status in ('booked', 'confirmed')
  and lc.booking_id is null
  and coalesce(lc.metadata_json->>'source', '') = 'launchhub_bootstrap'
  and not exists (
    select 1
    from public.crm_interactions i
    where i.case_id = lc.id
      and i.interaction_type = 'booking'
  )
  and not exists (
    select 1
    from public.crm_status_history h
    where h.case_id = lc.id
      and h.new_status in ('booked', 'confirmed')
      and coalesce(h.changed_by, '') <> ''
      and h.changed_by <> 'system'
  )
order by lc.created_at desc;

-- Apply after review.
update public.crm_lead_cases lc
set
  status = 'new',
  updated_at = now(),
  metadata_json = coalesce(lc.metadata_json, '{}'::jsonb) ||
    jsonb_build_object(
      'booking_status_hotfix', 'reset_form_preference_to_new',
      'booking_status_hotfix_at', now()
    )
where lc.source_type = 'landing_form'
  and lc.status in ('booked', 'confirmed')
  and lc.booking_id is null
  and coalesce(lc.metadata_json->>'source', '') = 'launchhub_bootstrap'
  and not exists (
    select 1
    from public.crm_interactions i
    where i.case_id = lc.id
      and i.interaction_type = 'booking'
  )
  and not exists (
    select 1
    from public.crm_status_history h
    where h.case_id = lc.id
      and h.new_status in ('booked', 'confirmed')
      and coalesce(h.changed_by, '') <> ''
      and h.changed_by <> 'system'
  );

commit;
