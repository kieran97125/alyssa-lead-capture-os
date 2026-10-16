# Pending schedule date reconciliation

The operator reported 16 October pending customers in the App versus 18 pending appointments in the native arrival queue. Fresh reads identified exactly two authoritative registry dates outside October while the same durable appointments in their Account source rows and arrival rows both held native October date values. All 18 queue entries had distinct Account/customer identities; no deduplication change was needed.

## Diagnosis

- The native `_arrival_pending_metrics` projection also contained only 16 October appointments. Its two excluded appointments had registry dates in December. The App uses these registry schedules as well, so the discrepancy preceded snapshot publication.
- The journal retained the wrong dates from initial registration. Both source and queue dates were native numeric DATE values, not ambiguous displayed strings, and their appointment times and durable Lead/Appointment/Queue IDs agreed.
- The saved native worker deliberately defers a managed queue whose schedule disagrees with its registry. That protects staff edits but also leaves an existing conflicting schedule unresolved after a successful marketing sync.
- The current saved date parser correctly interprets the native date serial, the local day/month/year string, ISO day and Date object in the synthetic regression. The historical parser/version that originally registered the conflicting dates was not established in this investigation; do not describe an unverified runtime parsing defect as proven.
- The latest production metric publication before repair completed on 2026-10-07 at 13:07 HKT. No privileged application login or one-off server synchronization was performed.

## Native correction

The two dates were reconciled only after exact Account-source/queue agreement. An immediate fresh preflight required matching Lead ID, Appointment ID, Queue Entry ID, Account and customer key; a single current source pointer; active/blank-outcome registry; booked source; pending queue; identical native source/queue dates and times; matching revisions; and no outstanding recovery anchor or queue checkpoint.

A single native batch changed only registry scheduled day, revision, last-seen schedule and updated timestamp, plus the arrival queue's internal scheduled-day mirror and revision. Two explicit correction events and two higher-revision recovery checkpoints were appended to the journal in the same batch. Original history was retained. No booking registration dates, outcomes, phones, customer/appointment identities, Account/Brand dimensions, source tags, raw source dates or formula logic were rewritten.

## Verification

- Native monthly pending changed from 16 to 18. The 18 pending metric Appointment IDs, Account/customer identities and scheduled days exactly matched the 18 October pending queue records.
- By Account, pending was 5 / 6 / 1 / 6 for the four Accounts with October pending activity.
- Lead/Book/Show/No Show stayed 181/35/12/2 across the correction.
- Exact field comparison confirmed preservation of every registry field outside the four intended fields, and every queue field outside its two intended internal fields, including the manual source extension.
- `node scripts/test-pending-schedule-date-recovery.mjs <saved-native-source.gs>` executes the saved native parser/worker/journal replay and the current App pending authority: conflict deferral before repair, agreement after repair, old checkpoint non-reversion, corrected checkpoint recovery, and 16-to-18 October projection all pass with synthetic inputs.
- Saved producer regression input: SHA-256 `af01ab2afcfef3edce7f516faa8a75ea62719d8489a03b2289fcc593797100d4`. It is the October 6 readback, not a new complete runtime readback.

## Remaining acceptance and rollback

Observe the next ordinary operator-button metric refresh and native Account-worker cycle. The saved App snapshot was not republished by this repair; an operator must use the normal sync flow to publish the corrected schedules. Track this acceptance under #114. Physical retirement of the legacy confirmation-date schema remains a separate open item there.

Rollback, if later source evidence contradicts the reconciled schedule, must use another verified correction at a higher revision with journal checkpoints. Never truncate history, decrement revisions or change the headline count directly.
