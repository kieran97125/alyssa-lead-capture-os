# Account-first performance filters rollback map

Date: 2026-09-23
Source: PR #94

## Rollback unit

Revert the PR #94 merge commit and switch the active Lead Funnel data source back to the previous Lead Sheet source before accepting new website Leads.

## UI and interaction scope

- Dashboard and Treatment Performance place Omni Account before Brand.
- Brand remains a secondary dimension and stays disabled until an Account is selected.
- `AccountBrandScopeFields` is the shared interaction used by both surfaces.
- Storybook covers no-Account, Alyssa Aesthetics, and Aesthetics Medical states.
- Playwright captures the Dashboard filter panel as deterministic CI evidence.

## Data/runtime scope

- The Account-first Lead Sheet remains the operational source only while the Account-first application build is deployed.
- Website form writes are routed to Account tabs by the server-side native Google Sheets writer.
- `marketing_treatment_performance_daily.account_label` is additive and may remain after rollback.
- Historical old Lead Sheet and old data source must remain available until the cutover is accepted.

## Verification after rollback

1. Restore the previous non-paused Lead Funnel data source.
2. Confirm website forms append to the restored destination.
3. Confirm Dashboard and Treatment Performance use the previous brand-first filters.
4. Run `npm run build`, `npm run build:storybook`, `npm run test:design`, and the Lead Sheet acceptance tests.
