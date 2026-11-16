# Authenticated lead-delivery recovery scheduling

Date: 2026-11-16 (HKT). Status: production activated; real signed dispatch, pause/resume and natural tick verified.

## Observed constraint

The foundation candidate initially added a five-minute Vercel cron for delivery recovery. Its real preview deployment was rejected under the current hosting plan's cron constraints. The unsupported manifest job was removed. `vercel.json` retains the pre-existing daily marketing-source refresh; no paid plan change or new scheduling vendor is assumed.

Read-only database inspection confirmed `pg_cron`, `pg_net` and Vault already installed. That initial read-only capability check was not activation evidence. The subsequent production job, configuration, authenticated HTTP and controlled delivery evidence are recorded in the release ledger.

## Execution contract

`supabase/drafts/public_lead_delivery_schedule.sql` is a reviewed rollout recipe, not an automatic migration. It is executed only after the specific production rollout is authorized and the additive receipt/outbox schema plus matching application worker have passed qualification.

The final candidate direction uses a dedicated `LEAD_DELIVERY_SIGNING_SECRET`, separate from authentication used by other scheduled jobs. Encrypted Vault references supply the exact HTTPS worker URL and signing key. A named five-minute database schedule computes a time-bound HMAC for the exact GET method and `/api/cron/lead-deliveries` path, then queues only the timestamp and derived signature. The worker accepts a signature for at most 60 seconds, with at most 15 seconds of future clock skew. No long-lived signing key or bearer credential belongs in the queued HTTP headers, and the worker does not fall back to another job's `CRON_SECRET` or bearer contract.

This replaces the earlier source-only long-lived bearer recipe. Read-only privilege metadata showed the network request queue can be readable to database roles, so encrypting a key in Vault is insufficient if it is later copied into a queued header. No request headers, decrypted values or secrets were read during that review, and the earlier recipe was never activated. The HMAC implementation passed 16 contract cases and exact-source qualification, then authorized production dispatch. The reusable-bearer recipe remained unexecuted; the dedicated-signature recipe is active.

Job and HTTP inspection must use safe metadata only; never print decrypted Vault values, signing material or request authentication headers.

The worker remains responsible for claim leases, stale-worker protection, bounded batches, delivery retry policy and unknown-result reconciliation. A scheduler invocation is not a delivery receipt. A delivered lead is not a published report generation. Neither scheduler nor worker may claim metric refresh success merely because an external row was appended.

## Production activation

Explicit user rollout and standing Alyssa maintenance authorization resolved the earlier configuration approval blocker; see AGENTS.md. The exact additive migration and matching application were verified before the reviewed recipe was enabled. Only the dedicated production key and matching encrypted URL/key references changed; the existing daily hosting job remains independent. The recipe is an explicit activation artifact, not an automatically applied migration, despite remaining under `supabase/drafts/`.

Fresh dedicated dispatch returned HTTP 200. Unsigned, stale and wrong-path proofs returned 401. An initial stale URL was corrected before activation. Actual unschedule/absence verification and exact-recipe resume passed; the resumed five-minute job's first natural run produced a matching HTTP 200 without timeout/error. Its queue was empty after fixture cleanup, so this is scheduled liveness/authentication evidence rather than real-backlog recovery. No queued long-lived secret was read, logged or exposed; the temporary configuration key copy was cleared.

## Acceptance and recovery

- Final isolated PostgreSQL tests qualify receipt, outbox and lease behavior.
- The final application/visual gates and compatible preview deployment pass on an exact source SHA.
- The request-authentication contract rejects wrong method/path, missing or malformed signatures, expired timestamps and excessive future skew; exact valid requests use only the dedicated signing key. SQL and application canonical-message construction must agree.
- After approval and activation, verify only the named job's schedule/active state and safe HTTP result metadata.
- Verify authenticated worker invocation and actual persisted job-state transitions separately.
- The named `cron.unschedule` pause/resume path passed. Unscheduling stops future ticks only; queued/active/per-capture/manual workers may still execute. It is not a global pause.
- Resume/reconcile ambiguous operations using stable destination identity. A missed tick or unknown append result never authorizes blind replay.
- Preserve the existing daily hosting refresh and its independent reporting-freshness semantics.

Exact production source and sanitized operational evidence: [release ledger](../releases/2026-11-16-system-foundation.md). Later documentation-only commits are not automatically claimed deployed.
