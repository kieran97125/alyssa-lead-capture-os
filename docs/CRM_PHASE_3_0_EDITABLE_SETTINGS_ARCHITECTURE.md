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
2. Load enabled app settings from a future `crm_app_settings` table.
3. Apply brand-level overrides when a lead has a brand context.
4. Fall back to code defaults when a setting is missing, disabled, malformed, or unsafe.
5. Render the resolved settings in lead detail and CRM settings UI.

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

## Brand-Level Override Strategy

Settings should support:

- global fallback settings where `brand_id` and `brand_slug` are null
- brand-specific settings keyed by `brand_id`
- optional `brand_slug` for easier admin reading and import/export

Resolution order:

1. brand-specific enabled setting by `brand_id`
2. brand-specific enabled setting by `brand_slug`
3. global enabled setting
4. code default

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
2. Add a server-only settings reader that merges code defaults and DB overrides.
3. Add a read-only resolved-config debug view in `/crm/settings`.
4. Add admin edit forms for low-risk groups first, such as quick replies and lost reasons.
5. Add audit fields before enabling broader editing.
6. Keep all public lead capture and embed behavior isolated from CRM settings.
