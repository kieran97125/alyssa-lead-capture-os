# Cost-per-funnel trends with explicit spend ownership

## Problem

Performance pages exposed Lead, Book, Show and conversion-rate trends, while CPLead, CPBook and CPShow were only visible as period totals or on selected comparison scopes. Operators could not see when acquisition cost changed during the month. A naive treatment-level implementation would divide brand spend by treatment counts and falsely imply that the spend had been attributed to that treatment.

## Decision

All primary performance trend surfaces expose `CPLead`, `CPBook` and `CPShow` controls. Daily cost points use canonical daily brand spend and the matching daily funnel denominator. Cumulative mode sums spend and funnel numerators first, then recalculates the ratio. Ratios are never added or averaged.

Dashboard lines retain brand ownership. Treatment Performance keeps its treatment lines for funnel metrics but switches to a separate brand-owned series for cost metrics. When a treatment, source or campaign filter is active, the UI keeps the controls discoverable but returns an explicit unallocated state instead of estimating spend. Period Comparison keeps brand/overall cost scopes and uses the same compact naming.

## Guardrails

- An absent spend row is not interpreted as HK$0; the daily cost point is `null` and the line has a visible gap.
- An explicit zero spend row remains a valid recorded value.
- Cumulative cost is recalculated from cumulative spend and cumulative counts.
- Brand-level spend is never copied or proportionally allocated to treatment, source or campaign dimensions without a real attribution key.
- Partial or missing spend coverage is explained beside the chart.
- Funnel counts, Lead/Book/Show ownership and existing report definitions remain unchanged.

## Classification

- **Core**: aggregate-first cost trends, recorded-vs-missing spend semantics, reusable cost metric controls and unavailable-state contract.
- **Configurable**: labels, default metric, currency formatting and which dimensions own spend.
- **Needs evidence**: future campaign/ad-level CP trends require a canonical spend-to-campaign key before activation.

## Client-specific boundary

Brand names, colors, treatment labels, campaign names, spend rows and production performance values remain Alyssa tenant data and must not be copied into Growth OS Core.

## Source evidence

- Source PR: pending
- Release commit: pending
- Production deployment: pending

## Verification

- Production build and TypeScript.
- Shared reporting trend contract.
- Dashboard and Treatment Performance functional acceptance.
- Treatment-filtered unallocated-cost acceptance.
- Storybook build, deterministic desktop screenshots and WCAG design gate.
- Full Playwright regression.

## Rollback

Revert the source PR. No schema change is required; existing stored metrics and spend rows remain untouched.
