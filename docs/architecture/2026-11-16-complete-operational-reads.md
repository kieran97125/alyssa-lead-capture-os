# Complete operational reads — 2026-11-16

## Problem and behavior

CRM queues and their aggregates previously filtered a latest-row subset: 500 rows for a period and 5,000 for all time. PostgREST could also cap lead/relationship responses before those application limits. Older matches and CRM outcome overlays could therefore disappear without a read error.

CRM now opts into `getLeadRows(..., { completeness: "complete" })`. Its scope is fully fetched before the existing search, test-data, treatment, queue and aggregate rules run. Brand permission intersections remain applied in the database before any lead page is fetched. Intentionally bounded callers retain their existing limit semantics.

The CRM case and booking loaders also offer the same opt-in. Their strict mode throws a recoverable error rather than treating failed or truncated outcomes as an empty overlay. The screen must hide results on that failure; no fallback subset is labelled as complete.

## Read contract

- Keyset pages order by `created_at DESC, id DESC`; the next page is strictly older than the previous cursor. PostgreSQL microseconds and timezone offsets are preserved when validating order.
- A read-start timestamp excludes subsequently inserted records. Exact remaining counts detect missing pages, provider row caps, and membership changes while reading. Repeated IDs or invalid ordering fail the read.
- A complete lead or related-history scan has a 25,000-row maximum and a 20-second deadline. The deadline also races transports that ignore cancellation; the abort signal cancels native requests and stops later pages.
- Relationship IDs are deduplicated and split into 100-ID requests to avoid oversized URLs and PostgREST result caps. One-to-one query counts are verified; booking histories are themselves paginated.
- Latest CRM booking `updated_at` remains authoritative even when its row was created on an earlier history page. Source/lead/appointment identity is unchanged; phone numbers are not globally deduplicated.
- Complete-mode failures contain a safe category, not request URLs, customer fields or raw backend errors.

These budgets apply to each scoped loader, not to the entire server-rendered request. Full queues still hydrate in application memory; this release addresses silent data incompleteness while preserving existing domain behavior.

## Verification

`node scripts/test-complete-lead-reads.mjs` uses isolated synthetic providers, with no network or production writes. It covers 6,101 leads and relationships, an older matching phone/source, full-scope aggregate totals, tied timestamps and PostgreSQL microseconds, 1,201-row booking histories, CRM case/outcome overlays, brand permission intersections, intentional limited reads, provider truncation/query failures, changed membership and a transport that ignores cancellation.

## Follow-up system card: database-scoped queues and aggregates

Status: planned after the foundation release.

Move queue filters, server pagination and separate full-scope aggregates to a typed database read model. Preserve lead, appointment and brand authority contracts. Use a single read generation or transactional snapshot where cross-view consistency is required. Acceptance: older matching records remain discoverable without hydrating the entire scope; aggregates are independent of the visible page; membership changes, transport failures and denied brand scopes cannot become partial success.

The current multi-query fence/count strategy is intentionally not described as a database transaction snapshot. Updates to existing values between relationship queries can still reflect different read instants. Publishing/reporting generation work must address that separately.

## Rollback

Revert the CRM complete-mode call sites and the new helper/store changes together. No schema migration, stored-row mutation, or identity rewrite is part of this change. Retain the regression test as evidence of the known bounded-read defect if rolling back.
