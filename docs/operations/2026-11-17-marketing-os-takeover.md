# Marketing OS continuation — 2026-11-17

## Operational refresh acceptance

The released identity/control-plane baseline is `9a9b9d4c87f9e8bfe9d0a14f95b8c49d14b9923a` (PR #165). The same Vercel and Supabase projects are named `marketing-os`; production is READY. This observation is independent from the data-plane work below.

An ordinary authenticated Dashboard refresh was executed once on that unchanged release. The UI returned 1/1 source success, 747 daily metric rows and 3,810 treatment combinations, without the earlier Spend warning. Independent persisted evidence shows a completed same-run audit at 18:22:23 HKT, source last-success at 18:22:42 HKT and installed Spend projection time at 18:22:54 HKT. The prior projection time was 12:42:20 HKT. These are successful refresh/export observations; no permanent provider latency fix, native registration change or new code attribution is claimed. Sustained native/provider latency remains open in #162.

## Brand membership boundary

The customer control plane alone does not isolate the full business data plane. The first concrete boundary binds each member–Brand grant to both parents through `(workspace_id, id)` composite foreign keys. Existing grants are backfilled only where both parents already agree; an inconsistent row aborts migration rather than relabeling ownership. Both composite references have covering indexes. Existing parent identities, staff roles, grant status and dates remain unchanged.

Legacy invitation and permission RPCs may omit workspace identity. An invoker trigger derives it from the actual member; it never falls back to the global legacy customer. Wrong explicit scopes and cross-customer Brand bindings fail. Immediate foreign keys prevent referenced parents from moving to another customer, including concurrent changes. Application permission reads also filter the verified workspace and reject a mismatched/missing ownership result.

Qualification includes customer/platform authority and outage tests, existing application/build gates, and PostgreSQL 17 tests for preserved grants, legacy insert compatibility, both cross-customer directions, forged scope, grant changes, referenced-parent changes, ordinary status edits and service-role insertion. Release requires these hosted checks to pass. This document records scope, not an unobserved release.

Deployment order: apply the additive migration before the application that selects the new grant column. Verify the same customer counts/roles/grants and all constraints before merging. Application rollback is the prior baseline; retain the additive ownership constraints. Do not drop/reassign real grants, remove customer rows or open new-customer admission as a rollback shortcut.

## Remaining system cards

- MKT-TENANCY: the remainder of 85 business tables, RPCs, public routes, background jobs, caches and credentials still need explicit customer ownership and two-customer acceptance. This membership slice does not qualify them. New-customer login remains closed.
- MKT-ONBOARDING: custom SMTP and actual customer/operator mailbox completion, recovery, suspension and onboarding remain unqualified. Managed Auth-template automation still needs renewal of its existing failed credential; manually published templates are a separate verified result.
- MKT-DOMAIN: a chosen neutral domain and DNS/TLS/login/OAuth callbacks remain separate from project metadata names. Keep existing campaign links intact.
- MKT-OMNICHAT: the actual account plan, event/signing/delivery/attribution contract and real booking acceptance remain open. No vendor message or purchase is authorized by this continuation.
- Repository identity: the connected GitHub integration has no rename operation, CLI has no authenticated session and the website is signed out. Repository rename remains blocked on owner sign-in; the source/project names are not to be reported as all renamed.

All source evidence is aggregate or technical. Customer contacts, business-cell values, provider identifiers, credentials and screenshots are excluded from shared source.
