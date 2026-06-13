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
- Supabase-backed lead insert tested locally and on Vercel production.
- Real lead insert path ready.
- Wix embed production test pending.
- Payment webhook authentication pending.
- WhatsApp webhook authentication pending.

## Product Modes

Alyssa Lead Capture OS supports two output modes that share the same lead capture, UTM, source snapshot, booking, and event model.

### Form-only mode

- The user configures brand, treatment, package, branch, and form token.
- The system generates an embed script.
- The embed script is inserted into Wix pages.
- Wix remains the main website and brand website.
- Lead Capture OS handles form capture, UTM capture, source snapshots, lead attribution, bookings, and lead events.

### Landing page mode

- The same form config can be wrapped in a simple campaign landing page when a campaign needs hero copy, offer sections, treatment content, CTA copy, FAQ, testimonials, or visual assets.
- Landing pages are for fast market testing and campaign experiments.
- Landing page mode is not a full Wix replacement.
- It remains a campaign testing layer backed by the same lead attribution model.
- The current implementation uses local seed config for `landing_pages`; a future builder can persist fields such as `hero_title`, `hero_subtitle`, `hero_image_url`, `offer_badge`, `cta_text`, and `sections_json`.

Future CRM connection remains separate. The future Alyssa CRM OS should read and write outcomes against the shared lead base instead of becoming part of the Lead Capture OS UI.

## Configuration Layer Direction

Configuration Foundation V1 introduces a clear hierarchy for campaign testing:

```text
Brand
↓
Treatment
↓
Package / Price
↓
Branch
↓
Form
↓
Form-only embed or Landing page mode
```

The current app exposes read-only settings pages for:

- Brand settings.
- Treatment settings.
- Package / price settings.
- Branch settings.
- Landing Page Templates.

Form-only mode uses this configuration layer to select a brand, treatment, package, and branch, then generate the Wix embed script.

Landing page mode uses the same form/source/lead base and adds template, hero copy, offer copy, sections, FAQ, CTA, and visual content for simple campaign testing pages.

Current implementation notes:

- `brands`, `treatments`, `packages`, `branches`, and `forms` are read from existing Supabase tables when configured, with local config as a fallback for development.
- Landing page templates and landing page config remain local config for now.
- Full admin editing for brands, treatments, packages, branches, forms, templates, and landing pages is future work.
- A future DB-backed `landing_pages` table can store template, hero, offer, section, FAQ, CTA, and status fields when the builder graduates from config preview.
- The future WhatsApp CRM remains a separate app that writes outcomes back to the shared lead base.

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
- `/dashboard` - Executive overview for lead performance, top KPIs, latest few leads, and quick links.
- `/leads` - Latest leads feed, newest first, with business-facing lead details.
- `/performance` - Brand, source/campaign, treatment/package, and branch performance analysis.
- `/forms` - Form connection layer showing selected brand, treatment, package, branch, allowed domains, embed code, and landing page relationship.
- `/forms/[formId]` - Form-level configuration detail for form-only embed and landing page mode reuse.
- `/landing-pages` - Landing page management foundation covering form-only and campaign landing-page modes.
- `/landing-pages/[pageId]` - Lightweight landing page config / editor preview foundation.
- `/lp/[slug]` - Public campaign landing page preview using the existing lead capture form path.
- `/settings` - Configuration foundation overview and hierarchy.
- `/settings/brands` - Brand settings view.
- `/settings/treatments` - Treatment settings view.
- `/settings/packages` - Package / price settings view.
- `/settings/branches` - Branch settings view.
- `/settings/templates` - Landing Page Templates foundation.
- `/embed-preview` - Internal Wix parent-page simulation that loads the real public embed script and shows attribution debug state.
- `/embed/[formToken]` - Public iframe registration form rendered for a given form token.
- `/system-audit` - Technical source/event/debug information such as source snapshots, lead events, tracking status, and CRM outcome contract markers.
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

Payment status semantics:

- `booking_only` means the customer requested a booking without starting a payment flow.
- `pending` means a payment flow has started or is awaiting payment confirmation.
- `leads.price` stores the selected package promo/display price; it is not reduced to zero just because `payment_status = 'booking_only'`.

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
