# Lead Sheet v4 — immutable funnel event ledger cutover

## Contract

- The visible operational `lead` sheet remains A:W.
- `Created At` remains the immutable Lead/first-touch date.
- `跟進狀態` is the authoritative current status. Legacy `Status` / `Show up` are used only when it is blank.
- `最後更新日期` is reserved for true status-transition time.
- Historical Book / Show / No Show events are stored in hidden `_funnel_events`; later status changes must not rewrite earlier events.
- Existing Leads without ledger rows retain the historical fallback date model. No old month is backfilled during rollout.

## Event ledger headers

`Event ID | Event At | Event Date | Event Type | lead_key | Brand | Phone Last8 | Source Row | Status Before | Status After | Created At | Treatment | Source | Campaign | Branch`

Event types are `lead`, `book`, `show`, and `no_show`. A Lead becomes ledger-governed as soon as it has any valid ledger event.

## Deployment order

1. Deploy Growth OS ledger-aware reader and legacy-safe fallback.
2. Create the hidden `_funnel_events` sheet and the four formula-driven brand views.
3. Replace the bound Apps Script with the v4 script and run its installer/verification.
4. Verify one test Lead through Lead → Book → Show and confirm the earlier Book event remains.
5. Keep legacy A:W ingestion and Meta raw-row normalization enabled during the cutover.
