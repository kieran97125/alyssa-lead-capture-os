# Authenticated lead-delivery recovery scheduling

Date: 2026-11-16 (HKT). Status: source-only rollout preparation; inactive and unreleased.

## Observed constraint

The foundation candidate initially added a five-minute Vercel cron for delivery recovery. Its real preview deployment was rejected under the current hosting plan's cron constraints. The unsupported manifest job was removed. `vercel.json` retains the pre-existing daily marketing-source refresh; no paid plan change or new scheduling vendor is assumed.

Read-only database inspection confirmed `pg_cron`, `pg_net` and Vault already installed. This confirms available capabilities only. It does not establish an enabled recovery job, valid encrypted configuration, authenticated endpoint execution or completed delivery.

## Execution contract

`supabase/drafts/public_lead_delivery_schedule.sql` is a reviewed rollout recipe, not an automatic migration. It is executed only after the specific production rollout is authorized and the additive receipt/outbox schema plus matching application worker have passed qualification.

The final candidate direction uses a dedicated `LEAD_DELIVERY_SIGNING_SECRET`, separate from authentication used by other scheduled jobs. Encrypted Vault references supply the exact HTTPS worker URL and signing key. A named five-minute database schedule computes a time-bound HMAC for the exact GET method and `/api/cron/lead-deliveries` path, then queues only the timestamp and derived signature. The worker accepts a signature for at most 60 seconds, with at most 15 seconds of future clock skew. No long-lived signing key or bearer credential belongs in the queued HTTP headers, and the worker does not fall back to another job's `CRON_SECRET` or bearer contract.

This replaces the earlier source-only long-lived bearer recipe. Read-only privilege metadata showed the network request queue can be readable to database roles, so encrypting a key in Vault is insufficient if it is later copied into a queued header. No request headers, decrypted values or secrets were read during that review, and the earlier recipe was never activated. The HMAC implementation now passes 16 local authentication contract cases; exact final-source/SQL qualification and rollout authorization remain pending, and nothing has been activated.

Job and HTTP inspection must use safe metadata only; never print decrypted Vault values, signing material or request authentication headers.

The worker remains responsible for claim leases, stale-worker protection, bounded batches, delivery retry policy and unknown-result reconciliation. A scheduler invocation is not a delivery receipt. A delivered lead is not a published report generation. Neither scheduler nor worker may claim metric refresh success merely because an external row was appended.

## Rollout boundary

The attempted new production/preview authentication configuration was rejected by automatic approval review because the user had not explicitly authorized that security and scheduling scope. No environment values changed, and no production migration, application release or schedule activation has occurred.

The final concrete approval covers the additive schema, dedicated production signing-key configuration, encrypted URL/key references, five-minute HMAC-authenticated recovery job and matching application release. It does not approve the superseded long-lived bearer design. Complete the reviewable source and qualification evidence first. This requirement does not create an additional approval flow for ordinary reversible source fixes.

## Acceptance and recovery

- Final isolated PostgreSQL tests qualify receipt, outbox and lease behavior.
- The final application/visual gates and compatible preview deployment pass on an exact source SHA.
- The request-authentication contract rejects wrong method/path, missing or malformed signatures, expired timestamps and excessive future skew; exact valid requests use only the dedicated signing key. SQL and application canonical-message construction must agree.
- After approval and activation, verify only the named job's schedule/active state and safe HTTP result metadata.
- Verify authenticated worker invocation and actual persisted job-state transitions separately.
- Test the named `cron.unschedule` pause path; pausing recovery preserves accepted captures, receipts and outbox history.
- Resume/reconcile ambiguous operations using stable destination identity. A missed tick or unknown append result never authorizes blind replay.
- Preserve the existing daily hosting refresh and its independent reporting-freshness semantics.
