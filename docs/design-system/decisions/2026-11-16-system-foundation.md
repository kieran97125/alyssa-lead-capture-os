# Foundation correctness and truthful interaction state

Date: 2026-11-16 (HKT). Status: implemented; final qualification pending; unreleased.

## Decision

Use the existing Alyssa System layer and compact staff workflows. Correct the underlying outcome, date, brand, completeness and acceptance semantics before broad visual migration or page-generation expansion.

- A visible queue option must select a reachable operational state. Booking screens must not pre-exclude completed outcomes that their own filters expose.
- Calendar-day predicates use the business timezone consistently across server helpers and table controls.
- A saved connection record is configuration, not proof of a verified working connection. The selected brand and observed readiness state determine the label and next action.
- Counts describe the complete selected scope or show an explicit unavailable/retry state. A successful partial read must not masquerade as an all-record total.
- Configured brand/offer content owns public page wording and price. Missing values use neutral copy rather than another brand's seed text.
- Anonymous visitor telemetry does not carry authority to confirm a booking, payment or attendance result.
- Accepted registration and external delivery are independent user-visible states. Preserve one stable submission identity across failed retries and hold ambiguous provider writes for reconciliation.

No additional general UI kit or feature-local button/dialog/table contract is introduced. Zod supplies shared runtime boundary validation; the existing design primitives remain responsible for presentation and accessible interaction.

## Qualification

Use synthetic brand/outcome/date and delivery states with the production helpers/components. Keep real customer data and provider writes outside fixtures. A screenshot that masks every data row does not qualify outcome selection, and a record-presence check does not qualify connection health.

Record exact final contract/build/Storybook/design/axe/browser results in the [release ledger](../../releases/2026-11-16-system-foundation.md). Baseline success is not a final-candidate pass. Add approved deterministic baselines only when the intended appearance changes; do not update snapshots to suppress an unexplained failure.

Current working-tree foundation regressions, public capture contract checks and TypeScript have passed. The earlier Storybook build predates the new stories and is not their qualification. PostgreSQL 17 persistence/concurrency, final build and rendered visual/browser evidence remain pending. The candidate has not changed production schema, configuration or deployed application source; the release ledger records the specific scheduled-worker rollout authorization blocker.

## Rollback

The application baseline is `ed5f0d6aad482158d40d62d934b65bafc74c3214`. A source rollback must retain accepted registrations, durable delivery receipts and recovery evidence. Additive schema/worker compatibility and a qualified worker-pause procedure must be recorded before release. Client source rows, staff assignments and report snapshots are not rollback instruments.

## Remaining design work

Shared fields/tables/filter/status/confirmation migration, persistent contextual navigation, unified save/conflict/recovery feedback and true protected LP draft preview remain explicit roadmap cards. This correctness release does not certify a complete visual redesign.
