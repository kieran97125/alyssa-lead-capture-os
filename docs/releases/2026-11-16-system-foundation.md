# System foundation release qualification

Date: 2026-11-16 (HKT).

**Current status: first-batch implementation is present; final qualification is pending; unreleased. Production rollout requires the specific authorization recorded below.**

## Problem and resulting contract

The existing CRM can expose a No Show queue whose earlier filter excludes every No Show case. Date and channel-health display also vary by module. CRM summaries can silently reflect a newest-row subset. Generic public pages include copied offer/brand text, and the public event endpoint accepts a shared event vocabulary that includes operational outcomes.

The candidate separates complete operational reads, brand-aware presentation, visitor telemetry and authoritative capture. Registration acceptance is intended to persist one coherent result and delivery intent; external Sheet delivery has its own durable, truthful lifecycle. An unknown provider result must not trigger a blind duplicate append.

## Source record

| Item | Evidence |
|---|---|
| Audit/rollback application baseline | `ed5f0d6aad482158d40d62d934b65bafc74c3214` |
| Working branch | `fix/system-foundation-20261116` |
| Tested candidate commit | Pending final commit; do not infer from the branch name. |
| Source PR | Pending. |
| Database migration | Candidate `supabase/migrations/20261116033221_public_capture_receipts_and_delivery_outbox.sql`; not applied to production. |
| Merged source / production deployment | Not merged or deployed as part of this candidate. |
| Canonical product-learning export | Draft preparation only; publish after exact source evidence is supplied. |

## Intended scope

- CRM outcome queues, HKT date predicates, brand selection and connection readiness.
- Opt-in complete scoped lead reads plus complete CRM overlays, with explicit failure when completeness is unconfirmed.
- Public LP copy derived from configured brand, treatment, branch and finite price values.
- Bounded visitor-event validation and rejection of untrusted operational outcome assertions.
- Stable registration submission identity, atomic capture and durable delivery intent.
- Native Sheet delivery reconciliation by stable lead identity, including uncertain and blocked states.

The roadmap tracks unified metric publication, broad UX consolidation and LP studio generation separately. This candidate does not claim those cards complete.

## Qualification ledger

| Gate | State | Required evidence |
|---|---|---|
| Baseline public/auth/brand/design Node contracts | Passed before final implementation | QA baseline observation only; rerun changed contracts for the final candidate. |
| Baseline Storybook build | Passed before final implementation | QA baseline observation only; later changed story/dependency inputs require an appropriate rebuild. |
| Five foundation regression programs | Passed in the current working tree | `verify:system-foundation`: CRM operations, complete lead reads, public landing copy, public event boundary and delivery summary. Record the final source SHA and repeat when changed inputs require it. |
| Capture/public-lead contract checks | Passed in the current working tree | Contract success does not establish live persistence or provider-delivery success. Exact final source evidence remains to record. |
| Capture transaction/idempotency database qualification | Pending | PostgreSQL 17 isolated CI: concurrent replay/conflict, rollback on dependent failure and preserved source/consent. |
| External delivery state/recovery qualification | Pending final candidate | Definite failure, ambiguous committed append, reconciliation, stale claim and unavailable destination; distinguish application tests from database/provider evidence. |
| TypeScript | Passed in the current working tree | Final source SHA remains to record. |
| Production build | Pending | Exact final candidate. |
| Storybook and design contract | Pending final candidate | Required shared/touched UX gates. |
| Deterministic design/axe and critical-journey browser checks | Pending | Synthetic environment with customer/provider writes disabled. |
| Migration and least-privilege review | Pending | Exact SQL, compatibility, RLS and service-role-only execution. |
| Database rollback qualification | Pending | Isolated PostgreSQL 17 fixture and concurrency workflow; no production customer rows in receipts. |
| Hosted CI and preview | Pending | Exact source SHA and terminal results. |
| Production release | Awaiting specific rollout authorization and final gates | Merged SHA, intended target, READY deployment, migration and authenticated worker configuration readback. |
| Legitimate registration/delivery observation | Pending | Separately observed acceptance, destination delivery and replay behavior; not implied by fixture tests. |

## Recovery and rollout

The concrete production change is the additive capture receipt/outbox migration together with an authenticated scheduled `/api/cron/lead-deliveries` worker and matching application release. Automatic approval review rejected creating the new production/preview `CRON_SECRET` configuration because the existing fix authorization did not explicitly cover that security and scheduling scope. No environment value changed; no production migration or application deployment occurred. The required final authorization must cover this concrete rollout as a bundle, after the candidate is reviewable and its qualification evidence is recorded. This is the current blocker, not a general approval requirement for ordinary code fixes.

1. Validate the exact additive database migration and isolated rollback tests before activating a caller that requires it. Do not silently fall back to the old non-atomic writer when a required capture function is unavailable.
2. Deploy the qualified application source with the intended schedule and access controls. Verify the exact merged source and production target.
3. Treat accepted registration, delivery status and report publication as separate evidence. Delivery completion must not advance reporting freshness.
4. On application rollback, retain durable receipts/outbox and accepted customer records. Do not remove additive schema or delete accepted data to make old source run.
5. Hold uncertain provider writes for reconciliation. Do not replay append requests blindly. Preserve operator-owned source fields.
6. Record a tested downgrade/worker-pause procedure for the final schema/worker interface; this pending item is a release gate rather than a promise.

## Evidence limit

The initial architecture review could not perform authenticated internal-page acceptance because the available live page was at its normal sign-in boundary. Synthetic browser qualification and a READY deployment must not be described as affected-staff-session or populated production-flow acceptance.

See [delivery cards](../roadmap/2026-11-16-system-foundation.md) and the [interaction decision](../design-system/decisions/2026-11-16-system-foundation.md).
