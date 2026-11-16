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
| Candidate source | Implementation source `3bbde1ac34799224d6b744a2820766a09856974a`; PostgreSQL, production build/contracts, Storybook, design/axe and focused fixture qualification passed. Reviewed PNG baselines and final full-acceptance qualification are recorded separately; this is not a production release claim. |
| Earlier design-qualified source | `dd80670663c27a86ba3f6944f5957a9f8a3aa612`; [Design Quality run 43802510052](https://github.com/kieran97125/alyssa-lead-capture-os/actions/runs/43802510052) completed successfully. This evidence does not automatically qualify later source changes. |
| Source PR | Draft [#158](https://github.com/kieran97125/alyssa-lead-capture-os/pull/158); unmerged. |
| Database migration | Candidate `supabase/migrations/20261116033221_public_capture_receipts_and_delivery_outbox.sql`; not applied to production. |
| Merged source / production deployment | Not merged or deployed as part of this candidate. |
| Canonical product-learning export | Published entry + index only at canonical commit `6a180728678b27e8bfdde64c452d6a177ef3160c`; sanitized, unreleased, no Core/checkpoint changes. Final qualification evidence will be reconciled after the acceptance run. |
| Recovery scheduling | Source-only `supabase/drafts/public_lead_delivery_schedule.sql`; dedicated time-bound HMAC authentication is implemented and its local contract passes. Not executed. Existing daily hosting schedule is preserved. |

## Intended scope

- CRM outcome queues, HKT date predicates, brand selection and connection readiness.
- Opt-in complete scoped lead reads plus complete CRM overlays, with explicit failure when completeness is unconfirmed.
- Public LP copy derived from configured brand, treatment, branch and finite price values.
- Bounded visitor-event validation and rejection of untrusted operational outcome assertions.
- Stable registration submission identity, atomic capture and durable delivery intent.
- Native Sheet delivery reconciliation by stable lead identity, including uncertain and blocked states.

The roadmap tracks unified metric publication, broad UX consolidation and LP studio generation separately. This candidate does not claim those cards complete.

## Qualification ledger

| Gate | State | Evidence |
|---|---|---|
| Eight foundation programs, including 25 capture and 16 HMAC cases | Passed | Production build in [Design Quality 43803391168](https://github.com/kieran97125/alyssa-lead-capture-os/actions/runs/43803391168) at implementation `3bbde1ac34799224d6b744a2820766a09856974a` runs all existing contracts and `verify:system-foundation`. |
| Atomic capture, idempotency, rollback, role grants and real concurrency | Passed, isolated PostgreSQL 17 | [Database qualification 43803391032](https://github.com/kieran97125/alyssa-lead-capture-os/actions/runs/43803391032), same implementation source. Schema-only synthetic database; no production migration or provider call. |
| External delivery/recheck/uncertain outcome contracts | Passed, synthetic application + isolated DB | Capture/summary/recheck tests and PostgreSQL behavior/concurrency passed. Unknown provider writes reconcile only; real provider delivery remains a rollout observation. |
| TypeScript | Passed locally | `npx tsc --noEmit` passed after the final helper/fixture corrections; matching implementation tree. |
| Production build, existing contracts, Storybook | Passed | Both jobs in Design Quality run `43803391168` completed successfully at the implementation source. |
| Standard deterministic design/axe and rendered report layout | Passed, hosted | Design Quality run `43803391168`; local Chromium was blocked by EPERM before UI inspection and is not claimed as a pass. |
| New CRM/delivery desktop/mobile interactions, keyboard and axe | Passed, hosted | [Focused qualification 43803391043](https://github.com/kieran97125/alyssa-lead-capture-os/actions/runs/43803391043) passed candidate generation and a separate non-update rerun at the implementation source. |
| Human PNG review | Approved | Ten new fixture PNGs reviewed and hash-verified; one existing CRM baseline updated after reviewing expected/actual/diff and confirming intended notice removal plus stale pre-existing locale/filter content. No layout assertions removed. See design evidence manifest. |
| Final full application acceptance against committed approved baselines | Pending baseline commit rerun | Earlier run passed 245/251; remaining failures were the now-corrected new selectors, uncommitted new PNGs and manually reviewed existing CRM baseline. This row requires the final ordinary non-update full-suite result. |
| Worker request authentication | Passed source/16 synthetic HTTP cases + independent review | Exact GET/path/time HMAC; max60s age/15s future; no global bearer fallback. Draft SQL schedule remains unexecuted and real authenticated dispatch remains a rollout observation. |
| Vercel preview | READY on implementation source | `dpl_FWhceHP1zBqqosPws9SyesjA7Gnb` at `3bbde1ac34799224d6b744a2820766a09856974a`. Unsupported five-minute Vercel manifest cron removed; existing daily refresh retained. READY is a build/deployment observation, not runtime DB/provider qualification. |
| Production migration, key/Vault configuration, schedule and release | Awaiting specific rollout authorization | None applied. Matching additive migration must precede the application caller; enable schedule only after matching application deployment. |
| Legitimate production registration and delivery | Pending rollout | Separately observe acceptance, actual destination delivery, replay and worker state transitions after approved activation. |

## Recovery and rollout

The concrete production change is the additive capture receipt/outbox migration together with a dedicated HMAC-authenticated `/api/cron/lead-deliveries` worker, its database-owned five-minute recovery schedule and the matching application release. Automatic approval review rejected the earlier proposed new production/preview authentication configuration because the existing fix authorization did not explicitly cover that security and scheduling scope. No environment value changed; no production migration or application deployment occurred. The final proposal now uses a dedicated `LEAD_DELIVERY_SIGNING_SECRET` and encrypted URL/key references, not the earlier long-lived bearer design. The required authorization must cover this concrete rollout as a bundle after final source qualification. This is the current blocker, not a general approval requirement for ordinary code fixes.

The five-minute worker is **not** a Vercel manifest cron. A preview attempt proved that unsupported schedule incompatible with the current hosting plan. `vercel.json` retains only the existing daily source-refresh job. Read-only inspection confirmed existing `pg_cron`, `pg_net` and Vault capabilities, but network-queue privilege metadata ruled out queuing a reusable long-lived bearer. The replacement source-only [schedule recipe](../../supabase/drafts/public_lead_delivery_schedule.sql) computes a short-lived signature from the dedicated Vault key; it requires approved encrypted configuration, the additive migration and the deployed matching worker before execution. It does not install or enable itself. See the [scheduling architecture](../architecture/2026-11-16-lead-delivery-scheduling.md).

1. Validate the exact additive database migration and isolated rollback tests before activating a caller that requires it. Do not silently fall back to the old non-atomic writer when a required capture function is unavailable.
2. After specific authorization, configure the dedicated worker signing key and encrypted URL/key references, deploy the qualified application source, verify the exact production source, then enable the reviewed database-owned HMAC recovery schedule. Preserve the existing daily hosting schedule and its independent authentication.
3. Treat accepted registration, delivery status and report publication as separate evidence. Delivery completion must not advance reporting freshness.
4. On application rollback, retain durable receipts/outbox and accepted customer records. Do not remove additive schema or delete accepted data to make old source run.
5. Hold uncertain provider writes for reconciliation. Do not replay append requests blindly. Preserve operator-owned source fields.
6. Qualify the named schedule's pause procedure (`cron.unschedule`) and compatible downgrade before rollout. Retain delivery records and hold uncertain mutations during a pause; never delete receipts or accepted customer data.

## Evidence limit

The complete-read implementation has explicit 25,000-row and 20-second operation bounds. Exceeding capacity, reaching the deadline or detecting an inconsistent page sequence fails with a recoverable load state rather than presenting partial totals. This is a bounded complete-read safeguard, not an unlimited aggregate-query architecture or a transactional database snapshot. FND-010 tracks scalable database-side queue/aggregate projections.

Delivery recheck does not resolve every exception. An uncertain append with zero stable-identity matches remains uncertain and cannot safely be retried as a new append. A pinned delivery destination is not automatically rebound when configuration changes. FND-011 tracks an explicit reviewed exception-resolution/rebinding operation; the current UI offers recheck, not that operation.

The initial architecture review could not perform authenticated internal-page acceptance because the available live page was at its normal sign-in boundary. Synthetic browser qualification and a READY deployment must not be described as affected-staff-session or populated production-flow acceptance.

See [delivery cards](../roadmap/2026-11-16-system-foundation.md) and the [interaction decision](../design-system/decisions/2026-11-16-system-foundation.md).
