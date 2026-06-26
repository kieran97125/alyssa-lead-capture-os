-- CRM Phase 1 CS workflow schema review script.
-- Review in Supabase SQL editor before applying.
-- This keeps RLS enabled and does not add public/anon policies.

begin;

-- Phase 1 case statuses used by the CS inbox:
-- pending_follow_up, contacted, booked, showed, no_show, cancelled, no_reply, lost.
-- Legacy statuses remain allowed so existing rows do not break.
alter table public.crm_lead_cases
  drop constraint if exists crm_lead_cases_status_check;

alter table public.crm_lead_cases
  add constraint crm_lead_cases_status_check
  check (
    status in (
      'pending_follow_up',
      'contacted',
      'booked',
      'showed',
      'no_show',
      'cancelled',
      'no_reply',
      'lost',
      'new',
      'contacting',
      'confirmed',
      'paid',
      'invalid'
    )
  );

create index if not exists crm_lead_cases_status_next_follow_idx
  on public.crm_lead_cases (status, next_follow_up_at asc);

create index if not exists crm_lead_cases_source_lead_status_idx
  on public.crm_lead_cases (source_lead_id, status);

-- Notes:
-- - Follow-up note channel/outcome/next-follow-up details are stored in
--   crm_interactions.metadata_json and optional crm_follow_up_tasks rows.
-- - Booking/show/no-show/cancelled outcome tracking uses crm_bookings.status.
-- - Paid/unpaid display state is stored in crm_bookings.metadata_json->>'paid_status'.
-- - This script intentionally does not disable RLS and does not create anon policies.

commit;
