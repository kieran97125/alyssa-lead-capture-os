# Native synchronization readiness

The Account tabs, 到店紀錄 and lowercase `lead` worksheet have different completion boundaries. This audit inspected the recovered PR159 source (`17c533792e1309c189b110015561ac531484897c`). On 2026-11-16 the parent task also obtained the current live `lead!A2` formula through a narrow read. No customer rows were changed and no Apps Script deployment or live timing qualification was performed by this audit.

## Corrected catch-up receipt

`catchUpOmniArrivalV2` previously required every successful timer call to return an Account. The timer also legitimately returns after an accepted identity batch, an identity review or workflow maintenance. A synthetic VM reproduced the resulting `unexpected timer result` failure after a valid identity-only result.

The catch-up wrapper now recognizes those existing preparatory receipts and stops with explicit pending/review feedback. It neither counts them as reconciled Accounts nor starts additional synchronous work. Locking, shared cursor, trigger policy, 50-record identity bound, the six-call/200-second admission budget, source CAS, journal ordering, recovery markers and all worker writes remain unchanged.

| Receipt | Meaning |
| --- | --- |
| `scope: native_arrival_reconciliation` | The receipt describes native arrival workers only. |
| `coverageComplete` | All six distinct Account workers returned in this invocation. |
| `reconciliationComplete` | Coverage is complete, no source/queue review remains and CS projections succeeded. |
| `nativeState: pending` | Identity/maintenance, admission, time or projection work remains. |
| `nativeState: review` | Reported identity failures or deferred source/queue evidence requires review. |
| `masterProjectionVerified: false` | The separate lowercase `lead` formula has not been verified by this function. |

An accepted native commit can precede a failed display or CS projection. Pending feedback must preserve the accepted IDs and recovery journal; it must never restart an unverified append. A real worker exception still propagates, and unknown receipts remain errors.

Validation: `node scripts/test-native-catch-up.cjs` executes the actual wrapper with synthetic timer responses and no spreadsheet service. It covers complete and repeated Account coverage, accepted identity/maintenance, identity review, failed CS projection, deferred evidence, busy/staff priority/disabled admission, time reserve and real/unknown failures. Existing schedule, missing-only, identity and isolation suites remain required before release.

## Lowercase lead authority and evidence

There is no master-rebuild function in the reviewed native source. `OMNI_MASTER_SHEET = 'lead'` is used for formatting/setup checks; Account changes reach the master through Google Sheets formulas. The original menu called `syncAllBookedArrivals` invoked the separate missing-only arrival utility, not a master rebuild or full outcome reconciliation. The separately tested manual full-sync orchestration changes that menu path, while leaving the formula producer intact.

The fresh live master formula uses `LET` and `withAccount(src,acct)`. Each of the six current Account sources is an open-ended `A2:Y` reference, admitted when column B is nonblank. There is no fixed 5,000-row limit on those six sources in this formula. The historical CS source is independently bounded at `A2:Y7000`, with nonblank B and AA equal to `可納入總Lead`. The combined rows also require nonblank B and meaningful payload in columns 6–20 or 22–25. Columns A/B pass through date normalization before the result is sorted by the first column. These are the verified inclusion rules, not proof of recalculation freshness or identity-bridge coverage.

Historical evidence in `release-evidence/edited-account-batch-20261006/README.md` records an applied direct-reference identity-bridge change with 7,502 identical output rows. Its `bridge-applied.json` preserves source bounds including Aesthetics business rows through 4,988, identity rows through 4,996, GOS business rows through 4,997 and the other Account limits around 5,000. These are historical artifacts, not current live bounds. The earlier `bridge-direct-reference-20261006` candidate explicitly says it was not applied; it must not be mistaken for deployment evidence.

The identity bridge independently reconstructs a bounded source projection and checks equality against `lead`. If the master and bridge both omit the same historical tail, equality alone cannot establish completeness. Independent meaningful-row counts beyond historical row 7,000 and the current identity-bridge formula/bounds still require fresh evidence. The verified six-source master has no current Account tail cap; no speculative master formula rewrite is justified.

## Manual source status policy

The full-sync workflow calls `oa2ProcessAccount_(ss,sheet,'scan',null,false,undefined,{manualComplete:true})`. The same unobserved-source safety policy also applies to ordinary non-initialization workers, so a later timer cannot undo a manual review. Only the actual admitted status/date/time edit rectangle or an explicit `forceNew` edit retains observed-booking semantics; unrelated rows scanned in that execution stay protected. Source `已預約` → a lead/follow-up status cancels the same still-open appointment; it refreshes the existing arrival row to `取消` and retains the row, stable IDs, notes, colleague and amounts.

A missed reverse transition can create one canonical successor only when the current canceled appointment is exactly owned by a unique source record, its closed queue input is unchanged (or matches an existing durable recovery before-image), and its latest lifecycle journal event proves a source withdrawal at the current revision. The proof accepts source reconciliation events, rejects explicit queue cancellation, and does not use `lastStatus`, which an earlier scan may have overwritten. The original canceled appointment remains immutable history. The successor uses the existing deterministic ID and has unknown Book registration time; a scan is never converted into an observed booking edit.

Immediately before accepting a source reversal, the existing global identity-claim guard re-reads all six Accounts' governed metadata. Its scope includes the retained appointment lineage, not just the proposed new pointer. A copied stable ID, outside pointer or pending recovery anchor claiming the same lineage rejects the commit. The allocator also rejects an already occupied canonical successor ID before changing any prior appointment; accepted history cannot be overwritten even if the stored lineage is corrupted. Source-only review counts remain separate from actual queue conflicts.

Proof lookup runs only for eligible canceled-to-booked candidates. It reads at most 4,000 recent journal rows in reverse 500-row pages and stops when candidates resolve. Missing, older, malformed or conflicting evidence remains review. Completed Show/No Show, explicit cancellation, retired rows and ambiguous successor chains cannot be reopened from changed source dates/statuses. Unchanged completed history is retained without artificial review. `manualReviewCount` and `deferredSourceRecords` expose unresolved rows; `manualRebookedCount` reports accepted source reversals. Review filtering happens after ownership validation and before queue absorption, and the existing source/queue CAS and journal commit remain authoritative.

Validation: `node scripts/test-native-source-status.cjs` runs real transition, source-anchor, registry, history, allocation and queue-write code against a synthetic workbook. It verifies retained withdrawal history, canonical reversal exactly once, old pointer recovery, unknown Book time, overwritten status, closed/retired review isolation, bounded proof reads, ownership rejection and concurrent source/queue input preservation. Actual timer tests prove it cannot undo a manual Show/No Show review. Observed edit/force-new tests retain legitimate canonical rebooking and registration provenance. Global display/sort is independently covered by the manual workflow suite.

The pure transition also no longer allocates a completed appointment's successor from an unobserved date change. A genuine observed booking edit or a governed force-new transition is required. Explicit initialization remains a separate setup path. Live deployment/readback and performance measurements remain separate release gates.

## Explicit manual admission

The full-sync sidebar supplies the internal boolean `manualRequested: true` after acquiring the document lock. This bypasses only the global recent-staff-activity idle hint, which can otherwise postpone the button indefinitely during normal CS work. Background timers retain their existing idle-hint admission. The flag does not mean `staffEdit` or `bookingMutation`, does not increase the fifty-identity batch bound, and does not bypass document locks, fresh source CAS, global identity claims, journal or outcome guards. Imported booking time remains unknown. Non-boolean truthy flag values do not receive manual admission.

The identity suite verifies booked and simple-identity progress under an active idle hint, the fifty-row bound, strict boolean admission, retained background yielding, unheld-lock rejection, concurrent colleague edits and duplicate global-ID review. Live execution timing is still unmeasured.

## System card: NATIVE-LEAD-MASTER-COMPLETENESS

- Status: current master inclusion formula verified; historical-tail completeness, current bridge coverage and live freshness evidence remain pending. Production repair and deployment are separate gates.
- Owner: Alyssa native spreadsheet synchronization.
- Retain the verified current master formula contract. Obtain exact current headers, independent last meaningful historical rows, current identity-bridge bounds and fresh recalculation/coverage receipts from the governed workbook. Retain only hashes, counts and contract diagnostics in shared evidence.
- Prove that every eligible Account/history row is covered once by the master and its bridge; rows beyond a shared formula bound must be detected independently. Include source insert/delete, cleared dates, missing IDs and duplicate IDs in synthetic qualification.
- Keep booked/scheduled blank identities pending/review. Unscheduled enquiries retain the existing narrowly validated pre-registration compatibility.
- Do not rebuild/sort every worksheet on a no-op. Preserve formula-driven master updates; consider compact source manifests and execution-local Lead/Appointment indexes before replacing the producer.
- A future combined button may declare end-to-end success only after native reconciliation and an independently verified fresh/complete master projection. A native receipt alone is insufficient.
- Preserve retired row-change monitoring, source CAS, journal/recovery intents, staff fields and last-good published snapshots. No DDL or speculative formula replacement belongs to this fix.

## Sidebar transport recovery candidate

The manual control now retries an uncertain transport result after bounded 2/5/10-second delays, using the same durable job identity. The backend remains responsible for resolving an interrupted attempt; the browser never infers that a failed response means no write occurred. Offline state pauses dispatch. An online event resumes eligible pending work. Permanent identity review, disabled installation, exhausted retry admission and verified completion do not restart automatically. Explicit retry cancels an outstanding timer before dispatch; request-sequence guards ignore obsolete callbacks.

The actual emitted sidebar JavaScript is exercised by the native manual suite: all 51 cases pass, including offline startup, reconnect, bounded backoff, lost response, retained job identity, manual retry cancellation, stale callbacks, review isolation and completion. The existing native checkpoint, lock, ownership, journal and CAS tests remain required. These are candidate tests, not a live installation, measured provider recovery or proof that network disconnections have been eliminated.

Closing a sidebar retains the server checkpoint for reopening. This candidate does not claim that browser timers continue after a window closes. Existing background source maintenance remains a separate worker.

### System card: SCRIPT-DEPLOYMENT-AUTHORITY

- Status: blocked; the native candidate has not been installed by this takeover.
- The active mobile session has connected Sheet-reading tools but no Apps Script project-write tool or connected desktop editor. The separate cloud browser is not signed into the required Google account.
- Automatic approval review rejected opening the cloud Google sign-in flow because explicit authority for that browser sign-in was not established. Do not retry that authentication action or use a different surface as a workaround without the required explicit authorization.
- Acceptance: a legitimately authorized editor or script-project deployment channel, fresh exact-source comparison, candidate save/readback, real button execution, durable source/registry/queue verification and idempotent repeat. No real business-row append is a substitute for the native writer.

Rollback: revert the catch-up wrapper and unobserved source policy independently if required. Neither introduces a spreadsheet migration, triggers or properties. Preserve accepted successor IDs, registry/journal and source recovery anchors; rollback must not delete accepted history. Reverting unobserved source protections reintroduces the risk of timer-created successors from stale closed-source schedules. The read-only audit card requires no rollback.
