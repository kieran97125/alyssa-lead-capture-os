# Manual Sheet sync: enquiry registration timing

## Observed failure

Two 2026-10-07 UTC audit runs failed during `google_read` with `bridge_row` in 3,127 ms and 2,984 ms. These were projection-validation failures, not provider timeout errors. Three fresh, unscheduled enquiries were eligible in the master table before their stable native row IDs were assigned; verified/source-unique flags were consequently false. The background worker subsequently registered them.

The observed enquiry ingestion channel is not established. Separately, code inspection found that the website native append also left the optional `Omni Lead ID` column empty. API appends do not fire native `onEdit`. Native editing was addressed separately in draft PR #116.

## Resulting behavior

- Native website appends align the stable source ID into the same request as the business fields when the destination includes the optional header. Legacy 25-column and v5 receiver layouts remain compatible.
- A blank-ID enquiry may be read only with exact master equality, matching Account/metric identity, correct eligibility flags, no appointment pointer, lead status and no scheduling/confirmation evidence. It cannot produce an owned appointment. Booked or scheduled blank-ID rows still fail closed with a specific retryable diagnostic.
- Native Lead-delivery health no longer advances the metric sync cursor or clears metric failure state. The database update excludes an active metric sync lease.
- Duplicate IDs, malformed flags, master drift, Account mismatches, registry ownership failures and coverage gaps still reject the snapshot. Successful acceptance retains existing Lead/Book/Show rules.

## Capacity work

Allocated native grid cells were 7,507,850. The two historical tabs allocate 211,440 cells (2.8%) and remain active dependencies of the master/identity formulas and historical owner projection. Direct deletion would change historical Lead and later Book statistics.

After reading the entire two retired helper grids and freshly checking the tails, removed only empty rows 1001–30000 from `_dashboard_show` and `_arrival_bridge_qa`. Headers, tab IDs, columns and formulas remain. Allocation is now 5,883,850: 1,624,000 fewer empty cells (21.6%). This is not a measured latency improvement. Archive history only after replacing all master, bridge and owner dependencies with a compact historical index.

## Evidence and limits

- `verify:lead-sync-recovery-contract` passes, including actual native writer HTTP mocking, lease/cursor protection, pre-registration enquiry equivalence and existing corruption/retry/publication cases.
- `verify-public-lead-contract.mjs` and `test-lead-book-dimensions.mjs` pass; 16 unique Books retain the 14/2 source Brand split in the established fixture.
- A read-only fresh native snapshot after grid trimming parsed 7,550 source rows, 7,365 groups and 223 registry entries. Replaying the three observed blank-ID rows reproduces `bridge_row` using the original validator; the repaired validator accepts them with identical period totals.
- No production test Leads, one-off metric sync or privileged application login was used for this verification. An actual user-button run and native editing latency follow-up remain to be verified (issue #115 / #104). The existing date cleanup follow-up #114 is separate.

Rollback the code commit to restore previous validators/writer behavior. Empty-grid dimensions can be restored by appending 29,000 empty rows to each retained tab; no historical data restoration is required.
