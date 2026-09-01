# Creative Job deletion confirmation rollback map

Date: 2026-09-01
Source: PR #79

## Rollback unit

Revert the PR #79 merge commit. This is a code-only rollback; do not alter `creative_jobs`, Audit rows or Calendar data manually.

## Files introduced

- `src/components/system/SystemConfirmationDialog.tsx`
- `src/components/system/SystemConfirmationDialog.stories.tsx`
- `src/components/creative/CreativeJobDeleteControl.tsx`
- desktop and mobile snapshots under `e2e/creative-production.spec.ts-snapshots/`
- `docs/design-system/decisions/ADR-002-system-confirmation-dialog.md`

## Existing files modified

- `src/app/creative-jobs/page.tsx`
- `src/components/creative/CreativeJobStudio.tsx`
- `src/components/creative/CreativeProductionFixture.tsx`
- `src/app/creative-jobs/actions.ts`
- Creative and Design System contracts, tests and change log

## Data and runtime risk

Deletion remains a soft delete through `creative_jobs.deleted_at`; the change does not add or alter database schema. Reverting the UI does not restore Jobs already deleted by an authorized user. Their Audit records remain available for investigation.

## Verification after rollback

1. `npm ci`
2. `npm run build`
3. `npm run build:storybook`
4. `npm run test:design`
5. `npm run test:creative`
6. Confirm Production points to the rollback commit and no new runtime errors appear.
