# Account/Brand parity and truthful refresh time

The current Medical Account can contain both source-owned medical Brands. Its fixed permission-Brand map omitted one of those Brands, so an explicit Account/Brand filter returned zero even when the all-Brand Account total included the records. The existing filter and table now retain both medical Brands. Every result still intersects the operator's actual allowed Brand IDs; advertising Spend retains its separate allocation. No source Account, Brand, identity or business value is rewritten.

An unrelated Lead append also advanced `marketing_data_sources.last_success_at`. That field is used as report freshness even though appending a Lead does not publish metrics or an accepted dashboard snapshot. The append health recorder now preserves both refresh timestamps, the active sync lease and prior metric failures. Actual successful refresh remains the owner of its successful timestamp.

Existing System controls and layout are reused. `MixedMedicalBrands` provides a synthetic Storybook state with both permitted Brands. No packages or database schema changes are needed; TypeScript, the existing parser/model contracts, Storybook and Playwright already cover these concerns.

## Verification boundary

Before the patch, a fresh read of the complete source, registry, identity bridge and derived metrics produced matching Account totals. The actual dashboard model reproduced one explicit Account/Brand filter discrepancy. Replay is not a production refresh. Tests cover both medical Brands, independent Account identities for a repeat customer, restricted access and unchanged advertising-cost ownership. The actual append HTTP path is checked for preserving report timestamps.

Record exact hosted acceptance/design results and deployed source on the PR before release. A successful production read/validate/publish run and the same-time Sheet comparison are separate acceptance gates. A newer delivery timestamp or READY deployment alone never proves source parity.

## Recovery

The previous production source is `235ae9f888e7350c5a33e8b0d34e75107bab0716`. Revert this release to restore the prior application behavior. No Apps Script, Sheet migration, customer-row restore or dependency rollback is needed. Do not alter accepted report snapshots or customer records to force totals to agree. Any correction of an already inflated freshness field must use the latest accepted publication and exact current-state guards.
