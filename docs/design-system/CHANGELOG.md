# Design System Change Log

## 2026-10-06 — Optional operator settings

- Remove duplicate settings-home navigation and row descriptions; make tracking, classification, history and source creation optional disclosures.
- Keep internal form tokens under More and shorten routine report/planning copy.
- Controls and saved configuration retain their existing contracts. Evidence and rollback: `decisions/2026-10-06-optional-operator-settings.md`.

## 2026-10-06 — Compact report descriptions

- PR #106 replaces repeated per-brand diagnostic cards with a compact, accessible disclosure and moves report methodology behind an explicit summary.
- Daily Overview, Dashboard, Treatment Performance, Source Performance and Period Comparison keep data and actions prominent. Unavailable/stale/arrival-authority alerts and mutation errors retain their existing prominence.
- Native HTML and existing semantic tokens are sufficient; no dependency, data ownership or calculation changes.
- Validation, screenshot review and rollback: `decisions/2026-10-06-report-description-density.md`. Hosted checks must pass before merge.

## 2026-10-05 — Dashboard availability and usable navigation

- Dashboard renders its authenticated shell before independent Lead, Source Performance and Operations reads finish. Existing successful panels, filters, date sources and cost calculations are retained.
- Notification counts update the mounted sidebar instead of holding or replacing it, preserving an open mobile menu and focus while optional badges load. Permission checks still gate badge reads; unverifiable authentication never starts Dashboard business queries.
- Pending panels use the owned Skeleton primitive. Failed Lead or Source reads display an unavailable state with a compact SystemButton retry link preserving the current filters; they do not present zero or synthetic KPIs as a successful production read.
- Storybook covers pending, unavailable and navigation-with-delayed-badges states. The guarded `/e2e/dashboard-streaming` fixture contains synthetic UI only; it reads no business data.
- Evidence: `node scripts/test-dashboard-streaming.mjs` exercises actual React server streaming with stalled reads, independent panel completion, shared read counts, fail-closed auth and notification permissions. New desktop/mobile screenshot, axe and menu-persistence checks are in `e2e/dashboard-streaming.spec.ts`. Full design/build evidence is recorded with the release review; no deployment is implied by this entry.
- Follow-up loading-only review: Node 22 and Node 24 production builds and all 14 contracts pass; Storybook and focused lint pass. In the recovered local Chromium/CJK-font environment, all three new screenshot/axe/menu-persistence cases pass after visual review. Existing foundation axe/contrast checks pass; two existing golden failures produce actual images byte-identical to clean upstream. Existing goldens were preserved, so the full design gate remains explicitly non-green. See `docs/operations/2026-10-05-loading-only-release-review.md` for approval, hosted acceptance and rollback.
- Hosted PR #100 validation: Design Quality Gate passed all five checks. Full acceptance ran 207 checks: 206 passed and only the newly added mobile streaming golden failed (5,838 differing pixels). Three CI attempts produced byte-identical 390×914 actual images (SHA-256 `52378f94a6a08d2f966178c2f5225bbef3557907ae985a81bab3ad424d25fea9`). Visual review found matching layout, content and controls, with differences concentrated in text rendering between the recovered local runtime and hosted Ubuntu/Chromium. Only that new mobile golden is adopted from the hosted artifact after review; existing foundation/desktop goldens, assertions, tolerances and CI settings remain unchanged. Artifact #11335551116 digest: `1f930140fd64bfe1161f8ad0e057a86e57daf8ec085dd56ea51e3a696da47a5b`. The full hosted gate must run again; the first failure is not waived.
- Rollback: revert the Dashboard streaming and navigation changes together. No data migration or stored-data rollback is needed. The test fixture and stories can be removed with that revert.

## 2026-09-29 — Schema-independent metric wording

- Replaced physical date-column letters in the Dashboard explanation with stable field names, so the copy remains correct after the operational column reorder.
- Corrected Treatment Performance's Book explanation to use the update date. Existing controls, layout and shared components are unchanged.
- Evidence: v5/v6 parser and aggregate equivalence, schema contract, design contract, targeted ESLint, diff checks, the full production build and Storybook build passed locally. Source PR and release evidence are pending.
- The local application visual/accessibility gate still requires a working Chromium installation; the earlier truncated download limitation has not been resolved by these copy changes.
- Rollback: revert the copy with its source-contract documentation if necessary. Header-based wording supports either physical schema; no component or token rollback is needed.

## 2026-09-29 — Dashboard metric-date explanation

### Changed

- Updated feature-level explanatory copy in `LeadDashboardPanel` to show the approved source-column dates: Lead B, Book A, Show N and No Show L.
- Explained Account-scoped duplicate handling, earliest qualifying dates, first-touch dimensions and the treatment of missing dates alongside the existing operational-ratio wording.
- Retained the existing component structure, controls, typography and layout. This change introduces no shared primitive or new component state.

### Evidence

- Production build, Storybook build and contract checks passed in the source implementation workspace.
- Native worksheet dashboard presentation was reviewed separately after its formula update.
- Local `test:design` execution remains blocked: the Chromium installation returned truncated vendor downloads and no usable local browser was available. The native worksheet review is not a substitute for the application's Playwright visual/accessibility checks; run those checks in a working browser environment before recording that gate as passed.
- Metric semantics, parity checks and source rollback are documented in `docs/lead-sheet-column-date-contract.md`.

### Rollback

- Revert the feature explanatory copy with the matching application metric contract and native worksheet formula version. Do not restore event-ledger wording while the source-column calculation remains active.
- No design-token, shared-component or database rollback is required for the copy change.

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
