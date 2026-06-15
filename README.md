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

## Landing Page Content Editor Direction

Landing Page Content Editor V1 is a structured editor foundation for campaign testing pages. It is not a full Wix replacement and not a drag-and-drop page builder.

Current V1 supports an editor-like internal screen for:

- Basic page settings.
- Template selection foundation.
- Hero title, subtitle, and image URL.
- Offer badge, offer copy, and CTA copy.
- Pain points and benefits.
- Treatment / package / branch summary.
- Process, trust cues, and FAQ.
- Form connection and preview URL.
- A live-style preview panel.

The current editor UI is read-only / save-ready by design. Save and publish workflows should be added later with a DB-backed `landing_pages` table for fields such as template, status, slug, hero content, offer content, sections, FAQ, CTA, and publish metadata.

Wix remains the main website. Lead Capture OS landing pages are for fast offer, angle, treatment, and audience testing while preserving the same lead capture and attribution flow.

## DB-backed Landing Page Builder Direction

The current landing page editor is a config-preview foundation. A future DB-backed builder should store campaign page content and image assets in Supabase before full editing is enabled.

Recommended model:

- `landing_pages` - one record per campaign page, with slug, title, brand, treatment, package, branch, form, template, mode, status, current content, image assets, and published version reference.
- `landing_page_versions` - version history for drafts and published versions.
- `landing_page_templates` - optional template registry if templates become editable instead of local config.
- `landing_page_assets` - optional asset registry once upload/media library exists.

Recommended JSON fields:

- `content_json` - hero, offer, CTA, pain points, benefits, sections, process, trust, and FAQ content.
- `image_assets_json` - hero, mobile hero, offer, treatment, process, and trust image URLs or storage references.

Future workflow:

- Save draft: write a draft version without changing public output.
- Internal preview: allow internal users to preview a draft version.
- Publish: mark a selected version as published, update `published_version_id`, and make `/lp/[slug]` render only published content.
- Archive: remove a campaign page from public rendering without deleting history.

Public `/lp/[slug]` should read only published content. Internal preview routes can read draft content after team access is connected. Images may later come from Supabase Storage, Wix assets, or external URLs. Team access should control who can edit, publish, and archive pages.

Draft SQL direction is documented in:

```text
supabase/drafts/20260614000200_landing_page_builder_foundation.sql
```

## Landing Page Save / Publish V1

Landing Page Save / Publish V1 promotes the builder plan into a real Supabase migration:

```text
supabase/migrations/20260614000200_create_landing_page_builder.sql
```

The migration creates:

- `landing_pages` - one record per campaign page, including slug, title, brand, treatment, package, branch, form, template, mode, status, current content JSON, image asset JSON, published version reference, publish timestamp, and audit timestamps.
- `landing_page_versions` - draft / published version records for page-level content JSON and image asset JSON.

The V1 workflow is intentionally structured rather than drag-and-drop:

- Save draft: writes the current page-level content and image asset JSON into `landing_page_versions` with `status = 'draft'`, then updates the parent `landing_pages` row as draft.
- Publish: publishes the latest draft when available, updates `landing_pages.status = 'published'`, sets `published_version_id`, and updates `published_at`.
- Public render: `/lp/[slug]` prefers Supabase published content and falls back to local config if Supabase env vars or builder tables are unavailable.
- Internal editor: `/landing-pages/[pageId]` shows Save Draft / Publish controls only as DB-backed actions when the migration is applied; otherwise it clearly stays in local config fallback mode.

Apply the migration in Supabase SQL editor or through your migration workflow before expecting Save Draft / Publish to persist. The current editor still uses read-only prefilled fields; full field editing, media upload, version history UI, draft preview URLs, and auth-based publish permissions remain future builder work.

## Multi-form Management

Alyssa Lead Capture OS supports multiple reusable registration forms per brand.

- Forms share one unified visual style in `/embed/[formToken]`.
- Each form has its own `public_form_token` and Wix embed code.
- A form can be embedded directly in Wix or connected to a Landing Page campaign.
- Forms differ by business configuration: brand, treatment, package, branch, allowed domains, and status.
- Creating or duplicating a form generates a new safe token in the format `alyssa-[slug]-form-[shortid]`.
- Duplicate form copies configuration only, creates a new form token, and does not copy leads or submissions.
- Unused forms can simply be left unused for now.
- Archive, delete, and re-enable workflows are not part of V1.
- Existing leads remain unchanged when form settings are edited.

This keeps form management flexible without creating per-form style systems or a visual form builder.

## Create Campaign Flow

`/campaigns/new` gives marketers one guided entry point for starting a campaign.

- Choose Wix registration form when Wix already has the page content and the team only needs a reusable embedded form.
- Choose Landing Page when testing a new offer, copy angle, image direction, treatment, or package.
- Both options create a form with a unique token and use the same lead capture and source tracking base.
- Wix form campaigns redirect to the form detail page so the team can copy the embed code and preview the form.
- Landing Page campaigns create a form first, then create a draft campaign page connected to that form when the landing page tables are available.
- Publishing remains a separate step in the Landing Page editor.

## Landing Page Image Asset Strategy

Landing page mode uses structured image slots so marketers can prepare premium medical beauty / wellness assets for campaign testing. Images should support trust, desire, treatment value, and booking confidence without replacing the full Wix website.

Recommended slots:

- `hero_image_url` - desktop hero visual; premium clinic, consultation, or glowing-skin image. Recommended ratio: 16:9 or 4:3.
- `mobile_hero_image_url` - mobile first-screen hero visual. Recommended ratio: 4:5.
- `offer_image_url` - offer value image, treatment room, or device close-up. Recommended ratio: 1:1 or 4:5.
- `treatment_image_url` - product, service, or treatment visual. Recommended ratio: 1:1 or 4:5.
- `process_image_1_url` - consultation / skin analysis. Recommended ratio: 1:1.
- `process_image_2_url` - treatment experience. Recommended ratio: 1:1.
- `process_image_3_url` - WhatsApp booking confirmation. Recommended ratio: 1:1.
- `trust_image_url` - clean clinic, professional environment, or reception visual. Recommended ratio: 16:9.

Current V1 supports image URLs and premium placeholders. Upload, cropping, media library, Supabase Storage, Wix assets, and external image management are future work.

## UI Localization Note

The application UI is localized for Hong Kong internal growth and marketing users in Traditional Chinese / Hong Kong Cantonese where appropriate. Technical identifiers remain in English, including routes, API payload keys, UTM fields, CTWA fields, `source_type`, `tracking_status`, and `audit_reason` values.

## Guided UX Direction

Alyssa Lead Capture OS is designed for non-technical marketing, management, CS, and operations users. Business screens should explain what the page is for, what the user should do first, which actions are safe internal actions, and which actions affect public campaign pages.

Core guided workflows:

- Form-only mode - Wix owns the page content; Lead Capture OS provides the embedded form and attribution capture.
- Landing page mode - marketers prepare campaign content, save internal drafts, preview, then publish a public campaign page.
- Lead monitoring - CS and operations review latest registration records and booking requests.
- Performance reporting - management and marketing compare leads, bookings, source, campaign, treatment, package, and branch performance.
- Future CRM feedback - the future WhatsApp CRM writes outcomes back into the shared lead base.

Technical audit details such as low-level tracking fields, system health, source snapshot diagnostics, and webhook debugging should stay in `/system-audit`, not on the main business screens.

## Design System Direction

Alyssa Lead Capture OS uses a custom premium medical beauty / wellness visual system rather than a generic SaaS blue theme.

Current V1 design tokens define:

- Warm ivory and blush page backgrounds.
- Soft rose and mauve accents.
- Champagne borders and highlights.
- Coral CTA treatment.
- Deep plum text.
- Premium card surfaces, rounded radii, focus states, and soft shadows.

Shared UI primitives live in `src/components/alyssa/ui.tsx` for reusable cards, stats, badges, empty states, CTA buttons, section headers, and page shells. Motion primitives live in `src/components/alyssa/MotionReveal.tsx`.

Motion is provided by `motion/react` and is used sparingly for subtle section reveal, KPI card reveal, CTA hover/tap, landing page hero reveal, and editor/list card polish. Reduced-motion preferences are respected through `useReducedMotion()` and the global `prefers-reduced-motion` CSS guard.

If the internal app grows into a larger admin surface, shadcn/ui-style primitives are the preferred next component-system step. Open Props-style token thinking may inspire future refinements, but Alyssa tokens remain custom to the brand and campaign-testing product.

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

- `/` - Public product entry page for the lead capture and shared attribution base.
- `/dashboard` - Executive overview for lead performance, top KPIs, latest few leads, and quick links.
- `/leads` - Latest leads feed, newest first, with business-facing lead details.
- `/performance` - Brand, source/campaign, treatment/package, and branch performance analysis.
- `/forms` - Form connection layer showing selected brand, treatment, package, branch, allowed domains, embed code, and landing page relationship.
- `/forms/[formId]` - Form-level configuration detail for form-only embed and landing page mode reuse.
- `/landing-pages` - Landing page management foundation covering form-only and campaign landing-page modes.
- `/landing-pages/[pageId]` - Structured Landing Page Content Editor V1 with read-only/save-ready fields and preview panel.
- `/lp/[slug]` - Public campaign landing page preview using the existing lead capture form path.
- `/settings` - Configuration foundation overview and hierarchy.
- `/settings/brands` - Brand settings view.
- `/settings/treatments` - Treatment settings view.
- `/settings/packages` - Package / price settings view.
- `/settings/branches` - Branch settings view.
- `/settings/templates` - Landing Page Templates foundation.
- `/settings/team` - Team access, roles, and future login foundation.
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

## Internal Access Boundary

Alyssa Lead Capture OS separates public campaign/form routes from internal business and configuration routes.

Public routes remain accessible for campaigns, Wix embeds, and lead capture:

- `/`
- `/lp/[slug]`
- `/embed/[formToken]`
- `/api/public/forms/[token]`
- `/api/public/leads`
- `/api/public/events`
- `/api/public/thank-you`

Internal routes are protected by a lightweight Basic Auth gate when credentials are configured:

- `/dashboard`
- `/leads`
- `/performance`
- `/forms`
- `/forms/[formId]`
- `/landing-pages`
- `/landing-pages/[pageId]`
- `/settings`
- `/settings/brands`
- `/settings/treatments`
- `/settings/packages`
- `/settings/branches`
- `/settings/templates`
- `/system-audit`
- `/embed-preview`

This boundary protects dashboards, lead lists, configuration views, landing page management, and system audit information before the project has a full admin login system.

Set these environment variables in Vercel for preview or production internal use:

```bash
INTERNAL_BASIC_AUTH_USER=
INTERNAL_BASIC_AUTH_PASSWORD=
```

When both values are set, visiting an internal route prompts for Basic Auth. Public landing pages, embedded forms, public lead submit APIs, static assets, and the public embed script remain reachable without Basic Auth.

When these variables are missing, local development remains open and internal pages show this warning banner:

```text
內部頁面保護尚未設定，正式使用前請加入環境變數。
```

Do not commit real credentials. Longer term, this lightweight gate should be replaced or upgraded with Supabase Auth, role-based admin login, or another internal identity provider.

## Team Access Direction

Basic Auth is a temporary outer protection layer for early Vercel previews and internal URLs. It protects internal pages before the product has proper team login, but it is not the long-term admin access model.

The intended long-term layer is Supabase Auth plus role-based access control. Each team member should have their own login, a profile, a role, a status, and optional brand access.

Team Access Enforcement V1 adds reusable permission helper foundations while keeping Basic Auth in place. The current internal app uses a temporary access context:

- `source = "temporary_internal_access"`
- `role = "owner"`
- `brandAccess.scope = "all"`

This does not mean real login exists yet. It prepares internal pages and navigation to understand the shape of role, module, and brand access before Supabase Auth is connected.

Suggested roles:

- `owner` - full business, settings, audit, and future CRM access.
- `admin` - system administrator for daily internal operations.
- `manager` - management view across leads, performance, campaigns, and future CRM.
- `marketer` - campaign, form, landing page, and performance role.
- `cs` - customer-service role for leads and future WhatsApp CRM follow-up.
- `designer` - landing page and form-content support role.
- `viewer` - read-only overview and performance role.

Suggested modules:

- `dashboard`
- `leads`
- `performance`
- `forms`
- `landing_pages`
- `settings`
- `system_audit`
- `future_crm`

Suggested shared access tables:

- `profiles` - one row per Supabase Auth user, with role and status.
- `user_brand_access` - optional brand-level access for multi-brand growth.
- `user_module_permissions` - optional per-user overrides only if role defaults are not enough.

The future Alyssa CRM app should reuse this access model where possible, especially `profiles`, roles, status, and brand access. This keeps Lead Capture OS and CRM from creating separate user islands.

Implemented helper foundation in `src/lib/security/teamAccess.ts`:

- `canAccessModule(role, module)`
- `canAccessBrand(userAccess, brandId)`
- `getRoleLabel(role)`
- `getModuleLabel(module)`
- `getVisibleModulesForRole(role)`
- `getCurrentAccessContext()`
- `getAccessibleBrandIds(userAccess, allBrandIds)`
- `shouldIncludeBrandScopedRecord(userAccess, brandId)`

Future brand-scoped pages should filter:

- Leads by accessible brand IDs.
- Performance data by accessible brand IDs.
- Forms by accessible brand IDs.
- Landing pages by accessible brand IDs.

A draft SQL direction is documented in:

```text
supabase/drafts/20260614000100_team_access_foundation.sql
```

This is intentionally a draft, not an applied migration. Full login, user management, invitations, password reset, and role editing remain future admin work.

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
- `INTERNAL_BASIC_AUTH_USER` - required before exposing internal business/config pages.
- `INTERNAL_BASIC_AUTH_PASSWORD` - required before exposing internal business/config pages.
- Future WhatsApp webhook secret / verification token - pending; must be added before production WhatsApp webhook use.

## Future Vercel Deployment

Do not deploy yet. Before deployment:

- Set `NEXT_PUBLIC_APP_URL` to the final Vercel or custom domain.
- Configure Supabase environment variables in Vercel.
- Configure `INTERNAL_BASIC_AUTH_USER` and `INTERNAL_BASIC_AUTH_PASSWORD` in Vercel before sharing internal dashboard/config URLs.
- Add production Wix domains to `forms.allowed_domains`.
- Confirm webhook authentication for payment and WhatsApp endpoints.
- Run `npm run lint` and `npm run build`.

## Verification

```bash
npm run lint
npm run build
```
