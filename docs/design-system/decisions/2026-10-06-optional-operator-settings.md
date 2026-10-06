# Optional operator settings

## Problem and behavior

The operator requested fewer redundant descriptions and settings after the report cleanup. Settings Overview showed the same destinations in a secondary navigation row and an eight-link management list, while its full tracking form occupied the default page. Source setup, old workbook history and treatment classification details also competed with current operational work.

Settings Overview now keeps the eight management destinations once, with counts where relevant. Meta Pixel configuration shows a concise disclosure with its configuration status. Treatment classification, source creation and historical spend records are available through existing SystemDetails disclosures. The source form's single-option dataset selector becomes a hidden field with the same canonical value. Forms show brand once and keep the public token under More. Report/planning helper copy is shorter.

## Preserved behavior

All actions, defaults, hidden fields, source adapters, saved configuration, consent fields, permissions and revision guards remain unchanged. Pixel duplicate-PageView guidance remains beside its checkbox when expanded. Current source status, authentication blockers and mutation-result alerts remain visible. This change adds no fetch, client state or package; native disclosures and the installed design/Storybook/Playwright/axe tools suffice.

## Verification

Build contracts, focused lint, Storybook, desktop/mobile visual and keyboard/accessibility checks, and existing settings, source-history and report-export acceptance checks are required before merge. Tests expand optional sections before checking the existing controls; no functional assertion or visual tolerance is removed. Hosted goldens are reviewed if the recovered local font environment differs.

- Local production build and all contracts, focused lint and Storybook passed. Settings/source/report acceptance and desktop/mobile configuration accessibility checks passed.
- The two unchanged foundation screenshot goldens differ in the recovered local browser/font environment; they are retained and hosted gates remain authoritative.
- Desktop and mobile settings screenshots were visually reviewed; mobile rows now keep title, count and management action in one compact row.
- The new mobile settings golden uses the visually reviewed hosted-runner capture (390 × 1153), resolving local font differences without changing screenshot tolerances. The initial hosted run passed the other 224 acceptance checks and all other design checks.

## Canonical learning evidence

The reusable optional-configuration disclosure pattern is recorded in `kieran97125/leadhub-source-os`, entry `docs/product-learning/entries/2026-10-06-optional-operator-settings.md` (commit `f6c9c4622cf306bba013ab21ac00b6b337892146`) and canonical index (commit `8ddc53766add8d58f72228c5eb23e8a5e5ef6232`). Classification: Core pattern, Configurable destinations/status labels, and Needs evidence for measured workflow improvement. Brand names, Pixel values, source credentials, customer records and Alyssa-specific mutation contracts remain isolated from Core.

## Rollback

Revert the source PR as one unit. No database migration or persisted-configuration rollback is involved. Restoring the previous layout re-exposes the same configuration forms.
