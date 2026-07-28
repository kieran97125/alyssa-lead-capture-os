# Google Sheets OAuth connector boundary

- Date: 2026-07-28
- Source project: Alyssa Enterprise Pilot
- Module: Marketing Command Center / Data Sources
- Status: Local implementation validated; migration and production release pending
- Classification: Configurable Growth OS connector with Alyssa-specific source mapping

## Operational decision

Replace a server-held Service Account private-key integration with a Master-led
OAuth connection that lets the company Google account authorize read-only
Google Sheets access once.

## Reusable capability

- A provider connection starts from a Master-only action and uses authorization
  code flow with PKCE, an expiring HTTP-only state cookie, and a server-side
  callback access check.
- The connector requests only `spreadsheets.readonly` and refreshes short-lived
  access tokens server-side from an encrypted refresh token.
- Refresh tokens are encrypted before storage, are inaccessible to browser
  roles through RLS and grants, and never appear in source mapping, audit logs,
  API responses, or source control.
- Standard Admin may continue to run the approved manual data refresh, but only
  Master can start or replace the provider authorization.
- Data-source mapping, daily aggregate imports, reconciliation, metric
  ownership, and manual/scheduled sync paths remain unchanged.

## Product boundary

- OAuth provider type, requested scopes, callback host, encryption-key
  rotation, source-account choice, and UI copy are configurable.
- Workbook IDs, tab mappings, brand aliases, workspace domain, and the
  temporary shared-password access gate remain Alyssa-specific.
- Do not transfer any OAuth client secret, refresh token, source file metadata,
  domain, or customer data into Growth OS Core.

## Validation and next evidence

- Local changed-file lint and production build passed.
- Browser suite could not launch in this workspace because the Playwright
  Chromium binary is unavailable and its download was rejected by the runtime
  certificate gateway; CI/Preview acceptance remains required.
- Apply the additive migration, configure the OAuth Web Client, complete one
  Master authorization, and reconcile a manual refresh against the source
  report before exporting this learning to the canonical Product Learning Log.
