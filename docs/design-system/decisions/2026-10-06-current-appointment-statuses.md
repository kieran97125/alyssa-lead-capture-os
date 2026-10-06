# Current appointment cancellations and requested reschedules

## Operational behavior

The operator requested removal of the large historical Lead audit banner from Dashboard, and visibility of arrival-register cancellations and requested reschedules on Dashboard, Marketing Performance and Daily Overview. The banner is removed; the audit module, its permission checks, stored evidence and navigation badge remain available.

All three surfaces use one shared summary and the existing encrypted manual-refresh snapshot. The current verified appointment pointer supplies `canceled` or `reschedule_requested`; source notes and follow-up labels never supply an outcome. Counts are unique per account/lead and use appointment date within the selected period, current appointment brand/treatment, account scope, allowed brands and Marketing Performance source/campaign filters. Missing appointment dates are disclosed separately and excluded from period counts. Reconfirmed active appointments return to pending; superseded/completed appointments are not requested-reschedule counts. This is a current operational state view, not a historical count of changes.

## Compatibility and implementation

The stored snapshot accepts an additive, validated status projection. An explicit validated projection marker also distinguishes refreshed empty data from an empty legacy snapshot. Older snapshots keep existing funnel data and show unavailable status counts until an explicit successful refresh; they never present an invented zero. A failed refresh retains the prior snapshot. No migration, provider range expansion, automatic polling or operational-register mutation is added. The existing React, SystemDetails, semantic tokens, Storybook, Playwright and axe tools are sufficient; no dependency is added. Marketing Performance and Daily Overview start the supplementary saved-data read in its own Suspense boundary so its existing data is not gated by it.

## Verification

Authority tests cover cancellation, requested reschedule, reconfirmation, independent dates, account scope, permitted brands, campaign/source filters, deduplication, undated states and old-snapshot availability. Real store tests cover encrypted-payload validation and reject corrupt status, date, ownership row, unknown brand and contradictory pending state. Streaming tests retain notification permissions and confirm banner absence. Production build/contracts, shared-component stories, focused lint, desktop/mobile closed and expanded deterministic screenshots, keyboard disclosure and axe checks are required. Hosted gates remain authoritative for the recovered browser/font environment.

## Rollback

Revert this PR. The additional encrypted-payload field is ignored by the previous reader; existing funnel metrics, source settings and register data need no rollback. Removing the new status projection does not remove any stored customer or audit record.

## Product learning boundary

The configurable current-state summary and additive-snapshot availability pattern are recorded in `kieran97125/leadhub-source-os`, `docs/product-learning/entries/2026-10-06-current-appointment-exceptions.md` (commit `831459ec64987cc3b73c37601da7463304a9ae0a`) and its canonical index (commit `95cd925eb10bf9d19af97e9afc8d07d2c5de1f95`). Classification: Configurable, Enterprise Extension and Needs evidence. Provider tabs, account and brand mappings, status translations, customer rows, credentials and operational-register automation remain client-specific. Production parity and measured workflow impact remain Needs evidence until observed.

Hosted review: run `37451622599` passed production build, Storybook and all existing design cases. Only the new recovered-environment font baselines differed; reviewed mobile closed and desktop expanded actuals replace those two goldens. Screenshot assertions collect both states without weakening their failure semantics.
