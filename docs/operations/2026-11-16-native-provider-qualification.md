# Native provider qualification

Date: 2026-11-16. Execution UI clock labels are kept as UI observations, not asserted as Hong Kong timestamps.

## Source and scope

The typed queue and finalizer adapters originated in draft PR #161 (`a22dbb9b157bb190526592f148b2826511e7b75d`). This integration retains PR #160’s bounded sidebar backoff, stable job identity and accepted-allocation recovery. Both repository adapter flags remain false by default. A production activation is an explicit separately recorded runtime variant after operator review, never an automatic consequence of a synthetic test.

Native SpreadsheetApp reads and writes retain the common document lock, fresh ownership checks, source CAS and canonical source-anchor/registry/history protocol. Direct connector writes are not used to append or repair operational rows.

## Findings from actual Google execution

- An unchanged API response can reorder nested JSON object keys. Raw JSON string order produced a false fresh-CAS conflict. Finalizer comparison now canonicalizes object keys recursively, retaining array order, scalar types, formulas, notes, validation and every nested field value.
- Native writes can coerce an eight-digit registry phone to a number. The API receipt admits that one representation only when the exact already-matched Account/customer key corroborates all eight digits. It never searches by phone or relaxes another field.
- Native SpreadsheetApp writes remain in an execution-local cache. The API saw the prior registry revision before a flush and correctly rejected the intent fence. Canonical commit now explicitly flushes accepted source/journal/registry intent before the append/schedule API fence, with a named timing stage. An unconfirmed intent cannot write queue payload. There is no alternate-writer fallback.
- The normal native writer hit the six-minute execution limit during queue payload. The API path removes that specific native queue-header/payload barrier. Native source reads, native refresh/outcome operations and remaining post-commit readback are still separate performance boundaries.

## Isolated provider acceptance

The fixture helpers created only new synthetic spreadsheets. Their exact identities and terminal receipts are retained outside shared source. Operational workbook references, customer rows and contacts are excluded here.

Queue qualification passed all 27 assertions in 11,438 ms. The measured native intent flush was 163 ms. The API fence, allocating marker, typed payload and managed readback all completed. Repeat acknowledged the same managed row; fresh outcome/arrival evidence was rejected. Notes, CS/display prefixes, zero amounts, financial formulas, midnight, blank registration time and precise registration instant were checked.

Finalizer qualification passed all 59 assertions in 25,844 ms, with 3,529 ms for its first canonical finalizer and 3,222 ms for the formula-sort observation. The fixture covered all six explicit CS scopes, legacy alias/day handling, complete-record sort, notes, validation, formats, financial zero, midnight, occupied colleague cells and unknown-response retry. A relative total formula moved to its new row and retained the correct monetary result. The initial changed-expression readback intentionally remained uncertain; a safe retry does not repeat business mutations. These are fixture measurements, not production throughput.

The finalizer helper still reports `activationQualified:false`. Operator review accepts only the observed assertions and formula semantics for a controlled production canary. Actual operational reconciliation, retained-field readback, idempotent repeat and production latency remain required before closing the user task.

## Local acceptance

The complete native contract passes with schedule 76, missing-only 182, identity 102, source lifecycle 49, controller/sidebar 56, localized time 19, allocator 7, governed rebind 29, typed queue 91 and finalizer 37. New tests exercise numeric registry compatibility under exact identity proof, field/type changes, accepted native intent before API dispatch, retained unknown outcomes, nested key permutations and unchanged array/scalar semantics.

The prior source `0062d0ae2a132199226392d854d9dd24c501f5d1` passed CRM, acquisition management and both visual workflows. Its design workflow’s server startup reached its 120-second limit before executing design tests; that is not a visual failure or a pass. A changed integration head requires its own hosted qualification.

## Maintenance and remaining cards

Background arrival scans can be paused for twenty minutes through an explicit recovery control. The pause expires automatically and does not disable staff edit handlers, the manual command or a trigger. Resume removes only that temporary property. Both before-lock and after-lock timer admission honor it; catch-up reports pending maintenance rather than invented Account coverage.

| Card | State | Acceptance |
|---|---|---|
| SYNC-007: typed provider transport | Isolated Google queue/finalizer accepted; production canary pending | Exact installed source/flag readback, canonical recovery, ordinary button completion, independent retained-field readback and idempotent repeat. |
| PROVIDER-NATIVE-CACHE | Explicit intent flush/fence implemented | Measure the full production command and retained native reads/refreshes; no full-speed claim from fixture timing. |
| SCRIPT-RUNTIME-VARIANT | Repository flags default false | Record exact runtime hashes, explicit activation and rollback after real source save/reload/readback. |

Rollback changes code/flags from verified sources. It must preserve accepted stable identities, source anchors, registry/journal, staff fields and unknown attempt checkpoints. Never delete/reappend customer records to reset an uncertain result.

## Current runtime boundary

Automatic approval review rejected saving both experimental global flags before a separate controlled production acceptance. The rejected activation was not bypassed. Both installed adapters were saved, reloaded and read back with flags false. The temporary background pause was explicitly removed. Six failed/skipped synthetic files were removed after exact fixture-title/identity checks; the two passing fixtures remain available for review.

Ordinary native continuation remains authorized and is being qualified. A fresh independent read showed the former Main allocation had converged, so it was rejected as a stale canary target; two other exactly owned allocating rows remained pending at that observation. A later native continuation completed its queue payload phase in 103,884 ms before continuing post-commit work. This is partial accepted progress, not a full manual completion receipt.

The complete job now also defers per-identity display maintenance to its already guarded final projection. Source/registry/queue readback is retained. Ordinary CS identity edits keep their immediate display path. The two new real-native fixture tests prove this distinction and retained recovery readback. The change reduces repeated maintenance; no production latency claim is inferred from it.

Reloaded source hashes for this native-only follow-up: main `9ea53e46310926ccb36e1d17cf37d78ce33469dcb926977072b7c96685c97a9e`; workflow with the retained read probe `85b66472d63a91d72d2f2974813c339e184aa93358bc1594947e02b6260442f0`. Both adapter sources remain the qualified disabled versions. Full ordinary-button acceptance and source/master parity are still open.
