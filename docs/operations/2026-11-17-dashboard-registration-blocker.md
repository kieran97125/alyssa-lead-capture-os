# Dashboard registration recovery — not accepted

## Current boundary

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

## Open system card: OPS-SOURCE-REGISTRATION-20261117

State: **Blocked / not fixed**.

1. Obtain a successful provider/container read while preserving the established writer and lock protocol. Do not run competing retry loops while the provider is stalled.
2. Recover newly booked missing ownership through the canonical writer. Verify exact source, registry and queue binding, staff fields and retained outcomes; inspect accepted prefixes before retrying an unknown mutation.
3. Run the ordinary authenticated Dashboard update. Require a successful source result, advanced last-success timestamp, completed same-run audit and a newly persisted dashboard snapshot. A new banner, a successful native control, source code installation or green CI alone does not satisfy this gate.
4. Repeat through the normal control and confirm stable identity, no duplicate appointment and unchanged protected fields.
5. Qualify sustained edit/timer registration and provider latency. The real invocation stalled before business reconciliation; local tests cannot establish production performance.

No identity guard, accepted outcome, source formula, staff data, signing configuration, experimental activation or authentication policy was bypassed to obtain an apparent success.
