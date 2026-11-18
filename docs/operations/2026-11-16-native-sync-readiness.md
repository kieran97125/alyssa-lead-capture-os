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

- Status: resolved for editor access and source installation; business reconciliation acceptance remains open.
- The user subsequently explicitly authorized cloud Google sign-in and completed secure authentication. The original bound editor opened with edit access. Both live sources matched the retained pre-change backups before replacement; all extra live files and the appended read-only probe were preserved.
- Reloaded cloud source readback exactly matched the initial installed follow-up: main SHA-256 `bdb9d765ea9cb5e57bfd410bae8d60603f249a38ddec525bcdc2ec10d5dfe965`; workflow with retained probe SHA-256 `90103e160f87a57c42456c980d5cb94c72e77f0580e7d3bb79469961a70b4921`.
- At the execution UI label 21:27 (UI timezone), a read-only native queue/six-Account probe completed in 9,538 ms. A later native missing-only repair reached its commit phase but hit the six-minute execution limit. This is an uncertain business-write boundary, not a completed repair receipt.
- The actual CS menu opened the new sidebar. Background and manual worker failures were traced to three exactly owned, partially populated `allocating` rows. There were no shared queue-entry groups or pending source anchors in the preceding audit. An independently accepted Account relocation was correctly distinguished from actual preflight violations.
- Remaining acceptance: complete the same durable job, independently re-read source/registry/queue, verify retained staff inputs and an idempotent repeat. No direct business-row append or broad identity rebinding is authorized as a substitute.

### Accepted allocation recovery

Manual identity admission now finds unfinished allocations before any global outcome preflight, one Account and at most fifty source identities per call. It retains the existing source identity, appointment and queue entry. A source withdrawal, changed schedule, completed outcome, foreign binding, unknown before-image or colleague outcome outside the accepted before/after prefix stays blocked for review. Both discovery and a fresh pre-commit queue read must pass. Existing global ownership claims, source CAS and native write/readback remain authoritative. Recovery of an already allocated row does not inflate the added-booking count.

An uncertain Account attempt returns through identity/allocation recovery before retrying that Account. Existing coverage, durable job identity and count uncertainty are retained. Explicit manual commits now log only stage names and timing around CAS, allocation, source anchors, checkpoint, history, registry, source metadata and queue payload. Provider calls cannot be interrupted by these logs; their start record identifies an unfinished stage.

Validation: the full native contract command passed, including 99 identity tests, 51 manual workflow/sidebar tests and the expanded sanitized ownership audit. New cases cover real native allocation completion, partial payload, cross-Account recovery, repeat no-op, preserved note/zero amount and concurrent colleague outcome rejection. These local tests do not establish live completion or provider latency.

Rollback: revert the catch-up wrapper and unobserved source policy independently if required. Neither introduces a spreadsheet migration, triggers or properties. Preserve accepted successor IDs, registry/journal and source recovery anchors; rollback must not delete accepted history. Reverting unobserved source protections reintroduces the risk of timer-created successors from stale closed-source schedules. The read-only audit card requires no rollback.

## Provider transport qualification follow-up

The separately reviewed PR #161 queue/finalizer adapters were integrated while preserving this branch’s sidebar backoff and accepted-allocation recovery. Repository flags remain disabled by default. Actual isolated Google runs established 27 queue assertions and 59 finalizer assertions; the latter explicitly retains `activationQualified:false` for operator review. See `2026-11-16-native-provider-qualification.md` for the measured contract and production canary boundary.

The complete job's identity stage now defers its scoped display refresh to the final projection, while retaining the source/registry/queue readback. This avoids another full-grid display read after each accepted identity batch. Immediate staff-edit display behavior is retained. All native suites passed with 102 identity cases and 56 controller/sidebar cases. Experimental API activation remains blocked and both flags are verified false; qualification continues on the ordinary native path.


## System card: SYNC-TIMEOUT-001 — native request work budget

The ordinary native identity-recovery RPC completed in 277.253 seconds, including a 110.290-second queue payload and 216.413-second commit/readback. The next full Account worker reached `commit_source_anchors` and timed out at 361.078 seconds. A later recovery also measured a 156.036-second native container open. Provider calls themselves cannot be interrupted by a JavaScript time check. The retained job and accepted source anchors must remain authoritative.

The timeout follow-up keeps both experimental API flags false and retains the native writer:

- Complete-job identity batches admit at most one accepted identity per RPC; the normal background/staff maximum remains fifty.
- Source anchor/metadata writes merge sparse changes into native six-column spans of at most 8,192 rows (49,152 cells). Every row in each span passes fresh full-row CAS. Business columns are never written. Intervening metadata formulas retain the original sparse path. Exact unchanged metadata, numeric zero and existing pending intents are preserved.
- Each Account has a source-intent preparation RPC followed by the ordinary canonical apply RPC. Preparation stops at the existing source-anchor recovery boundary, before history/registry/account pointers/queue writes. Its receipt is flushed before acknowledging preparation, earns no Account coverage or business counters, and replay retains canonical queue identities after a lost reply. Application reacquires the common lock and re-reads/replays fresh canonical state. A new staff outcome between phases stays deferred rather than being overwritten.
- Native queue application admits one contiguous same-operation group of at most 25 rows per RPC; an Account relocation stays a single row. All planned intents/before-images remain in the canonical registry/journal before the selected group is applied. Only the selected group clears its before-images; remaining groups keep the same Account pending. Fresh source/queue snapshots determine the next group. Coverage advances only after a zero-remaining receipt, and the sidebar reports the remaining count. Intervening staff records are never included in queue writes. Lost payload acknowledgements retain stable owners and replay without duplicating lifecycle events.
- A known uncertain preparation retries preparation directly. An uncertain application retains the prior allocation-recovery admission. Legacy v1 jobs resume without resetting accepted coverage.
- A two-minute manual-client lease is renewed before lock admission. The timer checks it before and after its own lock and yields without opening the spreadsheet. Verified completion clears only that lease; expiry/invalid values cannot permanently suppress background maintenance. Staff edits and the shared document lock retain their authority.
- Native final projection is eight checkpointed RPCs: six explicit CS scopes, one full display, one whole-record sort. Failed/lost responses retain the current step; accepted prior scopes are not repeated. The sidebar reports acknowledged projection progress and the actual current operation.

Validation: the complete native contract passes, including real emitted-sidebar/controller, source transition/recovery, native metadata span, immutable queue identity, concurrent colleague edit, lost acknowledgement, zero/formula and corrupt-checkpoint tests. New deployment/readback, full ordinary-control execution, independent source/queue/master acceptance and measured post-change provider latency remain pending. No production latency improvement is claimed from local tests.

Rollback must preserve accepted source anchors, queue IDs, registry/history and the durable job. An existing prepared phase must be applied/replayed before removing preparation support. Do not erase checkpoints or reappend appointments to recover a timed-out call.


### Projection timeout follow-up

All six Account workers and six explicit CS scopes returned on the ordinary retained job. Its global display phase then reached the provider execution limit: repeated sparse column reads/writes were another unbounded flush boundary. The native complete-job display now applies one contiguous, single-column group of at most 25 generated display changes per RPC. It re-reads canonical plans/sources/queue on every call and remains at projection step six until a verified zero-remaining receipt. Only selected CS changes receive owner-intent journal rows. Accepted fields are rediscovered as no-ops after a lost reply. Other scoped/default callers retain their established behavior.

Manual native sorting now uses the uniquely governed existing `到店優先排序（內部）` column. It does not insert/delete a temporary column. A protected ownership/colleague/outcome/note/money-total digest is checkpointed before any sort-key write. An unknown retry compares this retained digest even if the rows are already ordered; changed protected data stays review rather than being overwritten. Whole-record sorting and independent post-sort preservation checks remain required.

The full native command passed after this follow-up, including real bounded-display continuation, lost display acknowledgement, native owned-helper sorting, pre-write checkpoint failure, lost sort reply, protected-data drift, financial-total preservation and controller partial-display cases. Exact installed readback and complete final-control acceptance remain separate.

### Master coverage acceptance

A fresh independent metadata/formula/effective-cell read verified the retained master and identity-bridge contract. The current six Account references remain open-ended. The historical physical grid ends at the formula's inclusive row-7000 boundary, so there is no existing historical tail beyond it. Every current projected row had a consecutive source-row position and true row parity, eligibility, unique-identity and combined guard values; no cell error or master-capacity overflow was returned. This establishes the current inclusion/identity/freshness contract without replacing either formula. Source edits remain non-atomic across separate RPCs. Published application-report cache and authenticated acquisition operator acceptance are separate boundaries.


## Native control acceptance and remaining cards

The complete ordinary control returned after all six Account workers, six CS scopes, display and sort. It retained a terminal review result for existing source/queue evidence. The latest bounded-display/owned-sort controller was saved, reloaded and read back exactly (main `9aef169864b7b8ef60aa712c22b18994f6ed631af62d326bb730a73f2f90f2ab`; controller with the preserved probe `227ff8995a70a27022508b05b1130625bef7bee217b00fc0e0cc2d2d8ecf66a9`).

A fresh normal-menu repeat also returned after all six sources and final projection. Its visible receipt reported `新增／補回 0 筆預約記錄` with verified counts, rather than the earlier unknown-count feedback. Existing review was retained. This is normal-control idempotence evidence, not a statement that every business-data conflict was resolved.

Independent provider snapshots before/after finalization and after the repeat found no missing stable record, changed appointment binding, occupied-CS change, lost note, changed financial literal/zero, changed relative-formula layout or unkeyed protected-record loss. Available effective values matched; omitted effective-value slots were empty on both observations and no amount was inferred. Earlier retained allocation samples also preserved their original owners and protected fields. The grid remained at its original column count, with no temporary sort column left behind.

Exact qualified software head `7e92f170a27ca4b671bf27508c1be5c2d21ebbbc` / tree `4571dc9bc7004dd26cd1bdaa95f483d7f9b34418` passed the full native command (schedule 76, missing/display/sort 189, identity 103, controller/sidebar 84, lifecycle/recovery 54, metadata/groups 12 and the remaining established suites). All five hosted workflows passed: CRM `43899235657`, design `43899235374`, acquisition management `43899235575`, foundation visuals `43899236116` and acquisition visuals `43899235508`. This subsequent documentation-only acceptance commit does not change those tested sources.

| Card | Current state | Boundary |
| --- | --- | --- |
| SYNC-001 accepted allocations | Accepted original allocation prefixes recovered and independently read back | Preserve original appointments/queue entries; do not reopen closed history. Business evidence needing review stays separate. |
| SYNC-002 ordinary manual control | Installed, full terminal receipt and normal-menu zero-addition repeat verified | Six-source coverage/presentation is accepted. Terminal review is not `reconciliationComplete`. |
| SYNC-004 master/identity bridge | Current inclusion/coverage/parity/identity contract independently verified | No historical tail beyond the retained bound; no formula replacement; future concurrent edits remain non-atomic. |
| OPS-SOURCE-REVIEW-001 | Open: existing source-state and deferred queue evidence | The UI reports reviewed source scopes, not unique customer conflicts. Global deferred evidence can affect several scopes. Review retained identity/provenance before any correction; do not change a historical outcome/date merely to clear a warning. |
| OPERATOR-001 | Open: authenticated acquisition operator acceptance | The production application showed its invited-account secure-link boundary. Google editor access does not provide this application session. No authentication bypass or new credential request was used. |
| SYNC-007 optional typed transports | Isolated qualification retained; production activation remains disabled | Both flags are false. The automatic-review rejection was not bypassed; the accepted repair uses native writes. |
| PROVIDER-NATIVE-CACHE | Bounded manual work and recovery qualified; sustained latency remains observation work | A single blocking provider call cannot be interrupted by a JavaScript clock check. Retain checkpoints, source CAS, shared locking and the expiring foreground lease. |

The temporary maintenance pause had already been explicitly removed. Verified full completion clears only the manual priority lease; an interrupted client lease expires automatically. No staff-edit handler or background trigger was deleted or disabled.

## November 18 manual booking sync recovery

The normal spreadsheet menu took about two seconds to open during the reported slowdown. A continuation returned after 578.567 seconds. Its execution trace recorded 238.252 seconds in final source metadata processing, 15.797 seconds in history and 16.778 seconds in queue payload. These measurements include provider waits and any implicit flush. They do not identify the cost of an individual Google operation.

The menu now checks the retained checkpoint when a callback disappears. The status read briefly tries the shared lock without opening the spreadsheet or renewing the foreground lease. Each new sidebar sends the observed step revision before attempting another write. A late start can recover the job completed since that menu opened. The old sidebar and existing checkpoints remain compatible.

Account preparation can record coverage immediately when the canonical queue, journal, registry and source metadata all certify that there are no writes. The recovery-anchor planner indexes changed appointments once per snapshot. Metadata finalization narrows its write footprint and retains fresh full-row comparisons. The initial identity and recovery reservation stays atomic. Final display and sorting remain part of the ordinary terminal receipt.

Rollback uses the previous bound main and controller together, retaining the installed probe, helper files, triggers, accepted appointments and saved progress. A native execution currently holding the lock must finish before another writer enters.
