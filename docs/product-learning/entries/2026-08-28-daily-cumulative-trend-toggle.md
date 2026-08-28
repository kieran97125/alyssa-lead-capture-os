# Daily / Cumulative Trend View

## Problem

A cumulative line is useful for pacing, but it hides daily volatility; a daily line exposes volatility, but it does not show progress against a period. Treating either view as the only chart contract forces users to mentally reconstruct the other view and can lead to incorrect operational conclusions.

## Product direction

Time-series performance charts support two explicit, equally reliable modes:

- **Daily**: the actual value recorded on each date, used for volatility, anomaly and operational diagnosis.
- **Cumulative**: the running total from the selected period start, used for pacing and like-for-like progress comparison.

Each surface keeps its own device preference, while preserving the historically expected default for that surface.

## Architecture decisions

- Daily base facts are the canonical data transported to chart components.
- Cumulative points are derived client-side from base numerators and denominators.
- CPL, CPA and conversion rates are recalculated after aggregation; ratios are never summed or averaged from daily ratios.
- Daily derived metrics remain `null` when the denominator is zero, creating an honest visual gap instead of a fabricated zero.
- Operational annotations remain attached to their real event date in both modes.
- Daily lines use linear interpolation; cumulative lines may use monotone interpolation.
- The toggle is accessible, keyboard-operable and persisted independently per product surface.

## Classification

- **Core**: daily/cumulative semantic model, aggregate-first ratio derivation, annotation date ownership and accessible toggle.
- **Configurable**: default mode, surface-specific preference key, available metrics and explanatory copy.
- **Client-specific**: brand palette, metric naming and operational event terminology remain isolated in the Alyssa implementation.

## Verification contract

- Dashboard, treatment performance and period comparison all expose the same two modes.
- Existing default behavior remains unchanged until a user switches mode.
- Mode preference survives reload without leaking across unrelated surfaces.
- Full production build and Playwright acceptance must pass before release.
