# Additional isolated workflow QA: cancelled Google run

This is a test-tool record. The additional workflow runner has **not passed its real Google verification gate**. Its offline guards passing does not establish a successful Google workflow run or production behavior.

## Evidence and boundary

On 2026-10-22, the operator started the isolated Google workflow candidate at **13:19:57 Hong Kong time** and stopped it through the Apps Script UI at **13:23:14**, after approximately **197 seconds**, to limit exposure of the production document lock while staff were working.

The execution logged an initial six-booking commit and several Account reconciliation events. It produced **no final receipt**. These intermediate logs do not prove that all five phases, formula evaluations, timestamp comparisons, business-field preservation checks, final property comparisons, or cleanup completed. Do not describe this run as a Google QA pass.

The candidate was staged separately from the operational handlers. It nests the three unchanged current native sources and all QA helpers under one explicit test entry point; it does not replace operational `onEdit` or timer handlers. Intended cell writes target only a newly created synthetic fixture. This run provides no reason to restore original business rows or overwrite properties, which staff may have changed concurrently.

The cancellation does not establish that the final `finally` block or property comparisons ran. Runtime helper replacements in this staged candidate are lexical to that one execution. They do not install global operational replacements. No property rollback is implemented or authorized.

## Frozen candidate and offline evidence

- Entry point: `verifyArrivalWorkflowCandidateIsolated20261022`.
- Source: `scripts/apps-script/releases/20261022/workflow-isolated-qa.gs`.
- Source SHA256: `f6c0ba7dbfdbf389b0cb7be0eb8ccaf1fcf5afeb969abcd96e0de9e426bfcbca`.
- Generated bundle SHA256: `c728aac174c040a3dda52c3596fe53699afce5abe17ffe960a42d0df70691eb5` (286,534 bytes).
- Builder: `scripts/build-native-workflow-isolation.cjs`.
- Guard: `scripts/test-native-workflow-isolation-guard.cjs` — 10 offline cases passed, including nested outer-helper traps and original workbook/property write prohibitions. The original identity isolation guard's 10 cases also remained passing.
- Native main SHA256: `ceec6834de49a261ef8c8fbad3a02806414e5ee0eca8084a249298e7ac8383ad`.
- Native workflow SHA256: `4913eee5c5c1d170e49275d2b48377f388fcc056b8e72fbfaeef61c0fdf057ef`.
- Native integrity SHA256: `22a358f96165d443160ffef54c89f9eb0ceb5a239ee413d8b9d35acb95c049d2`.
- Previously verified identity QA SHA256 remains `53d7142f70079157b52301ef74a2b43d622ce7993bcdc453e912c3f1b374ee2a`.

The fake formula evaluator is an offline harness adapter. It does not prove native Google evaluation of arrival J or the fixture report. The additional runner also invokes the real inner CS handlers and governed missing-only planner/commit primitives; it does not exercise the outer onEdit admission, sidebar RPC authentication, or the separately governed production dashboard.

## Known admission and budget limitation

The runner creates its fixture before lock admission, checks staff priority before and after a non-waiting `DocumentLock.tryLock(0)`, and releases the lock between five phases when those phases return normally. It compares original properties internally after each admitted phase and never writes or restores them.

These are coarse phase boundaries. A single phase invokes several real handlers and performs many native reads and assertions while holding the document lock. The elapsed-time guard is checked only before entering each phase, at 250 seconds. It cannot interrupt an in-flight Google service call, bound a phase's lock duration, or guarantee completion below the Apps Script runtime limit. The cancelled run demonstrated that this granularity is unsuitable for continued testing while colleagues are actively using the Sheet.

Do not rerun this monolithic candidate under the same conditions. The temporary staged QA file can be removed from the bound project after its source is durably recorded and no execution or trigger refers to it. Keep the canonical repository QA, builder and guards for traceability. No operational rollback is required solely to remove this separate test entry point.

## Future work, not implemented

A future Google workflow test should use independently invocable, short steps on the same synthetic fixture, with no lock held between invocations. Each invocation should admit at most one real mutation handler or one bounded planner/commit, then read back that operation, compare properties, restore local helper boundaries and release the lock. Fixture state and test progress should live only in the synthetic workbook; do not add original project properties, triggers, new services, or authorization scopes.

Every step must revalidate the explicit fixture identity, synthetic marker, source contract and expected prior state before any write. Failure or a busy/staff-priority admission should return a concrete partial receipt without forcing the lock. Completion should require independent native-cell readback of every step and a final aggregate verification; intermediate logs must remain partial evidence. Read-only profiling should precede another mutation test so the admitted unit is chosen from measured service latency.

Current native rescheduling also retains `reschedule_requested` after Account date/time edits until a colleague selects visible arrival result `待到店`. This is an existing behavior and an open workflow/wording limitation; the additional QA explicitly models that acknowledgement and must not be cited as evidence of automatic completion after date/time changes alone.
