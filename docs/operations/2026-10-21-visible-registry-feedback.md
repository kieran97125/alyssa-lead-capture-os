# Visible accepted-status feedback and Account input consolidation

Operator-entered arrival results could remain visible after the guarded outcome transaction rejected them. The old check formula copied a hidden Queue State, so editing hidden metadata could appear to fix the result while reporting continued to use the registry.

The deployed native writer now generates feedback directly from the accepted appointment registry. Exact Appointment ID, Lead ID, queue-entry ID, Account and customer key must agree. Rejected, missing-date, future-date and canceled outcomes are visibly distinguished from accepted outcomes. Hidden Queue State no longer controls this feedback.

## Scope and preservation

- Replaced 150 exact old hidden-state projection formulas. Preserved all other historical formulas and literal notes.
- Unified six Account status validations to the four values actually in use: `待跟進`, `已預約`, `已到店`, `no show`. The unused header-like option was removed; existing status values were not rewritten.
- Copied 17 follow-up remarks into the main CS Remark input, preserving both original strings and the original R column.
- Hid R/S/T from daily operation. No column/header was deleted, renamed or moved. The 275 legacy nonempty S/T cells remain intact for compatibility.
- Preserved Day 1/Day 2, all identifiers, booking-date semantics, completed history, colleague names, brands, amounts and reporting formulas.
- Did not change the web application implementation or roll back the previously released blank-brand ingestion fix.

## Evidence

- Live native source was read before mutation. Verified source fingerprints: main before `77803749`, main after `b09771c5`, unchanged workflow `140944ce`, unchanged integrity module `2846931f` (FNV-1a over UTF-16 source).
- 76 schedule/outcome regression cases and 173 missing-only regression cases pass against the checked-in native release sources. A historical reproduction case also passed in the original 250-case local run.
- Fifteen actual native Sheet formula cases passed, including deliberately misleading hidden state, cancellation, absent/future appointment dates, duplicate identity, source mismatch, accepted Show/No Show and schedule mismatch.
- The normal CS menu command was executed with the currently authenticated owner: UI reported 12.0 seconds, 145 complete records skipped and one review case. No additions or schedule repairs were necessary in that run. This is one observed latency, not an SLA.
- Exact readback against the pre-change workbook copy found zero differences in arrival business/identity/money cells or registry values. All 17 note merges and legacy values were read back individually; Day 1 values remained intact.
- Normal-sheet rendering was inspected. The feedback column was widened to 360 px and wrapped so rejection reasons can be read.

## Open acceptance and decisions

Five pre-existing proposed inputs remain unaccepted and are tracked in issue #138. Two conflict with canceled appointments, one with retained No Show history, one with a different source time, and one lacks an appointment date. Do not infer their correction from row position, phone, or a filled Show cell.

The owner's no-op test is not a colleague first-authorization test. The separate `about:blank` issue remains unresolved. A real CS-account write-flow acceptance covering a new valid result and date/time catch-up remains outstanding; synthetic regressions are not substituted for that claim.

Day 2 history and old QA/backup tabs were not deleted or moved because complete historical/recovery dependency clearance was not established.

## Source and rollback

The release directory records the actual native main, workflow and integrity modules needed by these regressions. The small API adapter under fixtures is a synthetic regression fixture, not a second deployment module. Do not replace the bound project with the older v1-only root `lead-bound-automation.gs` source.

The pre-change native main/workflow and private workbook copy are retained in the user's rollback artifact. Restore only the relevant formulas, validation, visibility or exact source version after checking intervening edits; do not overwrite a live workbook wholesale. The web application baseline is release `78325d1e584475584d59449ee79d2c7f88ea5d5a`.

No customer rows, phone numbers, secrets or private workbook links are included in this public record.
