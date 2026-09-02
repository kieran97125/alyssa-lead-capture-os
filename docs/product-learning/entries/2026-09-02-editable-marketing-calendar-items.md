# Calendar Entries Must Be Full Operational Records, Not Drag-Only Tokens

## Problem

Marketing Calendar cards exposed date drag-and-drop and deletion but no discoverable way to edit the title, brand, treatment, type, channel, time, status, assignee, notes or performance-timeline ownership. Operators had to delete and recreate an item, losing continuity and risking mismatch with linked Weekly Tasks or Creative Jobs.

## Decision

Add one compact pencil control to every Calendar card. It opens an app-owned dialog inside Growth OS and edits the complete Calendar record. The dialog uses brand-scoped treatments, optimistic concurrency and the existing module/brand permission model.

One database RPC owns the write transaction. It updates:

- the Marketing Calendar item;
- linked Weekly Task metadata and Due schedule;
- linked Creative Job title, brand, treatment and Publish schedule;
- performance operational events through the existing trigger;
- Command Center and Creative Job audit history.

## Safety rules

- A stale browser cannot overwrite a newer colleague edit.
- A Calendar date cannot move before a linked Task Start Day.
- A Creative Job Publish Day cannot move before its Designer Due Day.
- Editing a Published item updates the existing operational event rather than creating a duplicate.
- Drag-and-drop uses the same linked-record transaction as the full dialog.
- The feature does not alter Lead, Book, Show, Spend, CRM or attribution definitions.

## Product classification

**Core** — editable Calendar records, linked-record consistency, concurrency protection and audit history apply to every Growth OS workspace.

## Client-specific boundary

Brand names, treatment names, users, Calendar content and production rows remain Alyssa-only configuration/data and must never be copied into Growth OS Core.

## Verification

- production build and TypeScript;
- Calendar create/edit/delete/drag regression;
- desktop and mobile visual baselines;
- WCAG A/AA automated scan;
- full Playwright regression;
- transactional production database smoke test before release.

## Rollback

Revert the source PR. The additive RPC may remain safely installed because no existing workflow calls it after source rollback; it can be dropped separately if required.
