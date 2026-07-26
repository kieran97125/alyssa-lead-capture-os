# WhatsApp Broadcast Operations

## Product boundary

This module belongs to CRM operations, not GrowthRadar marketing intelligence.

CRM owns:

- explicit WhatsApp consent evidence
- suppression and opt-out enforcement
- approved Meta template selection
- recipient eligibility checks
- dry run and approval
- queue execution
- delivery / read / failed status
- automatic safety pauses
- audit events

GrowthRadar owns:

- audience strategy
- segment recommendations
- campaign opportunity analysis
- message / offer strategy
- post-send business analysis
- source-to-booking / source-to-revenue insights

A future GrowthRadar handoff may provide an approved recipient snapshot to CRM. CRM must still re-check consent, suppression, frequency caps and connection health immediately before sending.

## Default safety state

Live sending is disabled unless all of the following are configured:

```text
WHATSAPP_CAMPAIGNS_LIVE_ENABLED=true
CRON_SECRET=<strong random secret>
WHATSAPP_BROADCAST_DAILY_CAP=50
```

`WHATSAPP_BROADCAST_DAILY_CAP` is a rolling 24-hour hard cap per brand. The default is 50 if omitted.

## Required database migration

Apply:

```text
docs/CRM_WHATSAPP_CAMPAIGNS_SAFE_APPLY.sql
```

The migration creates protected service-role-only tables for consent, suppressions, broadcasts, recipients and audit events. It also installs an atomic queue claim function with stale-worker recovery.

## Operational flow

```text
Draft
→ Dry Run
→ Admin Approval
→ Queue
→ Worker sends up to 10 recipients per batch
→ Delivery statuses return through Meta webhook
→ Completed / Paused
```

## Hard safety gates

A recipient is excluded when any of these applies:

- no explicit brand-scoped marketing consent
- active suppression or prior opt-out
- invalid phone
- frequency cap still active
- approved template missing or stale
- template variable mapping incomplete
- connection health error
- daily send cap reached

The worker automatically pauses when:

- Meta returns a policy, permission or template error
- failure rate reaches 20% after at least 10 send attempts
- opt-out rate reaches 5% after at least 20 relevant recipients
- WhatsApp connection health contains an error
- the rolling daily cap is reached

## Opt-out handling

Inbound exact-match keywords currently include:

```text
STOP
UNSUBSCRIBE
停止
取消訂閱
不要再發
唔好再發
不要再傳送
```

An opt-out creates or activates a suppression, revokes consent and marks queued recipients as opted out.

## Activation checklist

1. Apply SQL migration.
2. Confirm app-secret and access-token encryption is configured.
3. Sync Meta templates and confirm at least one approved Marketing template.
4. Record consent only where evidence exists.
5. Keep live send disabled and complete Dry Run verification.
6. Test with a very small internal / consented audience.
7. Set a conservative daily cap.
8. Configure the protected cron endpoint.
9. Monitor delivery, failure and opt-out status before increasing volume.

No system can guarantee that Meta will never restrict a WhatsApp account. This module reduces operational risk by enforcing consent, approved templates, rate limits, idempotency, safety pauses and opt-out handling.
