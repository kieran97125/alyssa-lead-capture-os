# Product Learning Entry

- Date: 2026-11-16
- Source project: Enterprise Pilot
- Source repository: `kieran97125/alyssa-lead-capture-os`
- Source PR / commit / release: Draft source PR #158; observed head `77c05e301694e4aa394d239d44b9eeb3ec1a164b`, final qualification pin pending. Earlier exact source `dd80670663c27a86ba3f6944f5957a9f8a3aa612` passed Design Quality run `43802510052`; later changes require their own final gates. Audit baseline `ed5f0d6aad482158d40d62d934b65bafc74c3214`; no production release. Do not publish this draft to the canonical index until final source evidence is supplied.
- Module: Operational read completeness / Scoped readiness / Public capture / Durable delivery
- Status: `Observed` (working-tree implementation and focused regressions present; final database/rendered/hosted qualification and production rollout pending)
- Classification: `Core` + `Configurable` + `Needs evidence`

## Real operational problem

An operational queue exposed an outcome that an earlier filter had already excluded. Different modules used different business-day and connection-readiness rules. Newest-row limits applied before filtering and aggregation could silently turn complete-looking totals into a subset. Generic acquisition pages retained copied brand/offer defaults, while an anonymous event boundary shared an event vocabulary with trusted operational writers.

A second reliability boundary appears when a valid registration creates several related records and then attempts external delivery. Partial persistence can leave inconsistent capture state. Retrying an append after an unknown transport result can create duplicate operational rows even if the registration itself is idempotent.

## Tested implementation

The working-tree implementation uses shared operational predicates, explicit scoped complete reads and truthful readiness/failure states. Public presentation resolves configured context, and bounded visitor-event validation separates telemetry from authoritative outcomes. Final exact-source qualification remains pending.

The capture design uses a stable request identity and canonical business-payload fingerprint, one atomic database capture with a durable delivery intent, and a claimed delivery lifecycle. An ambiguous provider mutation is held for stable-identity reconciliation rather than blindly replayed. A later intentional enquiry remains independent from retry deduplication; contact identity does not replace appointment identity.

## Evidence and outcome

The source audit establishes code-level defects and architectural risks. Eight working-tree foundation regression programs, including 25 capture cases and 16 worker-authentication cases, plus TypeScript passed. The earlier exact hosted source recorded above passed production build/contracts, component workshop, standard visual/accessibility and rendered-report layout gates. These observations do not qualify later source changes or establish production-flow or sustained reliability outcomes.

The first real isolated PostgreSQL run found a database parser defect. The source was corrected and default privileges hardened; a later fault-injection fixture input was also corrected. PostgreSQL 17 run `43803102335` subsequently passed on exact source `77c05e301694e4aa394d239d44b9eeb3ec1a164b`, including real two-session concurrency, capture/delivery behavior, atomic rollback and role grants. This is synthetic isolated persistence evidence, not a production migration or customer-flow result. Local browser execution failed before UI inspection, so no local rendered visual/accessibility pass is claimed. Final focused hosted browser selector/PNG and full acceptance qualification remain pending. A preview attempt rejected an unsupported subdaily hosting schedule; after its removal the compatible earlier preview `dpl_9cWTMZotgjENMHuzpnYphnbmQVfW` reached READY. Existing daily source refresh remains. Database scheduling/network/encrypted-configuration capabilities were confirmed by read-only inspection; activation remains a source-only recipe.

Further read-only network-queue privilege review showed why a reusable bearer must not be materialized into a queued request even when its source is encrypted. No queued headers or decrypted values were read. The unexecuted recipe now uses exact-method/path, time-bound signatures from a separate signing key, with explicit age/skew checks and no fallback to another job's credentials. The 16 local authentication cases and independent review passed; final release-source agreement remains to pin.

Known boundaries remain explicit: complete application reads have a 25,000-row and 20-second budget and are not a transactional database snapshot. Over-budget or inconsistent reads fail visibly rather than supplying partial totals. An uncertain external append with zero identity matches remains unresolved, and a pinned destination is not silently rebound after a configuration change. A reviewed exception-resolution/rebind command and scalable database projections remain separate source roadmap cards.

Pending: final exact-source qualification, focused hosted browser/PNG and full acceptance evidence, human baseline review, production migration/privilege readback and release targeting. A new authenticated scheduled-worker configuration requires specific rollout authorization before activation; no production schema, environment configuration, scheduler or application deployment has changed. No conversion improvement, performance improvement, production-loss incident or sustained error reduction is claimed.

## Reusable abstraction

1. Make every visible queue/filter combination reachable through a shared domain predicate.
2. Treat business timezone and scope as explicit inputs across server and client views.
3. Model connection configuration, verification and current availability as different states.
4. Make read completeness a contract: paginate the selected scope and required relationships, or fail explicitly before publishing totals.
5. Reserve operational event authority for trusted writers; bound anonymous telemetry separately.
6. Persist an accepted capture and its delivery intent atomically under an idempotent request identity.
7. Separate confirmed failure from an unknown external mutation result. Reconcile unknown outcomes using stable destination identity and retain evidence.
8. Keep capture acceptance, external delivery and metric publication freshness independent.
9. Qualify a recovery schedule against the actual deployment plan and available capabilities. Keep schedule activation explicit and evidence-backed; do not infer execution from an installed extension or source recipe.
10. Review the visibility of intermediate provider queues as well as secret storage. Prefer narrowly scoped short-lived request proofs when a scheduler must queue an authenticated call; verify that application and scheduler construct the same canonical message.

## Client-specific elements that must not cross the boundary

Customer and colleague identities, contact information, raw source snapshots, provider/workbook references, form identifiers, allowed domains, credentials, legal settings, brands, branch taxonomy, offers, prices, localized client copy, schedules and operational retention settings remain isolated. No client data or client implementation is copied into Core.

## Product classification reasoning

1. Other clients can encounter unreachable queue states, truncated totals, copied template context and ambiguous append retries.
2. Business timezone, brand scope, event vocabulary, required related-record coverage, provider reconciliation semantics and retry policy must be configurable.
3. Complete-read and idempotent acceptance invariants are Core candidates. Scope/readiness/provider policy is Configurable. Cross-provider applicability, delivery guarantees, operator clarity and sustained reliability remain Needs evidence until qualified and reviewed. The pilot implementation is not automatically adopted into Growth OS.

## Growth OS recommendation

Review the neutral contracts after exact source qualification. Prefer the existing database and modular integration boundary over a new queue vendor without a demonstrated need. Keep provider-specific append/reconciliation behavior in an integration adapter. Do not copy pilot brand defaults, source schemas or credentials.

Product Learning Sync checked: canonical protocol, index, consumption checkpoint, operation-specific complete-source read budgets and operational write integrity were read. The consumption checkpoint remains unchanged because this is a pilot export draft, not a Growth OS adoption decision.

## Follow-up validation

- [ ] Record exact candidate/PR and final regression/build/design/browser evidence.
- [ ] Prove older matching records and full related overlays remain visible beyond the former cap; interrupted reads cannot return successful partial totals.
- [ ] Prove queue/outcome, business-day boundary and selected-brand readiness cases.
- [ ] Prove anonymous operational assertions are rejected while legitimate bounded telemetry succeeds.
- [ ] Prove concurrent retry, changed-payload conflict and dependent-write rollback behavior.
- [ ] Prove ambiguous committed append reconciliation, stale-worker fencing and blocked destination behavior.
- [ ] Record migration least privilege, exact release targeting and a compatible recovery path.
- [ ] Observe legitimate post-release capture and delivery separately from fixtures or deployment readiness.
- [ ] Review additional providers/tenants and sustained reliability before adopting the abstraction.
