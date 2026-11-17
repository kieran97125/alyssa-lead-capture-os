# Dashboard registration incident — current publication recovered, sustained acceptance open

## Latest verification — 2026-11-17 12:44 HKT

The earlier missing-registration observation below is historical. A fresh source read now contains stable Lead and Appointment identities for the questioned booking. Its bridge has verified ownership, exact master equality, eligible payload and unique source identity. Independent registry and queue reads each find exactly one matching appointment with the same Lead ID, queue entry, scheduled day and time. The registry is active and the queue is waiting for arrival. Blank legacy booking-registration time is accepted by the existing contract and is not evidence that this source row is invalid. No business cell or ownership metadata was changed in this follow-up.

The ordinary authenticated Dashboard button completed twice. The first source success advanced to 12:42:08.798 HKT with completed audit `3570cbbc-692e-4838-82d5-f5ddfdb75077`; the normal repeat advanced to 12:44:55.096 HKT with completed audit `6a4b59aa-5992-4cdd-b931-74381dbefc52`. Both accepted 9,657 source rows and persisted a new dashboard snapshot. Both normal controls reported 1/1 source success. The identities and exact registry/queue ownership were unchanged on readback.

This establishes current Lead/Book/Show publication recovery. It does not attribute identity convergence to the canceled helper, demonstrate a new code fix, or establish sustained native/provider latency. The second result separately reported that the `mkt_dashboard` advertising-spend mirror had not updated; that warning does not negate its successfully persisted lead snapshot. The incident stays open for sustained native/provider acceptance and the separate spend-mirror warning. Draft PR #163 remains prepared diagnostics, not a claimed production remediation.

## Initial boundary — before the successful normal updates

Source baseline: production release `393792263724681ee22d82766bba460eb79ce205` / PR #160. That release accepted the native manual controller and its then-current repeat. It did not qualify a later website refresh or every newly imported row.

On 2026-11-17 the actual authenticated Dashboard operation failed with `bridge_registration_pending`. The persisted audit recorded two complete read/validation attempts (3,117 / 3,157 ms) and no new publication. The last accepted source refresh remained 2026-11-16 19:57 HKT.

A direct, read-only copy from the authenticated Sheet UI independently located a newly booked current-source row with an admitted creation date, a schedule and all six ownership/recovery metadata cells blank. Other new enquiries also lacked row IDs. No customer values, row positions or identifiers are included in this record. This is a real missing-registration condition, not grounds to weaken the publication guard.

## Provider and native admission observations

- The source connector's bounded value and cell reads timed out, including a smaller read.
- A read-only native probe was canceled after 224.754 seconds without a terminal receipt.
- A read-only Advanced Sheets request returned provider `service unavailable` after 187.509 seconds.
- An actual ordinary Dashboard repeat exhausted its existing two bounded reads. Runtime evidence recorded the first timeout at 60,590 ms. The persisted source remained error with its prior last-success timestamp.
- The visible trigger table reported substantial error rates for the installed edit and arrival timer handlers. One failed edit execution spent 661,393 ms in `event_sheet_name_preflight`, followed by 30,036 ms of failed lock admission. This localizes observed delay; it does not establish a platform-wide outage or prove why the provider stalled.

## Prepared operator recovery

The supplemental recovery handler calls the existing canonical source-identity/appointment writer under the existing DocumentLock. It admits at most one Account and fifty identities, retains accepted allocation recovery and source/queue CAS, and defers presentation. It uses the existing expiring foreground lease; no trigger, provider scope, HTTP endpoint or experimental transport flag is added.

Busy, missing-container, disabled, review, malformed and failed acknowledgements remain incomplete. A completed receipt refers only to the bounded native registration operation, never website publication or complete reconciliation of all sources.

The actual first recovery invocation returned before canonical work. A subsequent instrumented invocation acquired the normal lock, validated the saved container binding and stalled at `nativeContainerOpenMs`, before identity discovery returned. It was canceled at 12:31:02 HKT to stop retaining the operational lock. No successful source-registration, appointment or queue receipt was obtained. The foreground lease expires automatically; no staff handler or background trigger was removed or permanently disabled.

The supplemental source was saved and normalized readback was verified through the editor. That installation is not operational acceptance. Local complete native regression and the recovery admission tests passed. Customer-source recovery and application publication remain unverified.

## Initial acceptance list: OPS-SOURCE-REGISTRATION-20261117

Initial state: **Blocked / not fixed**. The dated latest-verification section above supersedes the source-ownership and current-publication state; sustained native/provider behavior remains open.

1. Obtain a successful provider/container read while preserving the established writer and lock protocol. Do not run competing retry loops while the provider is stalled.
2. Recover newly booked missing ownership through the canonical writer. Verify exact source, registry and queue binding, staff fields and retained outcomes; inspect accepted prefixes before retrying an unknown mutation.
3. Run the ordinary authenticated Dashboard update. Require a successful source result, advanced last-success timestamp, completed same-run audit and a newly persisted dashboard snapshot. A new banner, a successful native control, source code installation or green CI alone does not satisfy this gate.
4. Repeat through the normal control and confirm stable identity, no duplicate appointment and unchanged protected fields.
5. Qualify sustained edit/timer registration and provider latency. The real invocation stalled before business reconciliation; local tests cannot establish production performance.

No identity guard, accepted outcome, source formula, staff data, signing configuration, experimental activation or authentication policy was bypassed to obtain an apparent success.
