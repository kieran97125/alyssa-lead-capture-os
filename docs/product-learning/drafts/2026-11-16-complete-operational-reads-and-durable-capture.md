# Product Learning Entry

- Date: 2026-11-16
- Source project: Enterprise Pilot
- Source repository: `kieran97125/alyssa-lead-capture-os`
- Source PR / commit / release: Pending exact candidate and PR evidence. Audit baseline `ed5f0d6aad482158d40d62d934b65bafc74c3214`; first-batch implementation is present, final qualification and production rollout are pending. Do not publish this draft to the canonical index until source evidence is supplied.
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

The source audit establishes code-level defects and architectural risks. Five working-tree foundation regression programs, public capture contract checks and TypeScript were reported successful. An earlier component-workshop build predates new stories. These observations are not exact final-head, production-flow or sustained reliability-outcome evidence.

Pending: exact implementation source, isolated PostgreSQL transaction/replay qualification, browser/design acceptance, final build, hosted checks, migration/privilege readback and release targeting. A new authenticated scheduled-worker configuration requires specific rollout authorization before activation; no production schema, environment configuration or application deployment has changed. No conversion improvement, performance improvement, production-loss incident or sustained error reduction is claimed.

## Reusable abstraction

1. Make every visible queue/filter combination reachable through a shared domain predicate.
2. Treat business timezone and scope as explicit inputs across server and client views.
3. Model connection configuration, verification and current availability as different states.
4. Make read completeness a contract: paginate the selected scope and required relationships, or fail explicitly before publishing totals.
5. Reserve operational event authority for trusted writers; bound anonymous telemetry separately.
6. Persist an accepted capture and its delivery intent atomically under an idempotent request identity.
7. Separate confirmed failure from an unknown external mutation result. Reconcile unknown outcomes using stable destination identity and retain evidence.
8. Keep capture acceptance, external delivery and metric publication freshness independent.

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
