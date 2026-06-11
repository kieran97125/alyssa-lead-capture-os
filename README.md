# Alyssa Lead Capture OS

Alyssa Lead Capture OS is an attribution-ready registration form and lead source layer adapted from the `leadhub-source-os` foundation.

It is designed for Alyssa as:

- A Wix-embeddable registration form system.
- A parent-page UTM and click ID capture layer.
- A source snapshot system that stays separate from mutable lead/outcome data.
- A CTWA / WhatsApp attribution boundary for a future separate Alyssa CRM.
- A booking, payment, show/no-show, lost, and follow-up feedback loop for future revenue attribution.

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
