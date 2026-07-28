# Marketing Command Center data-source and metric-ownership boundary

- Date: 2026-07-28
- Source project: Alyssa Enterprise Pilot
- Module: Marketing Command Center / Connections / Access Control
- Status: Local implementation and production build validated; PR, migration, and release pending approval
- Classification: Core + Configurable + Enterprise Extension + Alyssa-only temporary access gate

## Real operational problem

An internal marketing dashboard needs cross-brand Budget, Lead, Book, Show, and
spend pacing, but the operational source data currently lives across external
spreadsheets and first-party application records. Merely saving a spreadsheet
identifier creates false confidence: it does not prove credentials, mapping,
freshness, or a successful import. Reading spreadsheets directly on every
dashboard request also creates latency, quota, lineage, and availability risk.

## Tested implementation

- Data sources begin as Draft and become Connected only after a verified read
  and successful aggregate upsert.
- A protected server-side adapter reads only the required columns, converts
  spreadsheet serial dates, normalizes brand labels, and stores daily
  aggregates rather than customer rows.
- Daily spend and lead-funnel sources declare different metric ownership.
- Lead and Book are attributed to lead-created date; Show is attributed to
  confirmed show date.
- Dashboard pacing uses the first day of the current Hong Kong month through
  yesterday.
- Manual Dashboard refresh uses the same importer, reconciliation, status,
  error, and audit path for every active source.
- Standard Admin and Master sessions may run the low-risk operational refresh,
  while source mapping, credentials, monthly targets, and access settings
  remain Master-only.
- Concurrent manual requests use an atomic source claim and a stale-lock
  recovery window so repeated clicks do not run overlapping imports.
- Automatic scheduling remains disabled during the first rollout and can be
  introduced later without changing metric ownership or the importer.
- Credentials remain in server-only environment configuration; public source
  mapping stores no passwords, access tokens, or private keys.
- A temporary signed Admin / Master password session protects infrastructure
  settings until individual user authentication is introduced.

## Reusable abstraction

1. Treat connection state as an observed outcome, not a saved form value.
2. Separate provider access, sanitized source mapping, imported snapshots, and
   dashboard presentation.
3. Assign one authoritative owner for each metric and time grain to prevent
   duplicate totals.
4. Preserve metric-specific date semantics instead of forcing every outcome
   onto one event date.
5. Store aggregate snapshots for dashboards; keep customer records in their
   operational system of record.
6. Separate permission to execute a low-risk refresh from permission to change
   provider mapping or credentials.
7. Use one verified sync service for manual operation and any later scheduled
   execution.

## Client-specific elements that must remain isolated

- Workbook identifiers, tab names, column mappings, brand aliases, targets, and
  live totals
- Service-account identity and credentials
- Temporary internal passwords and session secret
- Client-specific status labels until they are mapped into a configurable
  outcome taxonomy

## Product classification reasoning

- Source registry, credential isolation, sync lifecycle, metric ownership,
  reconciliation, and audit are Core.
- Provider, dataset profile, columns, cadence, refresh permissions, brand
  mapping, and warning thresholds are Configurable.
- Preconfigured client workbooks and operational status mappings are Enterprise
  Extension.
- The temporary shared-password gate is Alyssa-only and must not replace
  individual Growth OS authentication or authorization.

## Follow-up validation

- Apply the additive migration to a review branch and confirm service-role-only
  Data API access.
- Complete one authenticated spreadsheet sync and reconcile imported aggregates
  against the source report through the same cutoff date.
- Run browser acceptance in CI and confirm that both Admin and Master sessions
  can manually refresh while only Master can edit source settings.
- Revisit scheduling only after the manual refresh workflow has operational
  evidence.
- After PR and release evidence exist, export the reusable abstraction to the
  canonical Product Learning Log.
