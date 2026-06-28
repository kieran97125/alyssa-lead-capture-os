# CRM Phase 3.0 Editable Settings Architecture

Status: planning and safe foundation only. No database schema has been applied. No live settings mutation is enabled.

## Goal

Move routine CRM / CS workflow options toward in-app editable settings, so changes such as quick reply wording, lost reasons, invalid reasons, room labels, and booking templates do not require code changes.

Phase 3.0 does not turn on editable settings yet. The CRM still reads from safe code defaults in `src/lib/crm/settingsConfig.ts`.

## Current Default Config Flow

Current flow:

1. `src/lib/crm/settingsConfig.ts` defines CRM operational defaults.
2. `/crm/settings` displays those defaults as a read-only admin preview.
3. `/crm/leads/[leadId]` consumes the defaults for:
   - contact channels
   - follow-up outcomes
   - lost reasons
   - invalid reasons
   - paid status labels
   - quick reply templates
   - local AI reply draft templates
4. CS users copy drafts manually or open WhatsApp manually.

No WhatsApp API, external AI API, Meta API, or auto-send behavior is connected.

## Future Editable Config Flow

Future flow after reviewed schema is applied:

1. Load global defaults from code.
2. Load enabled global settings from a future `crm_app_settings` table.
3. Load enabled brand-level overrides when a lead has a brand context.
4. Validate DB records by `config_group`, `config_key`, `enabled`, and `value_json` shape.
5. Merge settings in this order:
   - code defaults
   - valid global DB settings
   - valid brand DB overrides
6. Fall back to code defaults when a setting is missing, disabled, malformed, locked in an unsafe way, or unavailable.
7. Render the resolved settings in lead detail, inbox, booking views, and CRM settings UI.

The first implementation should be read-mostly and conservative. Editing can be added after audit and permission rules are reviewed.

## Config Groups

Recommended configurable groups:

- `crm_status_labels`
- `lost_reasons`
- `invalid_reasons`
- `contact_channels`
- `follow_up_outcomes`
- `quick_replies`
- `ai_reply_drafts`
- `ai_reply_tone`
- `booking_confirmation_templates`
- `treatment_faq_replies`
- `room_options`
- `paid_status_labels`
- `inbox_column_presets`

## Brand-Level Override Strategy

Settings should support:

- global fallback settings where `brand_id` and `brand_slug` are null
- brand-specific settings keyed by `brand_id`
- optional `brand_slug` for easier admin reading and import/export

Resolution order:

1. code default
2. global enabled setting
3. brand-specific enabled setting by `brand_slug`
4. brand-specific enabled setting by `brand_id`

When both `brand_id` and `brand_slug` are available, `brand_id` should win because it is stable against slug edits. `brand_slug` remains useful for preview, imports, and fallback matching.

## Fallback Strategy

Code defaults remain the safety net.

If database settings are unavailable, partially configured, or invalid:

- CRM must still render.
- CS actions must still work.
- lead detail must still show operational options.
- booking status semantics must not change.
- public lead submission must not be affected.

## Safety Rules

Editable settings must not store:

- customer PII
- phone numbers
- raw WhatsApp tokens
- raw API secrets
- Meta access tokens
- lead IDs in reusable templates
- sensitive free-text lead notes

Editable settings must not trigger:

- WhatsApp API sends
- external AI calls
- Meta event sends
- public form behavior changes
- source attribution changes
- Google Sheets schema changes

## Lead Detail Consumption

`/crm/leads/[leadId]` should consume resolved CRM settings only for display and operational choices:

- dropdown labels
- reason lists
- reply template cards
- AI draft templates
- room option suggestions
- paid status labels

Settings must not drive whether a form lead is considered booked. Booking remains an explicit CS operational action.

## Inbox Column Preset Consumption

Inbox column presets should start as code defaults and later move into DB-backed settings under `inbox_column_presets`.

Recommended preset keys:

- `cs_booking`
- `marketing`
- `technical`

Future `value_json` shape can contain:

- `columns`: ordered column keys
- `label`: display label override
- `description`: admin-facing description
- `enabled`: UI visibility hint
- `locked_columns`: columns that cannot be removed from operational views

The default CS booking preset must remain booking-first. Marketing and technical presets can expose source, campaign, CTWA, fbclid/fbp/fbc, landing page, form token, parent URL, and referrer fields when needed, but those fields should not be forced into the default CS workflow.

Column preferences can later be saved per user or team after the settings table is proven safe. Until then, presets should remain code-based or brand-level settings only.

## Admin Mutation Boundary

Editable settings should be changed only from admin-oriented routes such as `/crm/settings`.

Until a full user/role model exists:

- Browser clients must not receive service-role credentials.
- Settings mutation should use server-only actions.
- Public routes must never read or mutate CRM settings.
- No anon/public RLS policies should allow direct mutation.
- Audit rows should be written for every future create/update/enable/disable/lock/unlock/delete action.

The SQL proposal enables RLS but intentionally does not add broad anon policies. Future implementation can use the server-side admin client for controlled mutations behind the LaunchHub admin password gate.

## Avoiding Booking Workflow Breakage

The business rules remain fixed:

- Form submission = `new` / 待跟進.
- Customer preferred appointment date/time = preference only.
- `booked` means CS confirmed the appointment.
- showed / no-show requires operational action.
- marketing tracking must never drive booking status.

Any future settings editor should validate that required status values still map to the existing CRM enum values.

## Future Implementation Steps

1. Review and apply a settings table migration only after approval.
2. Add a server-only settings reader that merges code defaults, global DB settings, and brand DB overrides.
3. Add a read-only resolved-config debug view in `/crm/settings`.
4. Add admin edit forms for low-risk groups first, such as quick replies, lost reasons, invalid reasons, and inbox column presets.
5. Write audit rows before enabling broader editing.
6. Keep all public lead capture and embed behavior isolated from CRM settings.
7. Add user/team preference persistence only after brand-level settings are stable.
