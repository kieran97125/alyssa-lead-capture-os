# Native arrival owned-input guards — candidate 2026-10-28

Status: locally verified candidate; NOT installed in the bound project. No application runtime release is included.

## Reproduced defect

The archived manual-sync allocator could classify a physically empty managed record as an available slot even when the same row still contained a colleague name or a nonzero authoritative total. The original manual-column list covered source, trial and order fields only. Allocation could select that row and its writer preflight also missed the omitted inputs. A newly assigned appointment could inherit the old input without requiring a partial-range sort.

This is a reproducible safety defect. It is not proof that every reported historical discrepancy was caused by it. Historical financial reconciliation and exact installed-source verification remain open.

## Candidate behavior

- One header-driven occupancy predicate covers colleague, source, trial, order and authoritative total fields in discovery, allocation admission and the final writer preflight.
- Explicit zero trial/order entries remain occupied. An otherwise unused zero-total template remains reusable, consistent with the existing financial-entry contract. Invalid and nonzero totals remain occupied for review.
- Manual-input snapshots include the authoritative total.
- The existing whole-width native sort is retained. Its before/after appointment-keyed comparison now includes the authoritative total and rejects unowned meaningful input.
- Existing source, appointment, queue and lock checks remain in place. Financial arithmetic, classification, report generation, application synchronization, triggers and permissions are unchanged.

The dated source copies are based on the archived 20261022 release and preserve its helper dependencies. They are review material, not an instruction to overwrite a newer live project wholesale.

## Verification

- Original archived source: synthetic colleague-only and total-only rows both reproduced as blank and selected for new allocation; writer preflight missed both.
- New ownership contract: 12 occupancy/template scenarios plus keyed total/sort and backup assertions passed. The contract fails against 20261022.
- Existing appointment schedule contract: 76 passed against the candidate main source.
- Existing manual missing-only contract: 173 passed against the candidate main/workflow/integrity sources.
- The manual contract now loads integrity helpers from the selected release instead of silently using 20261021 when another main/workflow version is specified.
- These are Node/VM checks. Native Google sorting and the actual signed-in menu execution have not been qualified for this candidate.

Commands:

```sh
node scripts/test-native-arrival-manual-input-ownership.cjs
node scripts/test-native-arrival-schedule.cjs scripts/apps-script/releases/20261028/native-main.gs
node scripts/test-native-manual-missing.cjs scripts/apps-script/releases/20261028/native-main.gs scripts/apps-script/releases/20261028/arrival-workflow.gs
```

## Native installation boundary

Retrieve the currently installed main, workflow, integrity and any newer helper files first. Check the menu handler and duplicate global declarations. Apply only the ownership-guard delta to the actual source; retain all newer durable-refresh helpers. Use an isolated native fixture to qualify actual whole-row sorting, then verify saved source and ordinary no-op/add execution under the existing lock. Do not validate by adding synthetic contacts to the operational workbook.

Operational restoration must use a trusted per-appointment before-image, with fresh identity checks and a recorded reason. Aggregate reports cannot reconstruct missing per-appointment financial ownership. No production rows or private reconciliation data belong in this release.

## Rollback

Revert only the reviewed guard delta in the bound source after comparing the exact installed version. Preserve current operational rows and subsequent colleague entries. Do not restore an entire historical workbook as a code rollback.
