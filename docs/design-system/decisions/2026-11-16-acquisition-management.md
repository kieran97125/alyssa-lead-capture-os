# Acquisition management and safe real previews

Source: PR #159. This extends the existing product shell and System controls.

The canonical staff entry is `/campaigns`, with forms and advertising pages in separate tabs. One guided creation flow starts with intended use, then brand/offer, then review. Existing URLs redirect with their filters preserved. Internal names remain distinct from customer information.

The important product boundaries are visible in plain language: a copied Wix snippet is not proof of an installation; a saved draft is not a published page; an accepted registration is not yet a completed external delivery. Real registration and delivery observations use separate availability states so a failed read never appears as a successful zero.

Creation and form settings use React Hook Form with the existing shared Zod schema. The page editor preserves the native section builder behind one pending-aware action bar. Expected failures preserve current inputs; retry identity is stable for an unchanged command; revision conflicts require a reload rather than silently replacing another editor's work. Successful revised server results remount their editor baseline. Dirty same-tab navigation and browser unload are guarded.

Protected previews render the actual public page and form. They suppress attribution capture, browser storage, analytics, parent messages and submission. Preview buttons save first and bind to the resulting version and revision. Public visitors continue to read the approved snapshot.

Images have role-specific thumbnails and collapsed link editing. The existing private creative-job upload API is not reused for unrelated assets. A scoped acquisition asset picker/upload remains the explicit LP-003 roadmap card.

Shared confirmations reuse Base UI through SystemConfirmationDialog; optional controlled state and a hidden-trigger mode preserve existing call sites. No additional UI kit or styling registry is introduced. Existing navigation preferences remain persisted; the retired Lead monitor is removed from navigation and dashboard alerts.

## Qualification

- TypeScript, scoped ESLint, Next production compilation, design contract and Storybook build passed locally.
- PostgreSQL 17.12 transactions and concurrent sessions plus six acquisition behavior suites passed in Actions run `43814473566` at source `73052d02074f5d8e2aea2dd684845909773b5d5b`.
- Deterministic desktop/mobile screenshots, keyboard interactions and axe checks are qualified in `e2e/acquisition-management.spec.ts`. Candidate generation is constrained to its own screenshot directory; existing baselines are never broadly refreshed.
- Final visual review, browser run and deployment evidence are recorded in `docs/roadmap/2026-11-16-acquisition-management.md` when completed.

## Recovery

Keep additive database columns and immutable operation receipts when restoring an earlier application deployment. Preserve customer/staff records and publication pointers. Read/capture operations remain compatible; earlier page editors may require the current mutation contract because historical versions are protected against modification. Revert the application independently; do not delete accepted receipts or reverse data with a schema rollback.
