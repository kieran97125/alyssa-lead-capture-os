# Public registration reliability — foundation release

## Acceptance and authority

A valid public registration is accepted only after `capture_public_lead_v1` commits the contact, immutable attribution snapshot, lead, **requested** booking, success/consent events, receipt and delivery journal in one database transaction. A requested appointment remains a customer preference, not a CS-confirmed Book. There is no fallback to independent table writes when the RPC is unavailable.

The customer response is independent of Google latency. `after()` attempts queued delivery after the accepted response; the authenticated `/api/cron/lead-deliveries` catches up every five minutes through the reviewed, separately activated Supabase scheduler recipe. The production API returns a friendly 503 if database configuration is unavailable. Explicit isolated E2E fixtures retain their non-persistent demonstration response.

## Retries and duplicate handling

The browser retains one dedicated submission UUID across a failed response and reload, keyed by a SHA-256 fingerprint of business fields. Session storage contains only that hash and UUID. Editing the business fields creates a new request identity; accepted responses clear the browser's retry record. Tracking/event IDs remain separate.

The database serializes receipt reuse and the existing three-minute same-form phone rule. Same identity and business hash returns the original accepted IDs. Reusing that identity for changed business data returns a conflict. Old embedded clients without a submission ID remain accepted; they use server-generated receipt identities and retain serialized short-window duplicate protection, but cannot replay an identity they never supplied.

The existing latest same-brand/treatment 24-hour duplicate classification is preserved, including its paid/confirmed exception. This release introduces no global phone-based appointment deduplication.

## Durable Google delivery

The outbox stores a minimal immutable display projection, without webhook secrets, access tokens or the raw request. Capture and delivery have separate statuses.

- `pending` / `retry`: not yet delivered; definite pre-write failures may retry with backoff.
- `processing`: claimed with a unique, expiring lease.
- `delivered`: acknowledged append or unique stable-ID/phone reconciliation.
- `blocked`: configuration, identity, validation or exhausted retry issue requires action.
- `uncertain`: an append may have reached Google; reconciliation performs reads only.
- `skipped`: the existing duplicate policy or disabled integration intentionally prevented delivery.

Native delivery requires one unambiguous configured destination and an `Omni Lead ID` column. The exact destination and Account/Brand route are pinned before the append intent is journalled. Each attempt checks stable identity and canonical phone before writing; it never overwrites an existing staff row. A source beyond the bounded lookup coverage is blocked rather than treating an incomplete search as absence.

Google `values.append` has no idempotency token. Therefore an ambiguous timeout/5xx cannot safely authorize a blind resend. It remains uncertain; later attempts reconcile by the pinned stable identity. Missing evidence after an ambiguous write stays uncertain. Duplicate identities or a phone mismatch are blocked for review.

An expired processing lease is also reconciliation-only. A final journal failure cannot authorize another append. Updating final status requires the same live lease, so an older worker cannot overwrite a newer result.

The master-only system audit panel exposes aggregate delivery states. Its explicit recheck action reopens only blocked/uncertain rows with no live lease, records the member/job audit, retains the pinned target and append intent, and resets the bounded attempt budget. Rechecking an uncertain write never turns it into an unverified append. Shared-password sessions cannot impersonate a workspace member for this action.

## Release order and rollback

1. After specific rollout authorization, apply the exact qualified additive migration to the intended database. Verify the target function signatures, RLS and grants before deploying any caller; never bulk-apply unrelated historical migrations.
2. Configure the dedicated production `LEAD_DELIVERY_SIGNING_SECRET` and matching encrypted Vault URL/key references. Keep the new recovery job inactive. Preserve the existing daily job and its independent credential.
3. Deploy and verify the matching API, worker and browser source. Check unauthorized/global-token/wrong-path/stale/future requests fail closed and a fresh dedicated proof reaches the bounded worker.
4. Only after the matching deployment is confirmed, enable the reviewed five-minute database schedule. Observe schedule/HTTP status using safe metadata; job enqueue success alone is not delivery success.
5. Verify acceptance, replay and actual delivery in an explicitly authorized controlled campaign, separately from report publication. Monitor blocked/uncertain states before increasing traffic.

The supported application downgrade is a separately qualified **UI-only** artifact retaining the complete new browser/capture/receipt/outbox/worker/event protocol and additive database schema. It is not a switch to the pre-release full application SHA: the old capture writer ignores the new replay receipt contract. See the release ledger for the exact compatible artifact and verification evidence. Retain all accepted records and delivery evidence; never replay an uncertain write through the legacy append path.

Pausing `public-lead-delivery-recovery` stops future scheduled enqueueing only. It does not cancel queued HTTP requests, active leases or per-capture `after()` workers. During the compatible UI downgrade those workers remain on the same protocol and may finish safely. To investigate delivery, observe queued/in-flight metadata and live processing leases without exposing authentication headers; do not call the system fully paused or drained while new capture is still accepted. A full capture shutdown or downgrade to the legacy writer requires a separately implemented and verified maintenance path and is outside this rollout. No deletion of receipts, schema or accepted customer data is a rollback mechanism.

## Verification

`node scripts/test-public-capture.mjs` exercises receipt validation, stable browser identity, actual HTTP validation/acceptance ordering, missing-database rejection, pinned native delivery, identity/phone reconciliation, ambiguous responses, lease fencing and retry exhaustion with isolated providers. It performs no external network or database writes.

The separate PostgreSQL integration qualification verifies atomic rollback, receipt reuse/conflict, duplicate semantics, selection/consent invariants, private grants, delivery claims and recheck behavior. Passing offline tests is not a claim of production rollout or a real customer submission.

## Scheduler authorization boundary

The recovery endpoint accepts a SHA-256 HMAC over `GET`, the exact worker path and Unix seconds, separated by newlines. It accepts proofs at most 60 seconds old and at most 15 seconds in the future, compares the fixed-size signature in constant time and rejects query strings. There is no `CRON_SECRET` or Bearer fallback on this endpoint.

The installed `pg_net` request queue is readable by broad database roles. Therefore the recipe never queues the long-lived signing key or another system's token: it queues only the timestamp and short-lived endpoint-scoped proof. A proof may be replayed only within that short window to dispatch this same bounded queue; existing delivery leases and append reconciliation continue to protect processing. It does not authorize customer data reads or another cron endpoint.

Vault configuration is read and validated freshly at each dispatch. The direct production HTTPS URL must not redirect. HTTP timeout is 65 seconds, allowing the worker's 60-second maximum to complete; a PostgreSQL enqueue success is not proof that the remote request succeeded. Missing/late queued proofs fail closed and the next scheduled attempt can recover. Unscheduling prevents future dispatches but cannot cancel a request already queued or in flight. Retain delivery evidence during rollback; revoke/rotate the dedicated key separately if immediate authentication revocation is required.

`node scripts/test-lead-delivery-auth.mjs` verifies the signing and actual HTTP route boundaries using synthetic keys only. Source preparation is not authorization to create environment secrets, Vault values or schedules.
