SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '20s';
-- Reverse FK lookups on the growing event ledger currently require a full scan.
-- Preserve the existing lead_id index and add only the two uncovered references.
CREATE INDEX IF NOT EXISTS lead_events_contact_created_idx
  ON public.lead_events (contact_id, created_at DESC);
CREATE INDEX IF NOT EXISTS lead_events_snapshot_created_idx
  ON public.lead_events (source_snapshot_id, created_at DESC);
COMMENT ON INDEX public.lead_events_contact_created_idx IS 'Supports contact-scoped event history and reverse FK checks; added after production plan review.';
COMMENT ON INDEX public.lead_events_snapshot_created_idx IS 'Supports source-snapshot event lookup and reverse FK checks; no change to RLS or event data.';
