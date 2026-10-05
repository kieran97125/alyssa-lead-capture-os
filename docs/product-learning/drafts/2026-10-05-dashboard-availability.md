# Dashboard availability review — local draft

Classification: **Needs evidence**. This is an abstract local draft; no canonical repository update or external publication is claimed. Publication remains outside the current authorized review scope.

## Reusable observation

A dashboard that awaits all remote providers before returning its shell can make a valid login appear stuck. A page read that also normalizes and writes back provider data can add avoidable write and recalculation load. These are architectural risks; they do not prove which provider caused a specific live incident.

## Local change and evidence

- Authorize first, then stream independent data regions. An unavailable provider must not become successful zero KPIs.
- Keep optional notification reads out of the navigation critical path and preserve mounted interaction state.
- Use abortable request and operation budgets, including response bodies, retry boundaries and late cookie mutation guards. Preserve separately verified emergency access and fail closed when authorization cannot be verified.
- Keep the display path read-only while explicit synchronization retains its write behavior.
- All 26 focused behavior tests and production builds pass on Node 22 and Node 24. Storybook and focused lint pass. Three new desktop/mobile visual, accessibility and navigation-interaction cases pass. Two existing foundation goldens remain non-green but match the clean baseline's actual images. Live speed improvement has not been measured.

## Client-specific isolation

Date ownership, deduplication, Account-to-brand mappings, spreadsheet formulas, appointment workflows and provider connection configuration remain client-specific. No customer rows, domains, identities, credentials or formulas belong in a Core learning export.

## Source and release evidence

Local branch: `codex/fix-post-login-loading-20261005`, based on `5ab155482d8b32c03f483738a0b3afc71d02be63`. No PR, production merge or deployment has been authorized. Attach the eventual reviewed commit and release evidence before canonical export. Do not copy this implementation directly into Core.
