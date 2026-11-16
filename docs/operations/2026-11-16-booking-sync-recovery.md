# Booking synchronization recovery — prepared, not released

Date: 2026-11-16 (HKT). This record separates operational repair, native booking synchronization, the formula-driven `lead` master, and website reporting refresh. None is evidence that another completed.

## Observed operational state

A bounded read of the six configured Account tabs found 168 rows marked booked. Comparing their durable appointment identities with the arrival queue found 159 present and nine missing. Two missing rows already had open registry appointments; seven needed governed identity registration. One booked row had a valid date and no time. Its time must remain blank. This is a point-in-time observation, not a promise that the live workbook is unchanged.

The existing read-only `previewMissingBookedArrivalsFast` spent 185,122 ms in its unbounded seven-tab Advanced Sheets read and failed with a provider-unavailable error. The native-only reader subsequently completed on the same workbook in 7,722 ms. This is one reader measurement, not a full-sync benchmark. The canonical reader found 16 missing candidates and four schedule gaps; candidates can resolve to existing owned records and are not an added-row/customer count.

The first governed missing-only write attempt rejected a preexisting shared queue-entry identity before any business-data mutation. The pending-finalization property was retained. A separate read-only ownership diagnostic found one shared group, one exact physical owner, one exactly sourced open appointment with no physical row, and no pending anchors or unrelated recovery changes. The allocator fix is now verified in the live editor. A reviewed, deterministic orphan-only rebind persisted the same appointment/Lead identities with a new queue identity and one revision increment. Its core commit has been read back as one managed row with cleared registry recovery state; its visible Brand/Phone/CS projection still required finalization. The interrupted editor invocation must not be treated as a wholly rejected write.

The original missing-only continuation then reached the post-registry queue-header read and failed after a 450,865 ms commit phase with a native Spreadsheet service timeout. The accepted source/registry identities and journal remain recovery evidence. No blanket completion, exact added-phone list or finished button deployment is claimed yet. Experimental API queue/finalizer adapters remain disabled until their separate qualification passes.

After the originating browser connection became unavailable, a connector read of raw phone and queue-identity cells found 559 queue identities against the saved 558-identity baseline. The one new physical row still had a blank generated phone field. This confirms partial recovery only; it is not an accepted finished booking or an added-phone report. No business-row write was attempted through the connector. Reconnect to the existing signed-in bound project, inspect current execution state and freshly read its files before resuming the retained identities.

A smaller formula-only read of `lead!A1:A2` subsequently succeeded. The live master includes all six current Account sources through open-ended `A2:Y` references, requires a nonblank Created At field, and adds eligible history through a fixed row-7000 boundary. This removes a suspected current-Account tail cap from the master formula itself. It does not establish identity-bridge completeness, history-tail completeness or a fresh operational/reporting publication. No formula was changed.

Customer data, phone numbers, raw source rows, spreadsheet identifiers and account credentials are intentionally excluded from this repository record.

## Prepared change and acceptance boundary

The native read candidate deliberately selects the existing native display readers. It does not retry an Advanced Sheets failure through a second engine. The legacy API path remains selectable for parity tests and rollback. Existing global identity checks still inspect every Account; locked discovery and authoritative raw before-images remain in the writer. Only affected sources are hydrated raw. The read-only helper emits counts and timings only.

The staff button is being changed from the missing-only command into a resumable, shared native job. Identity batches, Account reconciliation and final display/CS/sort have separate checkpoints. Existing canonical workers remain authoritative. Reconciliation must handle a source withdrawal from booking and a later explicit rebooking; old canceled, completed, No Show and retired records are never reopened from stale inputs. A permitted rebooking creates a canonical successor only with durable withdrawal evidence and keeps an unobserved registration time unknown. The original missing-only command remains available for the ordered operational repair.

An isolated VM confirmed that the previous per-Account wrapper invoked six global display passes and six sorts for six Accounts, even with zero changes. The candidate moves that work to one final phase. This verifies reduced call repetition, not a measured live speedup.

The optional queue API adapter is admitted only for append and schedule-only operations. It verifies API-visible registry intent, governed source identity or a complete pending anchor, and the exact bounded journal receipt before queue capacity or payload writes. Its local regression suite covers 85 cases, including uncertain acknowledgement, manual outcomes, numeric zero, typed HKT dates, source-anchor claims and allocator ownership. Refresh/outcome operations keep the existing native path. The optional finalizer still captures broad allocated input grids and conservatively rejects unqualified formula relocation; neither its throughput nor Google sort-expression behavior is established by local mocks. Both adapters remain off until actual isolated Google qualification succeeds.

Independent hot-path review also found native work after an identity commit: scoped display still reads the full arrival grid, accepted identity readback reads registry/queue/source rows, and identity/Account phases still flush native writes. A refresh, outcome or withdrawal operation selects the native queue writer for its entire batch. The optional queue adapter removes the specifically measured post-registry queue-header barrier only. Completing a missing-only queue payload does not establish full-button performance; its finalizer hook and the full job's remaining native barriers require separate runtime evidence.

The bound editor has been reconnected and read back. The actual main file differed from the checked-in baseline only in its localized 上午/下午 time parser; that verified parser is preserved and covered by 19 regressions. The deliberately selected native reader and allocator correction have been installed and read back. The full manual controller and experimental API write/finalizer changes remain gated on completed data recovery and real isolated qualification. A passing local regression is not a live performance result.

The operational order remains:

1. Freshly read source anchors, queue, registry and retired ownership; preserve colleague changes and all accepted outcomes.
2. Compare a native-only read with the failed API read. Install the reviewed read adapter only after this measurement.
3. Use the original locked missing-only writer, including durable anchors, registry/history, pending-finalization journal and existing ambiguity guards. Never append business rows directly through a connector as a shortcut.
4. Verify source IDs, one canonical queue owner for each accepted booking, registry/history consistency and unchanged staff/financial fields. Preserve blank times; do not invent historical registration dates. Closed, canceled, No Show and retired identities stay closed.
5. Re-run the missing-only operation to verify an idempotent no-op. Report only the phone numbers actually added, with review exceptions kept separate.
6. Then qualify the staff's manual-sync menu/button and its completion/retry feedback. A website reporting read alone cannot claim that native queue repair completed.

## Open system cards

| Card | State | Acceptance |
|---|---|---|
| SYNC-001 — Missing-booking recovery | Canonical identities accepted; queue/display completion pending | Fresh native repair receipt, source/registry/queue readback, idempotent rerun and exact added-phone list in the authorized conversation. |
| SYNC-002 — Native read engine and manual control | Reader measured and installed; full controller not released | Reviewed source readback; real menu/button run covers complete, busy, review, withdrawal/rebooking and safe retry states without changing accepted outcomes. |
| SYNC-003 — Timer and catch-up receipts | Candidate corrected; synthetic qualification passed | Identity-only, maintenance, review, disabled, busy and account-complete outcomes remain distinct; coverage advances only for actual completed Accounts; no six-call coverage assumption. |
| SYNC-004 — Formula-driven `lead` coverage | Current master anchor inspected; complete boundary proof pending | Verify identity-bridge coverage and independent source/history tails, detect joint truncation and verify source/master equality after real edits. A native arrival receipt does not establish master freshness. |
| SYNC-005 — Website snapshot reuse and complete performance reads | Observed follow-up; no application changes in this native-button fix | Complete paginated facts for an explicitly bounded scope; no production demo fallback; reuse only the same immutable accepted run within a request. Reject an interrupted read rather than publish subset totals. |
| SYNC-006 — Atomic reporting generation | Existing FND-007 remains open | Stage all fact projections, fence stale workers and atomically activate an accepted generation. Failure preserves every surface's prior accepted generation. Requires its separately verified database migration and qualification. |
| SYNC-007 — Bounded API queue and finalizer transport | Optional candidates; disabled pending qualification | Avoid the measured post-write native arrival read barrier; preserve typed dates, exact row CAS, allocating/payload/managed ownership, uncertainty recovery and staff/financial fields. Qualify on an isolated native workbook before enabling. No automatic provider fallback. |

## Recovery and rollback

Reconnect to the existing signed-in bound project; do not create a replacement workbook or broaden access. Recopy the full current editor source before changing it because save status after the lost connection is unknown. The operational backup matches the checked-in original workflow after line-ending normalization. Preserve additional live files and their retirement/recovery helpers. Never replace the whole bound project with the smaller checked-in release bundle.

Rollback code only from verified backups while retaining the localized parser and accepted stable identities. The orphan rebind has an accepted durable journal and managed queue row; restoring old duplicated queue identities is not a valid code rollback. An interrupted writer must be inspected and resumed by its current canonical identities. Never delete or reappend customer rows to reset uncertainty.
