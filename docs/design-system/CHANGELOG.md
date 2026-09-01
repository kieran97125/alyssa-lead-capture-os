# Design System Change Log

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
