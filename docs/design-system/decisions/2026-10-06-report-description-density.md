# Report description density

Source: Alyssa PR #106, initial implementation `594eea81c3142afd9bc0b8e6c87b2b8df0db2be2`.

## Operator problem and behavior

Daily Overview placed two full-width diagnostics per brand above the KPIs, consuming an entire viewport. Routine helper text also repeated methodology already available at the bottom of each report. Operators need the metric and action first, with detail available when investigating.

`SystemDataStatus` now presents one deduplicated issue count. A native `details`/`summary` disclosure exposes the complete list on demand. The shared `SystemDetails` component also keeps methodology collapsed on Daily Overview, Dashboard's Lead panel, Treatment Performance and Period Comparison. Source Performance and Operations diagnostics use the same disclosure. Routine report subtitles are shortened.

Only caller-identified per-brand diagnostics may collapse. All other warnings remain visible by default, including fallback/demo figures, permission failures and unavailable sources. Source unavailable states, stale-snapshot alerts, unverified arrival authority and mutation failures remain prominent. Status values, computation, source ownership, monetary entry, revision guards and permissions are unchanged. Spend coverage remains an all-category confirmation measure, not evidence that entered monetary amounts are absent.

## Architecture and dependencies

Native HTML supplies disclosure state and keyboard behavior. It requires no client hydration, no new fetch, and no new package. The existing React, lucide, namespaced design tokens, Storybook and Playwright/axe tooling is sufficient. No alternative button/dialog/table contract is introduced.

## Evidence

- Production build and all build contracts passed.
- Design-system contract, focused ESLint and Storybook build passed.
- Desktop/mobile tests keep 12 diagnostics within a single compact row, keep KPIs in the first viewport, expand/collapse with Enter/Space, and pass WCAG A/AA automation.
- Daily report fixture verifies spend-mode controls and methodology disclosure.
- Existing local foundation goldens have browser/font rendering differences; those two files are not replaced. Hosted gates on PR #106 are authoritative.
- Reviewed the hosted Lead unavailable desktop/mobile and empty/stored-snapshot mobile screenshots. Their typography differs from the recovered local browser; goldens use the hosted actuals for those four intentionally changed views. Availability alerts remain visible and existing assertions and screenshot tolerances are retained.
- Source, permission and demo/fallback warnings have an explicit regression check: they stay visible while 12 repetitive diagnostics remain collapsed.

## Rollback

Revert PR #106 as a unit: shared disclosure, report consumers, fixture/stories, changed goldens and warning copy. No data migration or persisted-data rollback is required. The full diagnostic strings remain in the existing snapshots and are available when expanded.
