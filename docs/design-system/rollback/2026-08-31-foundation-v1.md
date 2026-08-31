# Foundation v1 Rollback Map

## Rollback unit

Revert the Foundation v1 merge commit. The release record must name the exact merge SHA.

## Files introduced

- components.json
- src/app/design-system.css
- src/components/ui/* initial primitives
- src/components/system/*
- src/app/e2e/design-system/page.tsx
- .storybook/*
- e2e/design-quality.spec.ts and snapshots
- .github/workflows/design-quality.yml
- design/registry-allowlist*.json
- docs/design-system/*
- scripts/verify-design-system-contract.mjs
- scripts/migrations/2026-08-31-design-quality-foundation.mjs

## Existing files modified

- package.json and package-lock.json
- src/app/globals.css
- .gitignore
- AGENTS.md

## Data and runtime risk

No database migration, production row, authentication contract, Lead logic or API payload is changed. Rollback is code-only.

## Verification after rollback

1. npm ci
2. npm run build
3. npx playwright test e2e/connected-marketing-ops.spec.ts
4. confirm Production deployment points to the rollback commit
5. confirm no new runtime errors
