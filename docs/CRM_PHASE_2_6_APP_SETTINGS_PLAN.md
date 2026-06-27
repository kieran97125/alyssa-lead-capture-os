# CRM Phase 2.6 App Settings Foundation Plan

Status: planning only. No database schema has been applied. No Supabase SQL has been executed.

## Goal

Prepare a simple admin settings foundation for the booking-first CRM workflow, while keeping CS daily screens clean and operational.

CS users should focus on:

- following up leads
- opening WhatsApp manually
- logging contact attempts
- confirming bookings
- marking showed / no-show / lost / invalid
- using approved reply drafts

Marketing attribution, UTM, fbclid, fbp, fbc, source quality, and tracking readiness should remain in Reports / Admin / Marketing views only.

## Future Settings Areas

Recommended configuration groups:

- CS status labels
- Lost reasons
- Invalid reasons
- Contact channels
- Follow-up outcomes
- WhatsApp quick replies
- AI reply tone
- Booking confirmation templates
- Treatment-specific FAQ replies
- Branch / room options
- Paid status options

## Suggested Default Values

CS statuses:

- new = 待跟進
- contacting = 已聯絡
- booked = 已預約
- showed = 已到店
- no_show = No-show
- lost = 已流失
- invalid = 無效

Lost reasons:

- no_reply
- price_concern
- time_not_fit
- location_not_fit
- changed_mind
- duplicate
- other

Invalid reasons:

- fake_contact
- wrong_number
- spam
- duplicate
- other

Contact channels:

- phone
- whatsapp
- inbox
- other

Follow-up outcomes:

- reached
- no_answer
- replied
- pending
- other

Paid status options:

- unknown
- unpaid
- paid

## Storage Direction

Phase 2.6 does not require a schema change. Current values can remain code constants until the admin settings model is reviewed.

Future storage options:

1. Brand-scoped CRM settings table.
2. JSONB settings document per brand.
3. Separate normalized tables for reasons, channels, templates, and branch rooms.

Recommended later approach:

- Use a brand-scoped settings document first for speed and lower migration risk.
- Keep system fallback defaults in code.
- Add versioned settings so templates can be audited.

## WhatsApp Boundary

Manual WhatsApp support is not WhatsApp API integration.

Current safe behavior:

- show phone number
- open `wa.me` manually when possible
- CS logs contact attempt manually

Future WhatsApp API work should be a separate reviewed phase with credentials, webhook verification, message sending rules, and consent review.

## AI Reply Draft Boundary

Phase 2.6 reply suggestions are template-based local drafts.

They must:

- not auto-send
- not call external AI APIs
- be clearly labeled as drafts
- require a human CS teammate to send manually

Future AI integration should read from approved brand knowledge and treatment FAQ settings.

## Business Rules

- Form submission = new / 待跟進.
- Customer preferred appointment date/time is not a confirmed booking.
- Booked only means CS confirmed the appointment.
- Show / no-show only follows an operational action after appointment time.
- Marketing tracking must never drive booking status.

## Future SQL

No SQL proposal is needed for Phase 2.6. If settings persistence becomes necessary, create a reviewed SQL proposal first and do not execute it without explicit approval.
