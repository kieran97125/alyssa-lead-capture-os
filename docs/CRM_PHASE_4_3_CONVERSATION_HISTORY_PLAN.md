# CRM Phase 4.3 Conversation History Plan

Status: planning only. No WhatsApp API is connected, no messages are sent, and no schema has been applied by this document.

## Product Goal

The CRM lead detail page already has a conversation-first shell and Reply Composer. Phase 4.3 defines the future data model for real WhatsApp conversation history, outbound sending, drafts, delivery events, and auditability.

The goal is to make future WhatsApp integration safe and operational:

- CS can review a conversation thread before replying.
- Quick Replies and AI Assist both insert content into the composer.
- The composer remains the final human-reviewed message.
- Sending requires a WhatsApp connection and explicit human action.
- No auto-send by default.

## Current UI Flow

Current lead detail behavior:

- Conversation panel shows a placeholder and internal CRM context.
- Reply Composer supports Quick Replies and AI Assist as separate tools.
- Send via WhatsApp is visible but disabled.
- Manual Open WhatsApp remains available.
- Timeline/internal CRM records are not treated as synced WhatsApp messages.

Future behavior after WhatsApp connection:

- The conversation panel reads from `crm_conversation_threads` and `crm_conversation_messages`.
- Inbound WhatsApp messages appear as inbound messages.
- Outbound API-sent messages appear as outbound messages with delivery status.
- Manual notes/contact attempts remain internal CRM context, not WhatsApp messages.
- AI-generated drafts and Quick Reply usage are audit-linked to the final message when possible.

## Core Concepts

### Conversation Thread

A thread represents one messaging conversation for a CRM contact/case/channel.

Recommended identity:

- `case_id`: CRM operational case.
- `contact_id`: CRM contact.
- `source_lead_id`: original LaunchHub lead if available.
- `brand_id` / `brand_slug`: brand context.
- `channel`: `whatsapp` first, future `phone`, `email`, `instagram`, etc.
- `external_thread_id`: provider conversation ID if WhatsApp provider exposes one.
- `participant_phone`: normalized customer phone at time of thread creation.
- `assigned_to`: CS owner if available.

Thread status should be lightweight:

- `open`
- `pending_customer`
- `pending_cs`
- `closed`
- `archived`

### Message

A message represents one inbound, outbound, or manually recorded conversation item.

Direction:

- `inbound`: customer to business.
- `outbound`: business to customer.
- `internal`: not a customer-visible message, for internal context only.

Source type:

- `whatsapp_webhook`: inbound provider webhook.
- `whatsapp_api`: outbound API send.
- `manual_log`: CS manually logged content.
- `composer_draft`: content prepared in composer but not sent.

Message status:

- `draft`
- `queued`
- `sent`
- `delivered`
- `read`
- `failed`
- `cancelled`

### Drafts

Drafts are separate from sent messages.

Draft origins:

- `quick_reply`
- `ai_assist`
- `manual`
- `edited`

Rules:

- A Quick Reply is a preset response inserted into composer.
- AI Assist is a generated response inserted into composer.
- Composer text is the final human-reviewed message.
- Sending must require CS action.
- No auto-send by default.

### Delivery Events

Delivery events are provider updates for a message:

- queued
- sent
- delivered
- read
- failed

These events should be append-only for audit history.

## Relationships

Future relationships should support:

- `crm_lead_cases.id` -> conversation thread.
- `crm_contacts.id` -> conversation thread.
- `leads.id` -> source lead reference.
- `crm_conversation_threads.id` -> messages.
- `crm_conversation_messages.id` -> delivery events.
- `crm_message_drafts.id` -> final sent message if used.
- Quick Reply key -> draft/message metadata.
- AI draft key/prompt version -> draft/message metadata.

## Deduplication

Inbound webhook dedupe:

- Unique provider message ID per platform.
- Suggested key: `(platform, external_message_id)`.
- If provider does not supply stable ID, use a derived hash from channel, phone, timestamp bucket, and payload text, but stable provider IDs are preferred.

Outbound send dedupe:

- Generate a local `client_message_id` before queueing.
- Store provider message ID after send.
- Unique local key: `(platform, client_message_id)`.

Delivery event dedupe:

- Suggested key: `(message_id, external_event_id)` when available.
- Fallback: `(message_id, event_type, occurred_at, payload_hash)`.

## Retry Handling

Outbound messages should not be sent directly from the UI request in the long term.

Recommended future flow:

1. CS clicks Send.
2. App creates an outbound message row with status `queued`.
3. Worker/API sender attempts provider send.
4. On success, status becomes `sent`.
5. Webhook updates delivery/read status.
6. On failure, status becomes `failed`, with `retry_count` and `last_error`.

Retry fields:

- `retry_count`
- `max_retries`
- `last_attempt_at`
- `next_retry_at`
- `last_error`

## Webhook Ingestion

Webhook ingestion should:

- Verify provider signature.
- Parse provider account / phone number ID.
- Normalize customer phone.
- Match brand/channel configuration.
- Find or create thread by contact/case/phone/channel.
- Insert inbound message with provider IDs.
- Deduplicate before insert.
- Store safe raw payload snapshot in metadata only when needed.
- Never expose webhook secrets to client code.

## Audit Trail

Every important operational event should be auditable:

- Message draft created.
- Quick Reply inserted.
- AI Assist suggestion generated.
- Composer edited.
- Send clicked.
- Message queued/sent/failed.
- Delivery/read updates received.
- Manual note logged.

For lightweight implementation, the message tables can hold metadata and delivery events. A separate audit table may be added later if stricter traceability is needed.

## Privacy And Consent Notes

The model should keep privacy boundaries clear:

- Store only conversation data required for CS service and audit.
- Avoid storing unnecessary sensitive free text in tracking/reporting tables.
- Do not send customer messages to external AI without explicit future approval and consent review.
- Do not send messages externally until WhatsApp connection and consent boundaries are confirmed.
- Keep WhatsApp credentials and webhook secrets server-side only.
- Respect legal/consent language used by the public forms.

## UI Consumption Plan

The current Conversation UI Shell can later read:

- Thread summary from `crm_conversation_threads`.
- Inbound WhatsApp messages from `crm_conversation_messages`.
- Outbound API messages from `crm_conversation_messages`.
- Delivery/read state from `crm_message_delivery_events`.
- Draft state from `crm_message_drafts`, if persistent drafts are enabled.
- Manual CRM notes from existing `crm_interactions`.

Rendering rules:

- WhatsApp synced messages should be visually separate from internal CRM notes.
- Internal contact attempts and booking actions should remain context, not customer-visible messages.
- Reply Composer stays at the bottom/near the conversation flow.
- Send remains disabled until WhatsApp connection exists.

## Open Decisions

- Whether persistent drafts are needed in Phase 4.4 or later.
- Whether outbound sending uses direct server action or queued worker.
- Which WhatsApp provider will be used.
- Exact webhook signature verification method.
- How team/user identity should be represented before full user roles exist.
- Whether message retention policy is needed before launch.

