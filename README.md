# Alyssa Lead Capture OS

Alyssa Lead Capture OS is an attribution-ready registration form and lead source layer adapted from the `leadhub-source-os` foundation.

It is designed for Alyssa as:

- A Wix-embeddable registration form system.
- A parent-page UTM and click ID capture layer.
- A source snapshot system that stays separate from mutable lead/outcome data.
- A CTWA / WhatsApp attribution boundary for a future separate Alyssa CRM.
- A booking, payment, show/no-show, lost, and follow-up feedback loop for future revenue attribution.

## Architecture Boundary

Alyssa Lead Capture OS owns the lead capture and source attribution layer. It is responsible for Wix-embeddable registration forms, parent-page UTM and click ID capture, public lead submission, immutable `lead_source_snapshots`, lead event logging, thank-you tracking, and attribution-ready dashboard views.

Alyssa Lead Capture OS is not the future CRM app. The future Alyssa CRM OS should be a separate WhatsApp-first CRM for Meta WhatsApp API integration, WhatsApp inbox handling, CS follow-up, AI reply assistance, booking confirmation, paid / show / no-show / lost outcome tracking, and outcome write-back.

Both apps must share the same base data model. The shared base concepts are:

- `contacts`
- `leads`
- `lead_source_snapshots`
- `lead_events`
- `bookings`
- `brands`
- `treatments`
- `packages`
- `branches`

The contract is that Lead Capture OS creates the first attribution-backed lead record and source snapshot when a customer arrives from Wix, a form, CTWA, or another captured source. The future CRM reads the same `contacts`, `leads`, `lead_source_snapshots`, and `bookings` records, then writes operational outcomes back through `bookings`, `leads`, and `lead_events`. This lets the dashboard later calculate source-to-booking, source-to-show, and source-to-paid conversion without treating the CRM as a separate data island.

## Project Status

- Local app ready.
- GitHub ready.
- Vercel preview ready.
- Supabase not connected yet.
- Real lead insert pending.
- Wix embed production test pending.
- Payment webhook authentication pending.
- WhatsApp webhook authentication pending.

## UI Localization Note

The application UI is localized for Hong Kong internal growth and marketing users in Traditional Chinese / Hong Kong Cantonese where appropriate. Technical identifiers remain in English, including routes, API payload keys, UTM fields, CTWA fields, `source_type`, `tracking_status`, and `audit_reason` values.

## Local Setup

```bash
npm install
```

Run the local app on port 3010:

```bash
npm run dev -- -p 3010
```

Open:

- `http://localhost:3010`
- `http://localhost:3010/dashboard`
- `http://localhost:3010/forms`
- `http://localhost:3010/embed-preview`
- `http://localhost:3010/embed/alyssa-main-form-dev-token`

## Route Map

- `/` - Internal overview for the lead capture and shared attribution base.
- `/dashboard` - Attribution dashboard shell for source quality, event readiness, and future booking/payment outcome reporting. It does not show live performance until Supabase is connected.
- `/forms` - Local seed form configuration, embed code, and production path reference.
- `/forms/[formId]` - Form-level embed settings and operational values for handoff to live Supabase-backed configuration.
- `/embed-preview` - Internal Wix parent-page simulation that loads the real public embed script and shows attribution debug state.
- `/embed/[formToken]` - Public iframe registration form rendered for a given form token.
- `/thank-you` - Thank-you page that can receive lead/source identifiers and trigger thank-you tracking.
- `/api/public/forms/[token]` - Public form config lookup; returns local seed config until Supabase is configured.
- `/api/public/leads` - Public lead submission endpoint; creates contacts, source snapshots, leads, bookings, and events when Supabase is configured, otherwise returns a local no-op response.
- `/api/public/events` - Public event logging endpoint for form and attribution events.
- `/api/public/thank-you` - Thank-you tracking endpoint.
- `/api/webhooks/payment` - Payment outcome webhook placeholder; updates `payment_status` and logs payment events after authentication is added.
- `/api/webhooks/whatsapp` - WhatsApp inbound / CTWA attribution webhook placeholder; creates or updates shared contact/source records after authentication is added.

## Embed Preview

`/embed-preview` simulates a Wix parent landing page. It loads the real public embed script:

```text
http://localhost:3010/embed/alyssa-form.js
```

The preview page includes:

- A fake Alyssa landing page offer.
- The real embedded iframe form.
- A sample UTM URL button.
- An internal debug panel showing captured UTM, click ID, visitor/session IDs, tracking status, and audit reason.

## Test UTM Capture

Open this local URL:

```text
http://localhost:3010/embed-preview?utm_source=meta&utm_medium=paid_social&utm_campaign=alyssa_summer_consult&utm_content=rose_offer_card&fbclid=preview_fbclid_123
```

Expected behavior:

- The parent page captures the UTM and click ID before iframe submission.
- The debug panel shows the captured fields.
- The embedded form receives the attribution payload through `postMessage`.
- Submitting the form returns a local no-op lead response until Supabase is configured.

## Test Direct Iframe Form

Open:

```text
http://localhost:3010/embed/alyssa-main-form-dev-token
```

This tests the iframe form itself. It does not simulate parent-page attribution unless the parent embed script sends a payload, so `/embed-preview` is the preferred attribution test.

## Wix Embed Code

In local development, use:

```html
<script
  src="http://localhost:3010/embed/alyssa-form.js"
  data-form-token="alyssa-main-form-dev-token"
  data-brand="alyssa"
  data-form-id="alyssa-main-form">
</script>
```

In production, set:

```bash
NEXT_PUBLIC_APP_URL=https://your-production-domain.com
```

The app derives the displayed embed script URL from `NEXT_PUBLIC_APP_URL` when available.

## Supabase Connection

The app renders locally without Supabase. Public write APIs return local no-op IDs unless these environment variables are configured:

```bash
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

Never expose `SUPABASE_SERVICE_ROLE_KEY` to browser code.

When Supabase is connected, run the migration in:

```text
supabase/migrations/20260612000100_create_alyssa_lead_capture_os.sql
```

The migration creates:

- `contacts`
- `leads`
- `lead_source_snapshots`
- `lead_events`
- `forms`
- `brands`
- `treatments`
- `packages`
- `branches`
- `bookings`
- dashboard source/audit views

## Schema Readiness Audit

The current Supabase migration contains the shared base tables needed by Lead Capture OS and the future CRM app:

- `contacts` - present; includes `normalized_phone` as the shared customer matching key.
- `leads` - present; stores `normalized_phone`, `source_snapshot_id`, `source_type`, `payment_status`, `booking_status`, `lead_status`, and `crm_status`.
- `lead_source_snapshots` - present; stores UTM, click ID, CTWA, WhatsApp referral, tracking status, and audit fields separately from mutable lead outcomes.
- `lead_events` - present; includes form, attribution, WhatsApp, booking, payment, CRM follow-up, show/no-show, paid, lost, and duplicate events.
- `bookings` - present; links booking state back to lead, contact, brand, treatment, and branch.
- `brands` - present.
- `treatments` - present.
- `packages` - present.
- `branches` - present.

Schema conclusion: the base schema is ready for Supabase migration as a shared lead/source base. No table rename or major schema expansion is needed for this pass. The remaining work is connection, authentication, production domain setup, and live insert testing.

## Future CRM Contract Notes

The future Alyssa CRM OS should follow this contract:

- Match customers by `contacts.normalized_phone`.
- When a form lead already exists, read `leads.source_snapshot_id` and the linked `lead_source_snapshots` row instead of creating a disconnected source record.
- When a WhatsApp conversation arrives with CTWA referral metadata and no matching lead exists, create a shared lead/source path using `source_type = 'whatsapp_ctwa'`.
- When a WhatsApp conversation arrives without reliable source evidence and no matching lead exists, create the lead/source path using `source_type = 'organic_unknown'`.
- Update booking state through the existing `booking_status` values on `bookings` and, where appropriate, the related `leads.booking_status`.
- Log CRM follow-up activity into `lead_events` with `crm_followup_started` and `crm_followup_updated`.
- Write paid / show / no-show / lost outcomes through existing lead status, payment status, booking status, and event values such as `deal_paid`, `show_up`, `no_show`, and `deal_lost`.
- Preserve the original source snapshot so source-to-booking and source-to-paid conversion can be calculated later from `dashboard_lead_source_performance`.

## Environment Checklist

- `NEXT_PUBLIC_APP_URL` - required for production embed script URLs.
- `NEXT_PUBLIC_SUPABASE_URL` - pending; required before browser-side Supabase-aware flows are introduced.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - pending; required before browser-side Supabase-aware flows are introduced.
- `SUPABASE_SERVICE_ROLE_KEY` - pending; required by current server-side write APIs.
- `PAYMENT_WEBHOOK_SECRET` - pending; must be added before production payment webhook use.
- Future WhatsApp webhook secret / verification token - pending; must be added before production WhatsApp webhook use.

## Future Vercel Deployment

Do not deploy yet. Before deployment:

- Set `NEXT_PUBLIC_APP_URL` to the final Vercel or custom domain.
- Configure Supabase environment variables in Vercel.
- Add production Wix domains to `forms.allowed_domains`.
- Confirm webhook authentication for payment and WhatsApp endpoints.
- Run `npm run lint` and `npm run build`.

## Verification

```bash
npm run lint
npm run build
```
