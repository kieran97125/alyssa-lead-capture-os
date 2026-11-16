# Foundation correctness and truthful interaction state

Date: 2026-11-16 (HKT). Status: source and reviewed baselines qualified; unreleased.

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

Qualified source `ec9de3867555951df70e26dca07e30608e194458` passed 251/251 application tests, PostgreSQL 17 behavior/concurrency/rollback/grants, full build/contracts, Storybook, standard design/axe, report layouts and focused desktop/mobile interactions. Exact workflow/deployment pins are recorded in the release ledger. Ten new PNGs and the explained existing CRM baseline below were reviewed and committed. Local browser execution was blocked by EPERM and is not claimed as a pass; hosted browser evidence is explicit. Production remains unchanged and requires the specific rollout authorization.

## Rollback

The audit reference is `ed5f0d6aad482158d40d62d934b65bafc74c3214`; its full legacy writer is not a compatible post-capture downgrade. A source rollback must retain accepted registrations, durable delivery receipts and recovery evidence. The release ledger records tested UI-only downgrade `a30834824eb67c98dd6c9a9cb5bc15e382609714`, which keeps the new capture/browser/worker contract and complete reads. Unscheduling does not cancel queued/active/per-capture workers; it is not a full mutation pause. Client source rows, staff assignments and report snapshots are not rollback instruments.

## Remaining design work

Shared fields/tables/filter/status/confirmation migration, persistent contextual navigation, unified save/conflict/recovery feedback and true protected LP draft preview remain explicit roadmap cards. This correctness release does not certify a complete visual redesign.

## CRM baseline review

The existing CRM desktop baseline was reviewed manually against the hosted expected, actual and diff images from run `43801357361`. Required horizontal-table, 13-column row and action assertions all passed. The intended brand correction removes an incorrect brand-specific connection notice when all brands are selected, moving the table up 48 pixels. The old approved PNG also retained English headers and the older filter arrangement even though the audited `ed5f0d6` source already contained the current Chinese copy and filters. The current rendered image is approved for the existing baseline: no missing control, page overflow or stacked-row regression was found. No layout assertion was removed and no old warning was restored to satisfy a screenshot. Approved PNG SHA256: `ad605aee861193bcf36803ed87471dda5314bec79b7cc497038a023fb39813db`.

## Foundation fixture approval

Run `43803391043` passed candidate generation and a separate non-update rerun on implementation source `3bbde1ac34799224d6b744a2820766a09856974a`. All ten resulting PNGs were reviewed: CRM No Show and delivery normal, exception-review, member-required and unavailable states on desktop/mobile. The shared component keeps clear state, usable focus/actions and no page overflow. Mobile CRM retains the established horizontal table scroll. The delivery unavailable view displays no invented zero total; recovery is enabled only in the eligible member state. These new baselines are approved; artifact and individual checksums are recorded in [the evidence manifest](../evidence/2026-11-16-foundation-visual-sha256.txt). Existing baselines were preserved apart from the separately reviewed CRM screenshot above.
