# Alyssa Lead Capture OS

Alyssa Lead Capture OS is an attribution-ready registration form and lead source layer adapted from the local `leadhub-source-os` foundation.

It is designed for:

- Wix-embeddable registration forms.
- Parent-page UTM and click ID capture before iframe submission.
- Lead source snapshots that remain separate from mutable lead and CRM outcome data.
- CTWA / WhatsApp attribution boundaries for a future separate Alyssa CRM.
- Booking, payment, show, no-show, lost, and follow-up events that can later join back to the same attribution tables.

## Local Development

```bash
npm install
npm run dev
```

Open:

- `/dashboard`
- `/forms`
- `/embed/alyssa-main-form-dev-token`

## Wix Embed

```html
<script
  src="https://YOUR_DOMAIN/embed/alyssa-form.js"
  data-form-token="FORM_PUBLIC_TOKEN"
  data-brand="alyssa"
  data-form-id="FORM_ID">
</script>
```

The script reads parent-page URL parameters, stores first/latest touch where storage is available, creates the iframe, and sends attribution to the iframe by `postMessage` with strict target origin.

## Environment

The app can render locally without Supabase. API writes return local no-op IDs unless these are configured:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Never expose `SUPABASE_SERVICE_ROLE_KEY` to browser code.
