# Preserve source consistency during report classification recovery

- Date: 2026-11-11
- Scope: report source reading; no presentation or shared UI change

## Problem and behavior

A report can stop with `treatment_categories_unavailable` even while the source remains connected. The old classification catch discarded the cause, and a temporary incomplete evaluated classification read required an operator to resubmit the report.

Reports continue to consume the native Sheet's evaluated Account-specific treatment categories. They do not add a second taxonomy, rewrite operational rows, guess classification or alter Account, date, deduplication, monetary or KOL rules. An incomplete, empty or conflicting classification read now triggers at most one complete source re-read. Category, revenue and optional KOL tables from the failed attempt are discarded together. Only the successful batch and its read timestamp enter the immutable report snapshot. Both attempts preserve the caller's export cancellation and deadline; a provider failure does not receive another source deadline.

Persistent classification errors and invalid headers still stop generation. Fixed diagnostic reasons and numeric row/count information identify the failed boundary without recording cell values, customer details or provider payloads. No application appearance changes and no dependencies, database migrations or production data writes are introduced.

## Evidence and limits

The reported production page showed the classification failure for an all-Account report. A private live evaluated read covering the first 1,000 classification rows returned 446 populated mappings and passed the real classifier. This does not establish the exact cause of the earlier failed read; the prior catch did not record it. A separate production log recorded a provider read timeout. These observations must not be reported as proof that the original failure was a persistent Sheet conflict.

Synthetic tests cover first-attempt success, complete-source recovery from empty/incomplete/conflicting reads, persistent failure with no fallback, schema failure, shared Account/cancellation options, provider failure without resetting its deadline, and diagnostics without source cells. Existing report contracts retain the no-partial-snapshot assertion.

## Rollback

Revert the classified source reader, typed diagnostics, snapshot wiring and regression coverage together. Source Sheet rules, existing snapshots, operational records and presentation templates need no rollback.
