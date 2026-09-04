# Lead Sheet Book event-date ownership with legacy-safe cutover

## Problem

A Lead received on one day but first booked on a later day was previously counted as both Lead and Book on the first-touch date. Daily operational trends therefore hid the actual day on which CS converted the enquiry. A live Google Sheet also needed to move from 22 governed columns (A:V) to 23 (A:W) without rewriting existing Lead history or interrupting native/Meta ingestion.

## Decision

- Lead remains owned by first-touch `Created At`.
- New v3 Leads have a populated `最後更新日期` on their first row. Their one Book event is owned by the first valid last-updated date on a booked/show/no-show row.
- A Lead group is considered legacy when its first-touch row has no last-updated date. Legacy groups always keep Book on first-touch date, even if a later duplicate row appears after cutover.
- Show remains owned by confirmed-show date; No Show and pending-show remain owned by appointment date.
- Outbound native writes use `lead.v3`, but header-based alignment stays compatible with legacy destinations.
- The reader always reads at least A:W. Meta raw-row normalization detects and writes either the 22- or 23-column contract and clears the raw tail only after the detected boundary.
- Period Book counts become event-flow counts and are independent of whether the Lead was created inside the same period. Full-history unique Book totals remain unchanged.

## Guardrails

- Do not backfill the new column for old Leads.
- The Sheet automation must lock the timestamp only on the first transition into a Book state; later edits must not move the event date.
- First-touch row contract, not a hard-coded calendar cutoff, determines legacy versus v3 behaviour.
- One brand + phone-last-8 group still produces at most one Lead and one Book.
- Native writer, legacy webhook and Meta normalization remain available during the cutover window.
- Audit canonicalization remains header-based and does not reinterpret shifted column positions.
- No database schema migration or historical metric rewrite is required.

## Classification

- **Core**: separate event-date ownership for Lead, Book, Show and No Show; immutable legacy fallback; one-event-per-group semantics.
- **Configurable**: source header aliases and external-sheet contract version.
- **Enterprise Extension**: Google Sheets dual-contract bridge, Meta raw-row normalization and OAuth write alignment.
- **Client-specific and isolated**: spreadsheet IDs, Apps Script secret, actual Lead rows, brand names, phone data and operational Sheet access.

## Evidence

Source PR, verified commit, workflow, deployment and production smoke evidence are appended during release.

## Rollback

Revert the source PR. The parser remains legacy-safe; no database migration is involved. Do not delete a live v3 Sheet column without a separate backed-up Sheet migration.
