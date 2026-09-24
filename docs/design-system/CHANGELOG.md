# Design System Change Log

## 2026-09-23 — Omni Account-first performance filters

PR: #94

### Changed

- Promoted Omni Account to the first reporting/filter dimension on Dashboard and Treatment Performance.
- Kept Brand as a second-level filter and disabled it until an Account is selected, preventing ambiguous cross-account brand choices.
- Reused one shared `AccountBrandScopeFields` interaction across both performance surfaces.
- Added direct Account summary links so each Account has a dedicated filtered performance view.

### Evidence

- Storybook: `System/Filters/AccountBrandScopeFields` covers unselected, Alyssa Aesthetics, and Aesthetics Medical states.
- Playwright Account-first acceptance captures the Dashboard filter panel and attaches the deterministic PNG to the CI report.
- Production build and full Playwright checks are required before the Lead data-source cutover.

### Rollback

- See `docs/design-system/rollback/2026-09-23-account-first-performance-filters.md`.

## 2026-09-01 — Creative Job deletion confirmation

Issue: #79

### Added

- `SystemConfirmationDialog`, an app-owned Base UI confirmation pattern for destructive actions.
- Storybook states for closed, icon-trigger and open destructive confirmation.
- Desktop and mobile Playwright screenshot baselines for the Creative Job delete confirmation.
- A feature-level `CreativeJobDeleteControl` shared by Job List and Job detail placements.
- A validated `returnPath` contract so deletion preserves the active list filters.

### Safety

- Delete remains permission-gated and uses soft deletion; Audit evidence is retained.
- Soft deletion atomically retires unread Creative notifications and pending Web Push deliveries.
- Unpublished linked Calendar items are removed; Published history is preserved.
- Browser-native `window.confirm` is not used for this workflow.
- No database schema, Lead, CRM, Calendar, Spend or reporting calculation is changed.

### Evidence and rollback

- Storybook: `System/Overlays/SystemConfirmationDialog`.
- Visual baselines: `creative-job-delete-confirmation-desktop` and `creative-job-delete-confirmation-mobile`.
- Production build, Creative interaction, Design Quality and full regression gates passed on the release branch.
- Decision: `ADR-002-system-confirmation-dialog.md`.
- Rollback: `2026-09-01-creative-job-delete-confirmation.md`.

## 2026-08-31 — Token namespace and contrast hotfix

### Fixed

- Removed collision-prone global shadcn colour variables such as `--muted`, `--primary`, `--secondary`, `--accent`, `--border`, `--input` and `--ring` from the Alyssa application root.
- Moved Design Quality Foundation colours to the `--system-*` namespace and updated source-owned Button, Badge, Separator, Skeleton and specimen utilities accordingly.
- Added an explicit Dashboard compatibility boundary so labels and helper text resolve to readable Alyssa text colours.
- Added a production-screen regression test that checks representative Dashboard helper text against WCAG AA contrast.
- Strengthened the design-system contract to reject generic global colour tokens and generic semantic utility classes inside owned system primitives.

### Unchanged

- Lead, Book, Show, attribution, CRM, Calendar, Task, Spend and reporting business logic.
- Database schema, stored data and API contracts.
- Dashboard structure, values and interaction behavior.

## 2026-08-31 — Foundation v1

Issue: #74

### Added

- shadcn/ui Base UI configuration using base-nova.
- Alyssa semantic design tokens and density contract.
- Initial official primitives: Button, Badge, Separator and Skeleton.
- SystemButton product wrapper.
- Storybook with Next.js Vite, docs and accessibility addon.
- Deterministic design specimen route restricted to development and E2E fixtures.
- Desktop and mobile Playwright screenshot baselines.
- axe-core WCAG A/AA automated gate.
- Design contract, registry allowlist, agent rules, ADR and rollback map.

### Unchanged

- Lead, Book, Show and attribution calculations.
- Calendar, Task, CRM, Spend and reporting business logic.
- Existing production page layouts except future deliberate migrations.

### Evidence

The release PR, merge commit, Vercel deployment and test run are appended after release.

## 2026-09-02 — Editable Marketing Calendar items

- Added one compact, always-discoverable pencil control to Calendar cards.
- Added a Base UI dialog for complete Calendar record editing without leaving the month view.
- Preserved compact row density and drag-and-drop as the fast date-only action.
- Added desktop/mobile visual baselines and focused accessibility acceptance.
- Rollback: revert the editable-calendar source PR; the additive database RPC can remain dormant.

## 2026-09-02 — Cost-per-funnel trend controls

- Added compact `CPLead`, `CPBook` and `CPShow` controls to the shared performance trend chart.
- Cost mode reuses the existing chart interaction and typography contract; no parallel control system was introduced.
- Missing daily spend renders as an honest gap, while unallocated treatment/source/campaign views explain the boundary instead of displaying a fabricated zero.
- Added Storybook states plus deterministic Dashboard and Treatment Performance visual baselines.
- Rollback: revert the source PR; no database migration is required.

## 2026-09-03 — Compact Creative Job list and creator provenance

- Reduced Creative Job summary-card, toolbar, filter, row, date-tile, status and destructive-control density for faster operational scanning.
- Added the human Job creator to every list row and the Job detail header using the persisted requester member identity, with email/system fallbacks.
- Kept the existing no-horizontal-scroll responsive layout and full-size form controls inside the detailed Brief workspace.
- Added deterministic list visual acceptance plus explicit maximum row/action dimensions.
- Rollback: revert the source PR; no database migration or stored-data rewrite is required.


## 2026-09-03 — Creative Job operational workspace refinement

- Rebalanced Creative Job density with readable metadata, shared compact controls and explicit creator provenance.
- Converted Job settings to a stable controlled draft with visible server feedback.
- Expanded the Brief into the reclaimed workspace width, added sticky Tiptap text-colour controls, and separated explanatory screenshots from production-material UI.
- Replaced the permanent asset/discussion rail with an on-demand version-history side sheet while preserving all underlying records and actions.
- Rollback: revert PR #83; no database migration or historical data rewrite is required.
