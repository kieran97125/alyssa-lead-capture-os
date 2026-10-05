# Loading-only App release — approval required

Branch: `codex/release-loading-20261005`. Production source change: today's reviewed `455b3ea` on freshly fetched `origin/main` `5ab155482d8b32c03f483738a0b3afc71d02be63`. Added review evidence and synthetic UI baselines do not change that production code. The original loading and arrival worktrees remain intact. No push, PR, merge, deployment or report sync has been performed.

## Problem and resulting behavior

The authenticated Dashboard previously waited for unrelated reporting and notification reads before returning its usable shell. Slow Sheet/OAuth/database providers could therefore make a successful login look stuck. The change renders authorized navigation first and streams independent Lead, advertising and operations regions. Optional badge loading preserves the mounted sidebar and an open mobile menu. A failed region shows a retryable unavailable state rather than verified zero results.

Read and authentication operations have cancellation/deadline handling, including response bodies, retry boundaries and late cookie updates. Existing authentication remains mandatory; provider failure is not treated as an uninvited account or permission to enter a fallback. A separately verified existing emergency session remains supported. Generic Supabase transport limits only GET/HEAD, leaving ordinary mutation transport unchanged. Auth verification uses its own explicit operation budget.

Dashboard Sheet reads are read-only through OAuth health handling and data normalization. Headers and data are fetched together. Explicit synchronization retains its existing behavior. These request budgets are per operation, not a promise that an entire authenticated page always completes within 12 seconds.

## Exact scope

This branch retains the current metric authority, formulas, Account/brand classification and date rules. **Lead = Created At; Book = 最後更新日期; Show = 確認到店日期.** It does not enable the separate arrival-only producer/consumer candidate, insert a CS column, resynchronize persisted reports, or resume old patches. There are no dependency/lockfile, database migration, environment, CI-hook or Trigger.dev changes. The separate fast-check/Zod package is not included.

It addresses front-end availability when providers are slow. It cannot itself repair the ongoing native Sheet service timeout. App/Sheet Show/No Show parity and the native CS column remain separate open tasks.

## Verification

| Check | Result |
| --- | --- |
| Four focused behavior suites | 26/26 pass on Node 22.23.3 and Node 24.19.0 |
| Production Next build and 14 existing contract checks | Pass on Node 22 and Node 24 |
| Storybook build | Pass on Node 22 |
| Focused ESLint | Pass across 26 changed code/test files |
| New streaming UI cases | 3/3 pass: mobile menu persistence, desktop/mobile screenshot and axe |
| Existing foundation axe and contrast | Pass |
| Existing foundation goldens | 2 failures; both actual images are byte-identical to clean upstream in this runtime. Existing goldens were not changed. |
| Full TypeScript check | Same 5 pre-existing e2e diagnostic lines as clean baseline; no changed-file diagnostic |
| Hosted CI / live authenticated acceptance | Not run for this unpublished branch |

The isolated tests use synthetic providers and credentials with an explicit environment allowlist. Customer data was not used. A separate test-only fixture build was used for browser checks; a final production build with fixture flags absent passed afterward. Do not deploy the fixture artifact or enable its flag in production. Browser runtime: recovered Chromium 149.0.7827.0 with local CJK fonts. The full local design gate is explicitly not all-green because of the baseline-equivalent golden differences. A hosted failure must be investigated, not bypassed or accepted through blanket snapshot updates.

React review confirms auth precedes business reads, independent data starts concurrently behind separate Suspense boundaries, mounted sidebar state survives count updates, errors are handled immediately, and shared SystemButton/Skeleton contracts are reused. The detailed sanitized logs are in `2026-10-05-loading-release-evidence/`.

## Production target and rollback anchor

Read-only Vercel inspection found the project `alyssa-lead-capture-os`, configured for Node 24. The current READY production deployment is **`dpl_EDFSLMZnJS6di2pfeE4RPt6XbD8X`**, commit **`5ab155482d8b32c03f483738a0b3afc71d02be63`**, with both `app.beautytrialhk.com` and `go.beautytrialhk.com` in its aliases. No promotion or rollback was requested.

Before any approved publication, recheck upstream and the active production alias. If either changed, reconcile and record the new rollback anchor before continuing. Approval is requested for this loading-only branch: push/open a PR, pass the existing required checks, then merge/deploy and verify authenticated navigation, provider-unavailable handling and runtime errors. Do not weaken gates, change production settings or fold in the separate arrival candidate.

If auth or navigation regresses after that authorized release, restore the captured pre-release deployment and roll back this App change through the normal repository process. There is no Sheet/database schema migration to reverse. Preserve Book corrections, spend entries, existing customer edits and separately authorized Script performance fixes. Deployment permissions and gates remain subject to the user's explicit approval.

## Open work cards

| Card | State / next action |
| --- | --- |
| APP-LOADING-RELEASE | Local review ready; publication approval and hosted gates pending. |
| APP-LIVE-ACCEPTANCE | After approved release, verify a real authenticated session and scan runtime errors. Current browser observation reached the App login page only. |
| SHEET-PERFORMANCE | Script fixes saved separately; native provider reads still time out. Actual complete staff edit remains unverified. |
| SHEET-CS | No insertion. Protected preview failed busy before any Sheet access. Staff work must continue. |
| ARRIVAL-PARITY | Isolated combined candidate exists; live registry/identity coverage and coordinated release remain open. |
| LEARNING-EXPORT | Abstract draft retained locally; canonical repository update/publication not claimed. |
