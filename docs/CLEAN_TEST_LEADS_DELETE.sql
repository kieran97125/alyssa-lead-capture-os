-- DANGER: destructive cleanup script for reviewed internal test leads only.
-- Do not run this until docs/REVIEW_TEST_LEADS.sql has been reviewed and exported.
-- Prefer leaving raw data intact and using LaunchHub's default "hide test data"
-- reporting filter unless the team explicitly decides to delete test records.
--
-- Usage:
-- 1. Run REVIEW_TEST_LEADS.sql.
-- 2. Confirm every matched row is an internal test submission.
-- 3. Backup/export leads, bookings, lead_events, and lead_source_snapshots.
-- 4. Uncomment the transaction below and run manually.

/*
begin;

with suspected_test_leads as (
  select leads.id, leads.source_snapshot_id
  from public.leads
  where
    coalesce(leads.customer_name, '') ilike any (array[
      '%TEST%',
      '%FINAL TEST%',
      '%COOKIE TEST%',
      '%SERVER ATTR TEST%',
      '%LOCKED ATTR TEST%',
      '%INLINE BOOTSTRAP TEST%',
      '%LH BACKUP TEST%',
      '%LH MIXED TEST%',
      '%ALYSSA WIX TEST%',
      '%DIRECT TEST%',
      '%UTM TEST%'
    ])
    or regexp_replace(coalesce(leads.phone, leads.normalized_phone, ''), '\D', '', 'g')
      between '91234567' and '91234599'
),
deleted_bookings as (
  delete from public.bookings
  using suspected_test_leads
  where bookings.lead_id = suspected_test_leads.id
  returning bookings.id
),
deleted_events as (
  delete from public.lead_events
  using suspected_test_leads
  where lead_events.lead_id = suspected_test_leads.id
  returning lead_events.id
),
deleted_leads as (
  delete from public.leads
  using suspected_test_leads
  where leads.id = suspected_test_leads.id
  returning leads.id, leads.source_snapshot_id
)
delete from public.lead_source_snapshots
using deleted_leads
where lead_source_snapshots.id = deleted_leads.source_snapshot_id;

commit;
*/
