# Design System Change Log

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
