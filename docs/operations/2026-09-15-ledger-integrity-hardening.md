# Ledger integrity and selective database hardening

## Scope
This release hardens the immutable event reader; it does not claim the separate Apps Script writer, hosted Auth configuration, or dependency-security release is complete.

- A populated event ledger with invalid/ambiguous headers fails explicitly rather than silently using legacy dates.
- Exact duplicate event IDs are idempotent; contradictory IDs fail without disclosing customer identities.
- Spreadsheet serial dates are range-checked before conversion; explicit timestamp instants use the Hong Kong calendar day.
- Existing empty-ledger compatibility, brand + phone grouping, earliest Book and current-state pending rules remain unchanged.
- Local deterministic verification: 21 synthetic regression cases passed. The same cases are included in the existing hosted Playwright suite.
- Read-only live inspection confirmed the writer is already producing events; a separate writer-integrity review remains required. Do not repeat the previous assumption that no writer is active.

## Database change
Migration `20260915031135_lead_event_reference_indexes_hardening` adds only `lead_events_contact_created_idx` and `lead_events_snapshot_created_idx`. Existing indexes, table data and RLS remain unchanged. Migration was applied successfully through the connected database tool.

The same synthetic contact-reference query changed from sequential scan to index scan after migration. This demonstrates the specific lookup path only, not an application-wide latency claim. Smaller tables and other advisor suggestions were not mass-indexed.

## Remaining boundaries
- The attempted new dependency-upgrade workflow was blocked by the platform safety check; no equivalent workaround was used. Dependency versions are unchanged by this release.
- Hosted leaked-password protection requires an authorized Auth-management setting action; SQL indexes do not enable it.
- A real-mailbox Auth invitation test requires a dedicated QA identity and must not mutate staff or owner identities.
- Existing incomplete or historically imported Sheet events are not rewritten, deleted or backdated by the reader patch.

## Rollback
Revert this reader/test change through a normal reviewed PR. Index rollback, only if justified by measured write cost, is limited to dropping the two indexes named above; never drop tables or disable RLS. The separate Apps Script cutover marker must not be reset.
