# LaunchHub

LaunchHub is an attribution-ready registration form and lead source layer adapted from the `leadhub-source-os` foundation.

It is designed for multi-brand campaign operations as:

- A Wix-embeddable registration form system.
- A parent-page UTM and click ID capture layer.
- A source snapshot system that stays separate from mutable lead/outcome data.
- A CTWA / WhatsApp attribution boundary for a future separate CRM.
- A booking, payment, show/no-show, lost, and follow-up feedback loop for future revenue attribution.

## Naming Direction

- Internal product/system name: LaunchHub.
- Descriptive name: Campaign Launch OS.
- Public campaign pages and public forms should show the selected brand and operating company, not the system name.
- Alyssa, Ineffable, Skin Light, and future names remain brand records or campaign clients inside the system.
- Do not use public customer-facing pages to define developer/company IP ownership. System IP, ownership, and company licence terms should be handled by a separate written agreement between the developer and the company.

## Brand-first Form Launch OS

LaunchHub admin is organized around brand-first form operations for real Alyssa and Ineffable Beauty launches.

- `/brands` is the Brand Workspace. Select Alyssa or Ineffable Beauty first, then manage that brand's forms, Landing Pages, treatments, branches, leads, Pixel status, allowed domains, and launch shortcuts.
- `/forms` is a brand-scoped Wix form operations table with filters for brand, treatment, branch, status, and search by form name/token.
- `/forms/new` uses a sectioned creation flow: choose brand, treatment/offer, one or more branches, allowed domains, tracking/Pixel status, then create the form.
- `/forms/[formId]` shows a ready-to-copy Wix embed snippet, the exact form token, test form URL, Meta URL Parameters, allowed domains, and brand safety warnings.
- Wix embed snippets are generated from the selected form's brand. Alyssa forms should use Alyssa tokens and Alyssa Pixel config; Ineffable forms should use Ineffable tokens and Ineffable Pixel config.
- If a brand Pixel is missing, LaunchHub still allows form creation but omits `data-pixel-id` from the embed snippet and shows a warning.
- Forms can expose one or more branches to visitors. `forms.default_branch_id` remains as the compatibility/default branch, while `form_branches` stores the selectable branch list after `docs/FORM_MULTI_BRANCHES_APPLY.sql` is applied.
- Meta Ads URL Parameters are copyable from Brand Workspace and form detail pages. Do not use `pixel_debug=1` or `attribution_debug=1` in real ads.

## Architecture Boundary

LaunchHub owns the lead capture and source attribution layer. It is responsible for Wix-embeddable registration forms, parent-page UTM and click ID capture, public lead submission, immutable `lead_source_snapshots`, lead event logging, thank-you tracking, and attribution-ready dashboard views.

LaunchHub is not the future CRM app. The future CRM app should be a separate WhatsApp-first CRM for Meta WhatsApp API integration, WhatsApp inbox handling, CS follow-up, AI reply assistance, booking confirmation, paid / show / no-show / lost outcome tracking, and outcome write-back.

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

The contract is that Campaign Launch OS creates the first attribution-backed lead record and source snapshot when a customer arrives from Wix, a form, CTWA, or another captured source. The LeadOps CRM foundation reads the same `contacts`, `leads`, `lead_source_snapshots`, and `bookings` records. A future CRM write layer can then write operational outcomes back through `bookings`, `leads`, and `lead_events`. This lets the dashboard later calculate source-to-booking, source-to-show, and source-to-paid conversion without treating CRM data as a separate island.

## LeadOps CRM Foundation

LaunchHub includes a LeadOps CRM area at `/crm`. By default it is a safe read-only operational view over existing LaunchHub lead data. When the dedicated CRM tables exist and `CRM_WRITE_ENABLED=true`, the detail page can enable the CS operation write layer.

Current scope:

- Read existing Supabase-backed leads, contacts, source snapshots, bookings, brands, treatments, packages, and branches.
- Display a phone-first CRM inbox for CS follow-up.
- Use `brand_slug + normalized_phone` as the canonical CRM identity.
- Normalize CRM source display into `landing_form`, `whatsapp_ad`, `whatsapp_direct`, `manual`, `import`, or `unknown`.
- Surface CTWA fields when they exist, including source ID, source URL, referral headline/body, campaign ID, ad set ID, ad ID, phone number ID, and future WhatsApp Business Account ID.
- Show assignment, status, next follow-up, notes, booking, lost reason, and timeline areas.
- Keep quick replies, AI suggestions, brand knowledge, intent/tagging, and next best action as future placeholders.

Current non-goals:

- No WhatsApp inbox.
- No AI reply generation.
- No WhatsApp API send actions.
- No mutation of the original LaunchHub lead/source/payment/legal consent records.
- No brand-specific hardcoding.

The CRM domain model is intended to be portable into a future brand-neutral GrowthOS CRM app. Proposed future tables are documented in `docs/CRM_SCHEMA_PROPOSAL.md`; this is a proposal only and no live migration has been applied.

## LeadOps CRM Phase 2B Safe Write Layer

CRM Phase 2B adds a safe CS operation write layer while keeping LaunchHub lead capture untouched.

Runtime behavior:

- `CRM_WRITE_ENABLED` is a server-side feature flag.
- If `CRM_WRITE_ENABLED` is not `true`, CRM write controls stay disabled and `/crm` continues to work from existing LaunchHub leads.
- If the CRM tables are missing, CRM write controls stay disabled even when the flag is set.
- If the CRM tables exist and `CRM_WRITE_ENABLED=true`, `/crm/leads/[leadId]` enables CS operation forms.
- The disabled admin message is: `CRM write actions are not enabled yet.`
- `/crm` overlays assignment, status, and next follow-up values from `crm_lead_cases` when records exist.
- `/crm/leads/[leadId]` can bootstrap a CRM case from a LaunchHub lead without modifying the original lead.
- `/crm/settings` shows the WhatsApp Channel Settings architecture without connecting to Meta / WhatsApp APIs.
- Raw WhatsApp access tokens must not be stored or displayed in the UI.

CS write actions:

- Assign CS: updates `crm_lead_cases.assigned_to` and writes `crm_interactions`.
- Update status: updates `crm_lead_cases.status`, writes `crm_status_history`, and writes `crm_interactions`.
- Add note: writes `crm_interactions`.
- Booking: creates or updates `crm_bookings`, links `crm_lead_cases.booking_id` where possible, and writes `crm_interactions`.
- Follow-up task: creates `crm_follow_up_tasks`, updates `crm_lead_cases.next_follow_up_at`, and writes `crm_interactions`.
- Lost reason: updates `crm_lead_cases.lost_reason`, sets status to `lost`, writes `crm_status_history`, and writes `crm_interactions`.
- CRM Phase 1 uses the DB-compatible statuses `new`, `contacting`, `booked`, `showed`, `no_show`, `lost`, and `invalid`.
- Add Note can capture channel, direction, outcome, and next follow-up time. When next follow-up time is set, it also creates a follow-up task.
- Booking can track booked/showed/no-show/cancelled outcomes and stores paid/unpaid display state in `crm_bookings.metadata_json`.
- CRM Phase 1.5 keeps customer-selected form date/time as appointment preference only. CS confirmation writes the confirmed date/time to `crm_bookings.booking_date` / `booking_time`, stores room arrangement, booking note, and paid status in `crm_bookings.metadata_json`, and then moves the CRM case to `booked`.
- CRM Phase 1.6 adds CS follow-up workflow: contact attempts write `crm_interactions`, optional next follow-up time updates `crm_lead_cases.next_follow_up_at` and creates `crm_follow_up_tasks`, lost/invalid actions require a reason, and `/crm` can filter today / overdue follow-up queues.
- Contact attempt metadata is stored in `crm_interactions.metadata_json` with channel, outcome, note, and next follow-up values. Lost / invalid reasons are stored in existing case metadata and timeline records. No schema change is required for Phase 1.6.
- CRM Phase 1.7 turns `/crm` into a CS Command Center with daily summary cards, clearer queue filters, priority ordering, today confirmed bookings, and pending show-outcome queues. It reads existing `crm_lead_cases`, `crm_bookings`, and follow-up fields only; no schema change is required.
- CRM Phase 1.8 adds a CRM conversion overview on `/crm`: total/new/contacting/booked/showed/no-show/lost/invalid counts, contact/booking/show/lost rates, and brand + treatment breakdowns using existing CRM case statuses only.
- CRM Phase 1.9 adds source quality and campaign outcome reporting on `/crm`: source groups, campaign rows, direct/no-tracking visibility, and lead/contact/book/show/no-show/lost/invalid rates using existing lead attribution and CRM status data only.
- CRM Phase 2.0 adds an internal outcome feedback preview layer on `/crm` for future booked/showed/no-show/lost/invalid feedback. It shows tracking quality and Meta identifier availability for audit only; no external events are sent.
- CRM Phase 2.1 adds outcome readiness audit labels and summary cards for future Meta/offline feedback review. It is still preview-only and does not send events.
- CRM Phase 2.2 is a reviewed SQL proposal for a future durable outcome event queue. It plans event deduplication, CRM/lead/brand references, payload preview, hashed user-data readiness, tracking snapshots, send lifecycle, retry/error fields, and external response audit. No schema has been applied and no Meta events are being sent.
- CRM Phase 2.3 adds tracking capture audit visibility on `/crm?tab=reports` and documents current source snapshot coverage versus future Meta matching needs. It is audit-only and does not change live capture behavior.
- CRM Phase 2.4 is a capture improvement plan for future `fbp` / `fbc` / source snapshot readiness. It is planning-only: no live tracking behavior changed, no schema has been applied, and no Meta events are being sent.
- CRM Phase 2.5 safely preserves optional `fbp`, `fbc`, parent URL, page URL, form context, and client event ID values inside existing attribution touch JSON. No schema has been applied, no Meta events are sent, and public tracking / Google Sheets / thank-you behavior is preserved.
- CRM Phase 2.6 simplifies the CS booking console and starts the app settings foundation. CS inbox screens hide marketing attribution details; tracking/reporting remains in `/crm?tab=reports`. Settings planning is documented only, with no schema applied.
- CRM Phase 2.7 adds a config-first CRM settings layer in code via `src/lib/crm/settingsConfig.ts` and a read-only admin view in `/crm/settings`. Quick replies and AI reply drafts remain manual/template-based; no WhatsApp API, external AI API, Meta sending, or schema migration is active.
- CRM Phase 2.8 improves the lead detail reply workflow with grouped CS templates, copy buttons, context suggestions, and manual WhatsApp open links. Messages are still copied and sent by CS manually; no WhatsApp API, external AI API, or auto-send behavior is connected.
- CRM Phase 2.9 polishes the lead detail page into a booking-first CS operation card: customer, treatment, preferred time, confirmed booking, manual WhatsApp/contact actions, reply templates, and timeline are prioritized while marketing/tracking details stay at the bottom. No API sending behavior is connected.
- CRM Phase 3.0 plans the editable app settings layer and improves `/crm/settings` as an admin preview. No schema has been applied, no live settings mutation is enabled, and `src/lib/crm/settingsConfig.ts` still powers CRM defaults and fallback behavior.
- CRM Phase 3.1 reviews and strengthens the editable settings SQL proposal with global defaults, brand overrides, inbox column presets, partial unique indexes, RLS/admin mutation boundaries, audit structure, and an apply checklist. No schema has been applied and no live settings mutation is enabled.
- CRM Phase 3.2B adds a safe CRM settings loader fallback. `/crm/settings` can report whether active settings come from code defaults, a future DB override, or DB-unavailable fallback. The DB config table remains optional, no schema has been applied, no settings are mutated, and code defaults remain the safety net.
- CRM Phase 3.3 starts consuming settings through the fallback loader in CRM lead detail, inbox preset labels, and safe server-action option validation. DB config remains optional, code defaults are still merged as the safety net, no schema has been applied, and no live settings mutation is enabled.
- CRM Settings Control Center turns `/crm/settings` into a read-only admin UX for future brand, treatment, WhatsApp, AI reply, booking, inbox, team, and developer settings. It prepares future editable settings while keeping DB mutation, WhatsApp API connection, external AI API, Meta sending, and auto-send behavior disabled.
- CRM Phase 3.4 adds Settings Editor Mock UX: `/crm/settings` now presents disabled form fields, mock toggles, and coming-soon save controls for brand, treatment, WhatsApp, AI reply, booking, inbox, and team settings. No DB save, schema apply, WhatsApp API, AI API, Meta sending, or auto-send behavior is active.
- CRM Phase 3.5 polishes the Settings UX copy so admin users can clearly see active code defaults, mock-only fields, disabled saves, future DB editing, manual-only WhatsApp, and template-only AI replies. No DB mutation, WhatsApp API, external AI API, Meta sending, or auto-send behavior is connected.
- CRM Phase 3.6 finalizes the `/crm/settings` information architecture with clearer Brand Profile, Treatment Menu, WhatsApp, AI Reply, Booking Workflow, Inbox Preset, Team Access, and Developer Notes grouping plus a recommended setup order. No DB mutation, schema apply, WhatsApp API, external AI API, Meta sending, or auto-send behavior is connected.
- CRM Phase 3.7A prepared the final apply-ready editable settings migration at `docs/CRM_PHASE_3_7_APPLY_EDITABLE_SETTINGS.sql`; the schema has since been applied manually. `crm_app_settings` enables future editable CRM settings, while code defaults remain the fallback.
- CRM Phase 3.8 prepared a non-destructive default settings seed at `docs/CRM_PHASE_3_8_SEED_DEFAULT_SETTINGS.sql`; default settings have since been seeded manually. The seed uses `on conflict do nothing`, and code defaults remain the fallback while DB-backed settings are tested.
- CRM Phase 3.9 verifies DB settings consumption after the manual schema apply and default seed. `/crm/settings` now reports DB default settings when rows are loaded, keeps the settings editor read-only, and preserves code defaults as fallback; no live settings mutation is enabled.
- CRM IA reset keeps a product-style sidebar with Dashboard / 首頁, Inbox / 工作台, Bookings / 預約, Team, Reports / 報表, Settings, More, and online status. CS working screens remain booking-first, while technical tracking audit, source-quality detail, campaign detail, Meta readiness, and identifier coverage stay hidden under the collapsed Technical Audit section in reports. No backend tracking logic was removed.
- CRM sidebar uses `Dashboard / 首頁` as the CRM home overview at `/crm?tab=dashboard`; the duplicate unused Home item was removed. `Inbox / 工作台` remains the CS working queue at `/crm?tab=leads`, and `Bookings / 預約` remains `/crm?tab=bookings`.
- CRM Inbox now uses a support-inbox style layout with compact tabs, filters, checkbox selection, customer avatar, manual WhatsApp open, and column presets. The default `CS Booking View` stays booking-first; `Marketing View` and `Technical Audit View` can expose source, campaign, CTWA, and tracking-adjacent fields when needed. Future persisted column preferences should move into App Settings. WhatsApp remains manual open only.
- CRM Inbox and Bookings views were refined toward a light SaaS support-inbox pattern: the sidebar is lighter and more compact, CS workflow summary cards are reduced to small count chips, duplicated inner primary tabs were removed, and advanced/source fields remain optional through column presets rather than forced into the default CS view.
- Show / no-show actions are guarded: the case must already be `booked`, and the confirmed appointment time must have passed.

CRM Phase 2 schema files:

- `docs/CRM_PHASE2_SCHEMA.sql` is the broader planning proposal.
- `docs/CRM_PHASE2_APPLY.sql` is the Phase 2B review/apply script for the six CS operation tables only.
- `docs/CRM_PHASE1_APPLY.sql` is the Phase 1 status-constraint review script for the CS pipeline statuses.
- `docs/CRM_PHASE_2_2_OUTCOME_EVENT_QUEUE_PLAN.sql` is a review-only future event queue proposal wrapped in `begin` / `rollback`; it has not been executed.
- `docs/CRM_PHASE_2_3_TRACKING_CAPTURE_AUDIT.md` documents current tracking capture coverage and future `fbp` / `fbc` / parent URL recommendations.
- `docs/CRM_PHASE_2_4_TRACKING_CAPTURE_IMPROVEMENT_PLAN.md` documents the future tracking capture improvement plan.
- `docs/CRM_PHASE_2_4_TRACKING_CAPTURE_FIELDS_PLAN.sql` is a review-only future source snapshot field proposal wrapped in `begin` / `rollback`; it has not been executed.
- `docs/CRM_PHASE_2_6_APP_SETTINGS_PLAN.md` documents the future CRM app settings foundation; it is planning-only and no schema has been applied.
- `docs/CRM_PHASE_2_7_APP_SETTINGS_CONFIG_PLAN.sql` is a review-only future CRM app settings table proposal wrapped in `begin` / `rollback`; it has not been executed.
- `docs/CRM_PHASE_3_0_EDITABLE_SETTINGS_ARCHITECTURE.md` documents the future editable settings flow, fallback strategy, brand overrides, and safety rules.
- `docs/CRM_PHASE_3_0_EDITABLE_SETTINGS_PLAN.sql` is a review-only editable settings proposal wrapped in `begin` / `rollback`; it has not been executed.
- `docs/CRM_PHASE_3_7_APPLY_EDITABLE_SETTINGS.sql` is the final CRM editable settings migration. It has been applied manually.
- `docs/CRM_PHASE_3_8_SEED_DEFAULT_SETTINGS.sql` is the non-destructive CRM settings default seed. It has been applied manually.

`docs/CRM_PHASE2_APPLY.sql` has not been executed against the live database by this code change. It uses `create table if not exists`, non-destructive indexes, and comments. It does not alter existing LaunchHub tables.

Activation steps:

1. Review `docs/CRM_PHASE2_APPLY.sql`.
2. Apply it manually in Supabase after approval.
3. Set `CRM_WRITE_ENABLED=true`.
4. Confirm `/crm` and `/crm/leads/[leadId]` show enabled CS actions.

Safety boundaries:

- Public landing pages, public embed forms, public lead APIs, UTM/source capture, payment semantics, legal consent validation, and Google Sheets sync are unchanged.
- The original LaunchHub lead record is not modified by CRM bootstrapping.
- CRM bootstrapping defaults normal landing form / registration leads to `new` / 待跟進. It must not treat `booking_only` payment status or customer-selected appointment date/time as `booked`; `booked` should come only from an explicit CS booking action or a reliable booked/rescheduled source state.
- WhatsApp quick replies, brand knowledge editing, and WhatsApp API sends remain future work.

GrowthOS portability:

- Current LaunchHub identity is `brand_slug + normalized_phone`.
- Future GrowthOS identity should be `tenant_id + brand_id + normalized_phone`.
- CRM source intake should remain omnichannel: landing forms, WhatsApp API messages, CTWA ad leads, WhatsApp direct messages, manual leads, and imports.
- No CRM table should depend on the Alyssa/Ineffable workspace name.

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

LaunchHub supports two output modes that share the same lead capture, UTM, source snapshot, booking, and event model.

### Form-only mode

- The user configures brand, treatment, package, branch, and form token.
- The system generates an embed script.
- The embed script is inserted into Wix pages.
- Wix remains the main website and brand website.
- Campaign Launch OS handles form capture, UTM capture, source snapshots, lead attribution, bookings, and lead events.

### Landing page mode

- The same form config can be wrapped in a simple campaign landing page when a campaign needs hero copy, offer sections, treatment content, CTA copy, FAQ, testimonials, or visual assets.
- Landing pages are for fast market testing and campaign experiments.
- Landing page mode is not a full Wix replacement.
- It remains a campaign testing layer backed by the same lead attribution model.
- The current implementation uses local seed config for `landing_pages`; a future builder can persist fields such as `hero_title`, `hero_subtitle`, `hero_image_url`, `offer_badge`, `cta_text`, and `sections_json`.

Future CRM write operations remain separate. The current `/crm` area is a read-only operational foundation; the future CRM app should read and write outcomes against the shared lead base instead of creating a separate data island.

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

The current app exposes settings pages for:

- Brand settings.
- Treatment settings.
- Package / price settings.
- Branch settings.
- Landing Page Templates.

Form-only mode uses this configuration layer to select a brand, treatment, package, and branch, then generate the Wix embed script.

Landing page mode uses the same form/source/lead base and adds template, hero copy, offer copy, sections, FAQ, CTA, and visual content for simple campaign testing pages.

## Settings Editor V1

Settings control the options available when creating Campaigns, Wix registration forms, and Landing Pages.

- Brands, treatments, packages, and branches can be added and edited from `/settings`.
- Unused brands, treatments, packages, and branches can be deleted.
- Delete is blocked when a record is already used by forms, landing pages, leads, bookings, or dependent settings.
- There is no archive / inactive / re-enable workflow in V1.
- Lead price still comes from the server-side package configuration selected by `package_id`; public form submissions must not trust client-submitted prices.

Current implementation notes:

- `brands`, `treatments`, `packages`, `branches`, and `forms` are read from existing Supabase tables when configured, with local config as a fallback for development.
- Landing page templates and landing page config remain local config for now.
- Full admin editing for forms, templates, and landing page content remains future work.
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

Wix remains the main website. Campaign Launch OS landing pages are for fast offer, angle, treatment, and audience testing while preserving the same lead capture and attribution flow.

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
- Publish: submits the current editor form state, checks required brand / treatment / package / branch / form / public copy fields, creates a new published version, updates `landing_pages.status = 'published'`, sets `published_version_id`, and updates `published_at`.
- Public render: `/lp/[slug]` renders the `published_version_id` version only for Supabase landing pages. It does not render draft versions as public campaign content.
- Internal editor: `/landing-pages/[pageId]` shows Save Draft / Publish controls only as DB-backed actions when the migration is applied; otherwise it clearly stays in local config fallback mode.

Apply the migration in Supabase SQL editor or through your migration workflow before expecting Save Draft / Publish to persist. The current editor still uses read-only prefilled fields; full field editing, media upload, version history UI, draft preview URLs, and any future team-based publish permissions remain future builder work.

## Multi-form Management

LaunchHub supports multiple reusable registration forms per brand.

- Forms share one unified visual style in `/embed/[formToken]`.
- Each form has its own `public_form_token` and Wix embed code.
- A form can be embedded directly in Wix or connected to a Landing Page campaign.
- Forms differ by business configuration: brand, treatment, package, selectable branches, allowed domains, and status.
- Creating or duplicating a form generates a new safe token from the selected brand slug, for example `ineffable-beauty-388-form-[shortid]` or `alyssa-main-form-[shortid]`.
- Duplicate form copies configuration only, creates a new form token, and does not copy leads or submissions.
- Multi-branch forms show the selected branches on the public form. The visitor chooses one branch, and that selected branch is saved on the lead, booking, CS Sheet row, and CRM-facing records.
- Unused forms can simply be left unused for now.
- Archive, delete, and re-enable workflows are not part of V1.
- Existing leads remain unchanged when form settings are edited.

This keeps form management flexible without creating per-form style systems or a visual form builder.

## Enquiry Records And Test Data

`/leads` is positioned as an enquiry / registration record page. It shows submitted form enquiries, brand, treatment, selected branch, appointment preference, source, campaign/content, and page URL. Confirmed booking, show, paid, no-show, and lost outcomes belong to CRM / CS follow-up and should not be inferred from a LaunchHub form submission.

LaunchHub hides obvious internal test submissions from `/leads`, `/dashboard`, `/performance`, and brand overview reporting by default. The Leads page includes a `顯示內部測試資料` toggle for review. Raw records remain in Supabase unless an operator manually reviews and runs a cleanup script.

Test-data review scripts:

- `docs/REVIEW_TEST_LEADS.sql` - read-only review of obvious internal test submissions.
- `docs/CLEAN_TEST_LEADS_DELETE.sql` - destructive cleanup template, fully commented out and intended only after manual review/export.

## Create Campaign Flow

`/campaigns/new` gives marketers one guided entry point for starting a campaign.

- New ad Landing Page - creates a new form, then creates a draft Landing Page connected to that new form.
- Wix registration form only - creates a new reusable form for Wix embed and redirects to the form detail page.
- Existing form Landing Page - reuses a selected existing form, then creates a new draft Landing Page connected to that form.
- All options use the same lead capture, source tracking, package price, and booking base.
- Landing Page editor can change the connected form later; existing leads are not changed.
- Publishing remains a separate step in the Landing Page editor and publishes the current editor content.

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

LaunchHub is designed for non-technical marketing, management, CS, and operations users. Business screens should explain what the page is for, what the user should do first, which actions are safe internal actions, and which actions affect public campaign pages.

Core guided workflows:

- Form-only mode - Wix owns the page content; Campaign Launch OS provides the embedded form and attribution capture.
- Landing page mode - marketers prepare campaign content, save internal drafts, preview, then publish a public campaign page.
- Lead monitoring - CS and operations review latest registration records and booking requests.
- Performance reporting - management and marketing compare leads, bookings, source, campaign, treatment, package, and branch performance.
- Future CRM feedback - the future WhatsApp CRM writes outcomes back into the shared lead base.

Technical audit details such as low-level tracking fields, system health, source snapshot diagnostics, and webhook debugging should stay in `/system-audit`, not on the main business screens.

## Design System Direction

LaunchHub uses a custom premium medical beauty / wellness visual system rather than a generic SaaS blue theme.

Current V1 design tokens define:

- Warm ivory and blush page backgrounds.
- Soft rose and mauve accents.
- Champagne borders and highlights.
- Coral CTA treatment.
- Deep plum text.
- Premium card surfaces, rounded radii, focus states, and soft shadows.

Shared UI primitives live in `src/components/alyssa/ui.tsx` for reusable cards, stats, badges, empty states, CTA buttons, section headers, and page shells. Motion primitives live in `src/components/alyssa/MotionReveal.tsx`.

Motion is provided by `motion/react` and is used sparingly for subtle section reveal, KPI card reveal, CTA hover/tap, landing page hero reveal, and editor/list card polish. Reduced-motion preferences are respected through `useReducedMotion()` and the global `prefers-reduced-motion` CSS guard.

If the internal app grows into a larger admin surface, shadcn/ui-style primitives are the preferred next component-system step. Open Props-style token thinking may inspire future refinements, but LaunchHub tokens remain custom to the campaign-testing product.

## Ineffable Beauty Public Theme

LaunchHub admin and internal business pages remain neutral system screens. Public campaign surfaces can use a selected brand theme without recoloring the backend.

Ineffable Beauty public Landing Pages and public embedded forms use a warm cream / terracotta / coffee palette: cream background, soft beige borders, deep coffee text, and terracotta CTA buttons. Customer-facing copy should use the selected brand name, while the legal/operator footer uses YISSA GROUP LIMITED where an operator entity is shown.

Current implementation uses a safe code fallback theme resolver for `ineffable`, `ineffable-beauty`, and `Ineffable Beauty`. Future brand settings can add database-backed theme fields for palette, CTA tone, background, and public typography.

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
- `/crm` - LeadOps CRM inbox using phone-first brand/customer identity.
- `/crm/leads/[leadId]` - CRM case detail with contact, source, CTWA, notes, status, booking outcome, and follow-up controls when CRM writes are enabled.
- `/crm/settings` - WhatsApp Channel Settings architecture; no API connection or raw token display.
- `/performance` - Brand, source/campaign, treatment/package, and branch performance analysis.
- `/forms` - Form connection layer showing selected brand, treatment, package, branch, allowed domains, embed code, and landing page relationship.
- `/forms/[formId]` - Form-level configuration detail for form-only embed and landing page mode reuse.
- `/landing-pages` - Landing page management foundation covering form-only and campaign landing-page modes.
- `/landing-pages/[pageId]` - Structured Landing Page Content Editor V1 with read-only/save-ready fields and preview panel.
- `/lp/[slug]` - Public campaign landing page preview using the existing lead capture form path.
- `/settings` - Settings overview for campaign configuration.
- `/settings/brands` - Brand settings editor.
- `/settings/treatments` - Treatment settings editor.
- `/settings/packages` - Package / price settings editor.
- `/settings/branches` - Branch settings editor.
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

LaunchHub separates public campaign/form routes from internal business and configuration routes.

Public routes remain accessible for campaigns, Wix embeds, and lead capture:

- `/lp/[slug]`
- `/embed/[formToken]`
- `/legal/[brandSlug]/[documentType]`
- `/thank-you`
- `/api/public/forms/[token]`
- `/api/public/leads`
- `/api/public/events`
- `/api/public/thank-you`

Internal admin routes are protected by a simple shared LaunchHub admin password:

- `/`
- `/dashboard`
- `/leads`
- `/crm`
- `/crm/leads/[leadId]`
- `/crm/settings`
- `/performance`
- `/campaigns`
- `/campaigns/new`
- `/create-campaign`
- `/forms`
- `/forms/new`
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
- `/debug/session`

LaunchHub uses one shared admin password for the current admin backend. There is no username, no roles, no owner/editor/lead_viewer blocking, and no domain-wide cookie. Successful password entry sets a host-only `httpOnly` signed cookie for the current admin host with `sameSite=lax`, `path=/`, secure cookies in production, and an expiry of about 12 hours. `/logout` clears the cookie and redirects to `/login`.

Public landing pages, embedded forms, legal pages, public lead submit APIs, static assets, and the public embed script remain reachable without login.

`app.beautytrialhk.com` should be used for the admin backend. `go.beautytrialhk.com` should be used for public landing pages, embedded forms, and legal pages. The proxy keeps this host separation and only redirects admin paths from the public host back to the admin host.

Required Vercel env vars for the simple admin gate:

- `LAUNCHHUB_ADMIN_PASSWORD`
- `LAUNCHHUB_ADMIN_SESSION_SECRET`

Legacy env vars from the removed internal auth flow are deprecated and not required for deployment:

- `INTERNAL_ACCESS_USERS`
- `INTERNAL_AUTH_SESSION_SECRET`
- `INTERNAL_AUTH_COOKIE_DOMAIN`
- `INTERNAL_AUTH_DISABLED`
- `INTERNAL_BASIC_AUTH_USER`
- `INTERNAL_BASIC_AUTH_PASSWORD`

Do not commit real credentials. If team login is needed later, add a new Supabase Auth, Google Login, or role-based admin login flow deliberately instead of extending this shared password gate.

## Team Access Direction

The current admin backend uses a simple shared password gate only. The previous Basic Auth / custom role session gate has been removed from the active route path because it caused production navigation failures.

The intended long-term layer is Supabase Auth plus role-based access control. Each team member should have their own login, a profile, a role, a status, and optional brand access.

Team Access Enforcement V1 remains a planning and helper foundation only. Current admin pages do not enforce roles or brand permissions:

- no `owner` / `editor` / `lead_viewer` route blocking
- no per-brand filtering based on a logged-in user
- no user management, invitations, or password reset

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

The future CRM app should reuse this access model where possible, especially `profiles`, roles, status, and brand access. This keeps Campaign Launch OS and CRM from creating separate user islands.

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

## Wix Iframe Embed And Meta CompleteRegistration

Recommended Wix setup:

- Wix installs Meta Pixel and owns `PageView`.
- Wix creates the LaunchHub iframe and appends the Wix page UTM/click IDs into the iframe URL.
- LaunchHub saves the lead first.
- After successful save, the LaunchHub embed script fires a direct Meta `CompleteRegistration` image beacon when `data-pixel-id` is configured.
- Keep the Alyssa Pixel base code in Wix Head for `PageView`.
- Disable/remove any separate Wix `CompleteRegistration` listener when using `data-pixel-id`, otherwise the conversion may fire twice.

Use this structure on the Wix page when manually creating the iframe:

```html
<div id="launchhub-form"></div>

<script>
(function () {
  const launchhubBaseUrl = "https://go.beautytrialhk.com/embed/YOUR_FORM_TOKEN_OR_PATH";
  const params = new URLSearchParams(window.location.search);

  params.set("parent_url", window.location.href);
  params.set("parent_origin", window.location.origin);

  const iframe = document.createElement("iframe");
  iframe.src = launchhubBaseUrl + "?" + params.toString();
  iframe.width = "100%";
  iframe.height = "760";
  iframe.style.border = "0";
  iframe.loading = "lazy";
  iframe.title = "Registration Form";

  document.getElementById("launchhub-form").appendChild(iframe);

  window.addEventListener("message", function (event) {
    const isAllowedOrigin =
      event.origin === "https://go.beautytrialhk.com" ||
      event.origin.endsWith(".filesusr.com");

    if (!isAllowedOrigin) return;

    if (
      event.data &&
      event.data.type === "launchhub:form-submitted" &&
      event.data.event === "CompleteRegistration" &&
      event.data.formToken === "YOUR_FORM_TOKEN_OR_PATH" &&
      event.data.brandSlug === "alyssa"
    ) {
      if (typeof fbq === "function") {
        fbq("track", "CompleteRegistration", {
          value: event.data.value || 0,
          currency: event.data.currency || "HKD",
          content_category: "registration"
        });
      }
    }
  });
})();
</script>
```

Preserved iframe query/source parameters include `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `fbclid`, `gclid`, `ttclid`, `msclkid`, `wbraid`, `gbraid`, `campaign_id`, `adset_id`, `ad_id`, `placement`, `lh_source`, `lh_medium`, `lh_campaign`, `lh_content`, `lh_term`, `lh_campaign_id`, `lh_adset_id`, `lh_ad_id`, `lh_placement`, `ctwa_id`, `ctwa_clid`, `meta_campaign_id`, `meta_adset_id`, `meta_ad_id`, `parent_url`, and `parent_origin`.

For normal Wix deployment, use the LaunchHub embed script. It reads the Wix page URL query string, passes standard UTM and `lh_*` backup tracking into the iframe, and sends a parent-page `CompleteRegistration` message only after LaunchHub confirms the lead was saved. When Wix runs the embed inside a `filesusr.com` HTML component iframe, the script recovers the real Wix page URL from `document.referrer`, uses that URL for `parent_url` / `parent_origin`, passes the real page tracking params into the LaunchHub iframe, and relays the safe `launchhub:form-submitted` message upward. The script requires `data-form-token`; it does not silently fall back to the Alyssa demo token.

For Wix HTML component embeds in `form_submit_pixel` mode, add `data-pixel-id` so the embed script itself can send the save-confirmed `CompleteRegistration` beacon without depending on a top-level Wix custom-code listener. Optional overrides are `data-pixel-event-value` and `data-pixel-currency`; defaults are `388` and `HKD`.

LaunchHub supports two conversion modes for embedded forms:

- `form_submit_pixel`: default mode. The LaunchHub form saves the lead first, then sends the `CompleteRegistration` event from the embed/script path when a Pixel ID is configured.
- `thank_you_redirect`: thank-you mode. The LaunchHub form saves the lead first, does not fire `CompleteRegistration` inside the iframe/embed, and redirects the top-level browser to the configured Wix thank-you page. The Wix thank-you page should own the Meta `CompleteRegistration` event.

For Ineffable thank-you redirect mode, use HTTPS and the approved thank-you path only:

```html
<div id="launchhub-ineffable-form-form-4f4a18"></div>

<script
  src="https://go.beautytrialhk.com/embed/alyssa-form.js?v=20260626-no-default-form-flash"
  data-form-token="ineffable-beauty-388-3-form-4f4a18"
  data-brand="ineffable"
  data-form-id="19df814b-a47e-4c56-878d-d58198ada82c"
  data-pixel-event-value="388"
  data-pixel-currency="HKD"
  data-conversion-mode="thank_you_redirect"
  data-success-redirect-url="https://www.ineffablebeautyhk.com/thank-you?submitted=1&amp;treatment=gentle-pore-care&amp;value=388"
  data-lazy-load="true"
  data-lazy-root-margin="600px"
  data-target="#launchhub-ineffable-form-form-4f4a18">
</script>
```

Do not add `data-pixel-id` to a `thank_you_redirect` snippet. The redirect URL is validated before use and must be `https://www.ineffablebeautyhk.com/thank-you` or `https://ineffablebeautyhk.com/thank-you`. LaunchHub appends safe tracking/query data to the thank-you URL after a successful save, including `submitted=1`, `form_id`, `lead_id`, `event_id`, UTM/click IDs, campaign/ad IDs, placement, and `lh_*` backup params. `event_id` matches `lead_id` for Wix/Meta deduplication.

Wix HTML Embed elements can still reserve the manual box height and visible width set in Wix Editor. LaunchHub now starts embedded iframes with a compact fallback height, resizes the internal iframe to the measured form content, and constrains the embedded form to the available mobile width. The public form also uses a compact mobile layout with lighter framing and fewer decorative rows inside narrow embeds. The outer Wix HTML component should still be set close to the form content width/height and should not sit inside an oversized or narrow clipped Wix box. For Wix pages where the form is not visible in the first screen, use `data-lazy-load="true"` so the iframe loads only when the user scrolls near the form. If the form is immediately above the fold, lazy loading can be disabled by omitting that attribute.

For mobile Wix performance, keep treatment-page sections practical: avoid stacking multiple large decorative cards before the form, hide non-essential decorative images on mobile, lazy-load below-the-fold images, and keep the Wix HTML Embed wrapper full-width without a narrow fixed mobile box. The LaunchHub embed script version `20260626-no-default-form-flash` is the recommended version for the flat mobile form UI, lighter pre-resize iframe height, and neutral loading state before the requested form config is resolved. `/embed/alyssa-form.js` is served with `Cache-Control: no-store, max-age=0`, so routine embedded-form UI fixes should deploy centrally without changing Wix snippets; keep the query string only as an emergency cache-buster if a browser or Wix layer has already cached an older URL.

Ineffable generated embed examples:

```html
<div class="ib-launchhub-form-card">
  <div id="launchhub-ineffable-form-form-4f4a18"></div>

  <script
    src="https://go.beautytrialhk.com/embed/alyssa-form.js?v=20260626-no-default-form-flash"
    data-form-token="ineffable-beauty-388-3-form-4f4a18"
    data-brand="ineffable"
    data-form-id="19df814b-a47e-4c56-878d-d58198ada82c"
    data-pixel-event-value="388"
    data-pixel-currency="HKD"
    data-conversion-mode="thank_you_redirect"
    data-success-redirect-url="https://www.ineffablebeautyhk.com/thank-you?submitted=1&amp;treatment=gentle-pore-care&amp;value=388"
    data-lazy-load="true"
    data-lazy-root-margin="600px"
    data-target="#launchhub-ineffable-form-form-4f4a18">
  </script>

</div>
```

```html
<div class="ib-launchhub-form-card">
  <div id="launchhub-ineffable-form-form-f50cfb"></div>

  <script
    src="https://go.beautytrialhk.com/embed/alyssa-form.js?v=20260626-no-default-form-flash"
    data-form-token="ineffable-588-dep-combo-form-f50cfb"
    data-brand="ineffable"
    data-form-id="22bc6034-6d2b-4e55-8da6-a29be086756b"
    data-pixel-event-value="588"
    data-pixel-currency="HKD"
    data-conversion-mode="thank_you_redirect"
    data-success-redirect-url="https://www.ineffablebeautyhk.com/thank-you?submitted=1&amp;treatment=dep-hydration-combo&amp;value=588"
    data-lazy-load="true"
    data-lazy-root-margin="600px"
    data-target="#launchhub-ineffable-form-form-f50cfb">
  </script>

</div>
```

The Wix top-page listener may receive the conversion message directly from `https://go.beautytrialhk.com` or relayed through a Wix `.filesusr.com` HTML iframe. Always verify `data.type`, `data.event`, the exact `data.formToken`, and `data.brandSlug` before firing Meta Pixel so random iframe messages cannot trigger `CompleteRegistration`.

Brand examples:

```html
<!-- Ineffable Beauty Wix page -->
<div id="ineffable-launchhub-form"></div>
<script
  src="https://go.beautytrialhk.com/embed/alyssa-form.js"
  data-form-token="INEFFABLE_FORM_TOKEN_FROM_LAUNCHHUB"
  data-brand="ineffable"
  data-form-id="INEFFABLE_FORM_ID_OPTIONAL"
  data-target-id="ineffable-launchhub-form"
  async
></script>
```

```html
<!-- Alyssa Wix page -->
<div id="alyssa-launchhub-form"></div>
<script
  src="https://go.beautytrialhk.com/embed/alyssa-form.js"
  data-form-token="ALYSSA_FORM_TOKEN_FROM_LAUNCHHUB"
  data-brand="alyssa"
  data-form-id="ALYSSA_FORM_ID_OPTIONAL"
  data-pixel-id="1076420440840443"
  data-pixel-event-value="388"
  data-pixel-currency="HKD"
  data-target-id="alyssa-launchhub-form"
  async
></script>
```

Each brand must use its own form token. Ineffable Beauty should use an Ineffable form token, and Alyssa should use an Alyssa form token. The token resolves the backend form, brand, treatment, package, branch, and allowed domains, so the same public embed script can be reused without mixing brands.

Do not use the Ineffable Pixel for Alyssa. Configure Pixels separately:

```bash
NEXT_PUBLIC_META_PIXEL_ID_INEFFABLE=1020143980486592
NEXT_PUBLIC_META_PIXEL_ID_ALYSSA=
```

If `NEXT_PUBLIC_META_PIXEL_ID_ALYSSA` is blank, Alyssa public pages/forms skip Pixel instead of firing to Ineffable. Wix parent pages may still run their own brand Pixel and listen for the post-submit message.

Final recommended Meta URL Parameters for ads:

```text
utm_source=meta&utm_medium=paid_social&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&utm_term={{adset.name}}&campaign_id={{campaign.id}}&adset_id={{adset.id}}&ad_id={{ad.id}}&placement={{placement}}&lh_source=meta&lh_medium=paid_social&lh_campaign={{campaign.name}}&lh_content={{ad.name}}&lh_term={{adset.name}}&lh_campaign_id={{campaign.id}}&lh_adset_id={{adset.id}}&lh_ad_id={{ad.id}}&lh_placement={{placement}}
```

Use clean public URLs in live ads, for example:

```text
https://go.beautytrialhk.com/lp/ineffable-388-13e933
```

Do not include debug parameters in real ads: `pixel_debug=1` and `attribution_debug=1` are for testing only.

Allowed origins for the LaunchHub form should include the Wix campaign hosts and the public LaunchHub host, for example:

```text
https://ineffablebeautyhk.com
https://www.ineffablebeautyhk.com
https://go.beautytrialhk.com
```

Do not use `app.beautytrialhk.com` for public embeds. Meta Events Manager is used for Pixel/Dataset setup and Test Events, not per-form button-click setup. `CompleteRegistration` is triggered only after LaunchHub confirms the lead was saved.

Launch behavior is save-first, filter-later:

- Real-looking public submissions are not rejected because UTM/cookie/Pixel tracking is missing.
- Pixel failure does not block form submission.
- Google Sheets sync failure does not block form submission.
- Bot, test, spam, duplicate review, and lead quality filtering should happen later from saved registration/source data in LaunchHub, Google Sheets, or CRM.
- Required field, phone/email format, consent, honeypot, duplicate/rate-limit, allowed-domain, and form-token checks remain active for basic safety.

In production, set:

```bash
NEXT_PUBLIC_APP_URL=https://your-production-domain.com
NEXT_PUBLIC_PUBLIC_BASE_URL=
NEXT_PUBLIC_ADMIN_BASE_URL=
```

If only `NEXT_PUBLIC_APP_URL` is set, the app uses it for both admin and public URLs. If `NEXT_PUBLIC_PUBLIC_BASE_URL` or `NEXT_PUBLIC_ADMIN_BASE_URL` is set, public Landing Page / embed links and internal admin links can be separated later without hard-coding a final domain. This prepares a future split such as admin on one domain and public campaign pages on another.

For the Beauty Trial HK domain split, internal admin pages should use the admin host and public campaign pages should use the public host:

```bash
NEXT_PUBLIC_ADMIN_BASE_URL=https://app.beautytrialhk.com
NEXT_PUBLIC_PUBLIC_BASE_URL=https://go.beautytrialhk.com
```

Internal navigation uses relative admin paths such as `/dashboard`, `/landing-pages`, `/forms`, and `/settings`. If `/login` or another internal admin route is opened on the public host, the proxy redirects it to the configured admin origin while keeping admin access open.

Public campaign slugs should use the active brand name. Current Ineffable $388 canonical URLs use `/lp/ineffable-388-...`; the known older `/lp/alyssa-388-13e933` and `/lp/alyssa-388-488b24` URLs are kept as exact redirect aliases so existing ad links continue to resolve without showing Alyssa branding. Do not add broad `alyssa-*` redirects because real Alyssa campaigns must remain Alyssa-owned.

## Public Meta Pixel PageView And CompleteRegistration

Public Landing Pages can fire a Meta Pixel `PageView` event for campaign traffic. This is public-page only and is not loaded on admin pages such as `/dashboard`, `/landing-pages`, `/leads`, `/settings`, or `/system-audit`.

```bash
NEXT_PUBLIC_META_PIXEL_ID_INEFFABLE=1020143980486592
NEXT_PUBLIC_META_PIXEL_ID_ALYSSA=
NEXT_PUBLIC_META_PIXEL_ID=
```

Pixel IDs are brand-scoped. Ineffable public landing pages use `NEXT_PUBLIC_META_PIXEL_ID_INEFFABLE`, falling back to the legacy `NEXT_PUBLIC_META_PIXEL_ID` for existing single-pixel deployments. Alyssa public landing pages use `NEXT_PUBLIC_META_PIXEL_ID_ALYSSA`; if that env var is missing, Alyssa pages skip Pixel instead of sending traffic to the Ineffable Pixel. If no Pixel ID is configured for the resolved brand, no Pixel script is rendered and public lead submission still works.

Direct public landing pages on `go.beautytrialhk.com/lp/...` install the standard Meta Pixel base loader in the browser, load `https://connect.facebook.net/en_US/fbevents.js`, call `fbq("init", pixelId)`, and fire `fbq("track", "PageView")` after the Meta script loads. They also create a direct safe image beacon fallback to `https://www.facebook.com/tr` for PageView. Add `?pixel_debug=1` to a public LP URL to show a small debug panel and console logs for Pixel ID, script injection, script load, `fbq` availability, `fbq.loaded`, `fbq.version`, PageView request state, fallback beacon state, and the last load/error state. Direct public landing pages fire `CompleteRegistration` only after `/api/public/leads` returns success; they attempt `fbq("track", "CompleteRegistration")` and create a direct safe image beacon fallback. If `fbq` is unavailable, the form still succeeds and the fallback can still run.

Attribution QA note: open a public LP with tracking parameters such as `/lp/ineffable-388-13e933?utm_source=meta&utm_medium=paid_social&utm_campaign=test_campaign&utm_content=test_hook&fbclid=test123&pixel_debug=1&attribution_debug=1&v=1001`. The attribution debug panel should show the live URL, initial search, preserved page URL, and captured `utm_source`, `utm_campaign`, `utm_content`, and `fbclid`. If browser-side behavior strips tracking parameters after the first document request, LaunchHub restores missing tracking/debug parameters where possible and still uses the server-provided initial search or locked first touch for lead attribution and Meta beacon `dl`. A manual QA check can strip the address bar after load, submit a test lead, and confirm `lead_source_snapshots` keeps the original UTM/fbclid values and full page URL.

Public LP attribution also has server/proxy and inline first-touch fallbacks. On `/lp/*` requests that include tracking parameters, the proxy writes a same-site cookie named `launchhub_public_attribution` before client-side code runs. The LP HTML also renders a small inline bootstrap script when the first request contains real tracking parameters; it writes the first tracked touch into `sessionStorage`, `localStorage`, and a client-readable backup cookie named `launchhub_public_attribution_client`. These stores contain no PII; they only store `captured_at`, capture method, full `current_page_url`, full `landing_page_url`, `page_path`, and present tracking parameters. Clean or debug-only page loads do not erase an existing tracked first touch.

LaunchHub supports standard URL parameters and LaunchHub-owned backup aliases. Standard params win when present; backup params fill missing canonical fields:

- `lh_source` -> `utm_source`
- `lh_medium` -> `utm_medium`
- `lh_campaign` -> `utm_campaign`
- `lh_content` -> `utm_content`
- `lh_term` -> `utm_term`
- `lh_campaign_id` -> `campaign_id` and `meta_campaign_id`
- `lh_adset_id` -> `adset_id` and `meta_adset_id`
- `lh_ad_id` -> `ad_id` and `meta_ad_id`
- `lh_placement` -> `placement`
- `lh_channel` -> `utm_source` when `utm_source` / `lh_source` is missing
- `lh_brand` is kept in raw/debug attribution only

Recommended Meta URL Parameters:

```text
utm_source=meta&utm_medium=paid_social&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&utm_term={{adset.name}}&campaign_id={{campaign.id}}&adset_id={{adset.id}}&ad_id={{ad.id}}&placement={{placement}}&lh_source=meta&lh_medium=paid_social&lh_campaign={{campaign.name}}&lh_content={{ad.name}}&lh_term={{adset.name}}&lh_campaign_id={{campaign.id}}&lh_adset_id={{adset.id}}&lh_ad_id={{ad.id}}&lh_placement={{placement}}
```

`/api/public/leads` merges attribution in this order: submitted body tracking, locked/inline bootstrap tracking, server tracking, preserved body first/latest tracking, proxy/client cookie tracking, then direct/no tracking. Objects that only contain debug parameters are ignored for tracking decisions. This prevents a later clean or debug-only URL from downgrading a tracked lead to `直接 / 無追蹤`.

Quick route checks:

```bash
curl.exe -I "https://go.beautytrialhk.com/lp/ineffable-388-13e933?utm_source=meta&utm_medium=paid_social&utm_campaign=test&utm_content=hook01&fbclid=test123&pixel_debug=1&attribution_debug=1"
curl.exe -I "https://go.beautytrialhk.com/lp/alyssa-388-13e933?utm_source=meta&utm_campaign=legacy_test&fbclid=legacy123"
```

Expected: the canonical URL returns `200 OK` with `Set-Cookie: launchhub_public_attribution=...`; the legacy URL returns a redirect preserving the query and also sets the attribution cookie.

Wix iframe embeds do not fire Pixel inside the iframe. After successful save, the iframe sends this safe parent message once:

```js
{
  type: "launchhub:form-submitted",
  event: "CompleteRegistration",
  formToken: "FORM_TOKEN",
  brandSlug: "brand-slug",
  value: 388,
  currency: "HKD"
}
```

No customer name, phone, email, appointment time, free-text notes, raw lead ID, or sensitive treatment details are sent to Meta.

Meta Conversions API is not implemented in this pass. A future CAPI layer should trigger only after successful lead save, use a brand-specific Pixel/Dataset ID and access token, support `test_event_code` for Meta Test Events, and share a dedupe `event_id` with the browser event if both browser Pixel and CAPI are enabled.

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

The current Supabase migration contains the shared base tables needed by Campaign Launch OS and the future CRM app:

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

The future CRM app should follow this contract:

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
- `NEXT_PUBLIC_PUBLIC_BASE_URL` - optional; use later if public Landing Pages move to a separate domain.
- `NEXT_PUBLIC_ADMIN_BASE_URL` - optional; use later if internal admin pages move to a separate domain.
- `NEXT_PUBLIC_META_PIXEL_ID_INEFFABLE` - optional; enables Ineffable public Landing Page Pixel events.
- `NEXT_PUBLIC_META_PIXEL_ID_ALYSSA` - optional; enables Alyssa public Landing Page Pixel events when configured.
- `NEXT_PUBLIC_META_PIXEL_ID` - optional legacy fallback for existing Ineffable/single-pixel deployments.
- `NEXT_PUBLIC_SUPABASE_URL` - pending; required before browser-side Supabase-aware flows are introduced.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - pending; required before browser-side Supabase-aware flows are introduced.
- `SUPABASE_SERVICE_ROLE_KEY` - pending; required by current server-side write APIs.
- `LAUNCHHUB_ADMIN_PASSWORD` - required for the shared admin password gate.
- `LAUNCHHUB_ADMIN_SESSION_SECRET` - required for signing the admin session cookie.
- `PAYMENT_WEBHOOK_SECRET` - pending; must be added before production payment webhook use.
- Legacy internal auth env vars are deprecated and not required: `INTERNAL_ACCESS_USERS`, `INTERNAL_AUTH_SESSION_SECRET`, `INTERNAL_AUTH_COOKIE_DOMAIN`, and `INTERNAL_AUTH_DISABLED`.
- Future WhatsApp webhook secret / verification token - pending; must be added before production WhatsApp webhook use.

## Future Vercel Deployment

Do not deploy yet. Before deployment:

- Set `NEXT_PUBLIC_APP_URL` to the final Vercel or custom domain.
- Set `NEXT_PUBLIC_ADMIN_BASE_URL=https://app.beautytrialhk.com` for internal admin pages and `NEXT_PUBLIC_PUBLIC_BASE_URL=https://go.beautytrialhk.com` for public campaign pages when using the split domains.
- Configure Supabase environment variables in Vercel.
- Configure `LAUNCHHUB_ADMIN_PASSWORD` and `LAUNCHHUB_ADMIN_SESSION_SECRET` in Vercel.
- Add production Wix domains to `forms.allowed_domains`.
- Confirm webhook authentication for payment and WhatsApp endpoints.
- Run `npm run lint` and `npm run build`.

## Production Trial Checklist

- Configure environment variables in Vercel.
- Keep `SUPABASE_SERVICE_ROLE_KEY` server-side only.
- Set custom domains later; do not hard-code the final public/admin domains until confirmed.
- Add the public Wix or campaign domain to each form's allowed domains.
- Use Create Campaign to generate either a Wix form or a Landing Page.
- Test a UTM lead submission before running real ads.
- Confirm `/system-audit` shows public form lookup, main form token, and landing page route checks as ready.
- Test records with stamp `50969` currently remain in dev data and should not be deleted until a separate cleanup pass.

## Public Form Legal Consent

All public lead forms require visitors to tick a legal consent checkbox before submitting. The checkbox confirms the visitor has read and agreed to the relevant legal terms, and agrees that submitted data may be used for appointment, customer service, and related follow-up. The checkbox label is plain text only; legal links are shown in the form / landing page footer.

- Brand-level legal settings are the source of truth for public legal links.
- If a brand has `legal_page_url`, public forms and public Landing Pages show one legal footer link using `legal_link_label`.
- Ineffable Beauty should use one single legal page: `https://www.ineffablebeautyhk.com/legal`, with link label `法律條款`.
- If a brand does not have `legal_page_url`, LaunchHub keeps the existing fallback links for Privacy Policy, Terms & Conditions, and Disclaimer.
- Apply `docs/BRAND_LEGAL_SETTINGS_APPLY.sql` in Supabase before expecting Legal / Operator edits to persist in the database.
- Public legal pages now contain first-pass Traditional Chinese placeholder content for Privacy Policy, Terms & Conditions, and Disclaimer for brands that still use fallback internal legal pages.
- Company and legal review is required before official launch or larger paid campaign use.
- Current fallback placeholder legal routes are `/legal/alyssa/privacy`, `/legal/alyssa/terms`, and `/legal/alyssa/disclaimer`.
- Replace placeholder legal content with brand-approved legal documents before running larger paid campaigns.
- `/api/public/leads` also validates `legalConsentAccepted` server-side, so consent is not only a browser UI check.
- Consent proof is recorded in `lead_events` using the existing allowed `form_submit_success` event type with `consent_event = "legal_consent_accepted"` in `event_payload_json`.
- Marketing or promotional consent should be added later as a separate optional checkbox. It is intentionally not included in this pass.
- Public Privacy Policy, Terms & Conditions, and Disclaimer should identify the brand/operator and explain customer data use, offer rules, booking rules, and treatment-effect limitations.
- Public customer-facing terms must not say customer data belongs to the developer, the system belongs to the developer, or source code ownership belongs to the developer.

Current brand legal profile fields:

- `legal_page_url`
- `legal_link_label`
- `operator_name`

## Google Sheets Lead Sync V1

LaunchHub can send each successfully created public lead to a Google Apps Script webhook, which can append one CS follow-up row into Google Sheets before the full CRM is ready.

Setup:

- Create or choose the Google Sheet for CS follow-up.
- Create a Google Apps Script web app that receives JSON and appends one row to the sheet.
- Validate the submitted `secret` inside Apps Script before writing to the sheet.
- Configure these server-side environment variables:
  - `GOOGLE_SHEETS_SYNC_ENABLED=true`
  - `GOOGLE_SHEETS_SYNC_MODE=apps_script`
  - `GOOGLE_SHEETS_WEBHOOK_URL`
  - `GOOGLE_SHEETS_WEBHOOK_SECRET`

If sync is disabled, required config is missing, or the webhook fails, lead creation still succeeds and the server logs a safe sync skipped warning. The webhook URL and secret must never be exposed to client-side code.

Webhook payload keys:

The webhook body includes `secret` for Apps Script validation plus these row fields:

`createdAt`, `followUpStatus`, `csOwner`, `brand`, `branch`, `customerName`, `phone`, `email`, `treatmentOffer`, `appointmentDate`, `appointmentTime`, `source`, `campaignAd`, `pageUrl`, `note`, `lastFollowUpAt`.

Latest Ineffable CS follow-up sheet columns:

`Created At`, `跟進狀態`, `CS 負責人`, `品牌`, `分店`, `客人姓名`, `電話`, `Email`, `療程 / 優惠`, `預約日期`, `預約時間`, `來源`, `Campaign / 廣告`, `Page URL`, `備註`, `最後跟進時間`.

Default CS fields:

- `跟進狀態` = `待跟進`
- `CS 負責人` = blank
- `備註` = blank
- `最後跟進時間` = blank

The sync runs after the Supabase lead, source snapshot, and booking records are created. Invalid submissions, honeypot submissions, missing consent, rate-limited duplicates, and duplicate lead rows do not trigger the webhook. Lead event logging warnings do not prevent the Sheet sync attempt. If Google Sheets append fails, public lead submission still returns success and CS can continue using LaunchHub/Supabase as the source of truth.

The CS sheet is intentionally reduced for follow-up work. Raw attribution fields such as click IDs, Meta IDs, CTWA IDs, consent proof, source type, and technical event details remain in LaunchHub/Supabase for marketing attribution and audit use.

For CS readability, the sheet source label follows the Lead feed format: if `utm_source` exists it writes `utm_source / utm_medium`, using `-` when medium is missing. If no tracked source exists, it writes `直接 / 無追蹤`. This display label does not change stored attribution fields.

CS teammates can manually update `跟進狀態`, `CS 負責人`, `備註`, and `最後跟進時間` in the sheet. The Google Sheet can also support manual WhatsApp ad leads through an Apps Script button or custom menu before the future WhatsApp API webhook integration is ready.

## Public Reliability & Security V1

This pass adds a lightweight public safety layer for small-scale campaign testing.

Launch principle: save valid customer registrations first, then review or filter suspicious/test records later. Required customer fields, phone shape, legal consent, domain validation, duplicate window checks, and the hidden honeypot remain in place. Do not add aggressive bot-score rejection or silent drops at submit time unless a separate abuse incident requires it. If later filtering is needed, prefer post-save labels such as `suspected_test`, `suspected_bot`, or `excluded_from_lead_count` in a future reviewed data model.

- Public forms include a hidden honeypot field; if it is filled, the submission is rejected with a friendly user message.
- `/api/public/leads` checks for same form + same normalized phone duplicate submissions within a short window before creating another lead.
- A small IP burst limiter is used when forwarded IP headers are available; phone/form duplicate checking remains the primary DB-backed protection.
- Public submission errors return user-friendly messages while server logs keep concise diagnostics such as reason code, form token, normalized phone, origin, short user agent, and timestamp.
- Public Landing Pages render published content only for normal visitors. Unpublished or missing pages show a clean unavailable state.
- Public embed forms show a clean unavailable state when the token or config cannot be loaded.
- Campaign pages include a compact preflight checklist for public page, form token, allowed domain, test lead, UTM, and price checks before ads.
- Basic response headers include `X-Content-Type-Options: nosniff` and `Referrer-Policy: strict-origin-when-cross-origin`.
- Frame-blocking headers and CSP are intentionally skipped for now so Wix iframe embeds keep working.

This is suitable for early real campaign trials. It is not yet a high-volume enterprise anti-abuse layer, full bot management system, or CRM authentication layer.

## Verification

```bash
npm run lint
npm run build
```
