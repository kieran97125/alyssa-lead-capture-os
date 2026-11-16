# Public registration reliability — foundation release

## Acceptance and authority

A valid public registration is accepted only after `capture_public_lead_v1` commits the contact, immutable attribution snapshot, lead, **requested** booking, success/consent events, receipt and delivery journal in one database transaction. A requested appointment remains a customer preference, not a CS-confirmed Book. There is no fallback to independent table writes when the RPC is unavailable.

The customer response is independent of Google latency. `after()` attempts queued delivery after the accepted response; the authenticated `/api/cron/lead-deliveries` catches up every five minutes. The production API returns a friendly 503 if database configuration is unavailable. Explicit isolated E2E fixtures retain their non-persistent demonstration response.

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

1. Verify the migration and fixtures against the matching schema; apply the additive migration **before** deploying the new API.
2. Configure the server-owned cron authorization and verify that an unauthorized cron request returns 401.
3. Deploy the matching API/worker/browser release; verify real acceptance and delivery using an explicitly authorized safe staging campaign.
4. Monitor the private status counts and reconcile blocked/uncertain deliveries before increasing traffic.

Rolling the application back leaves the additive receipt/outbox records intact. Do not delete delivery evidence or replay uncertain writes with the legacy append path. The public API and the migration must be treated as one release unit.

## Verification

`node scripts/test-public-capture.mjs` exercises receipt validation, stable browser identity, actual HTTP validation/acceptance ordering, missing-database rejection, pinned native delivery, identity/phone reconciliation, ambiguous responses, lease fencing and retry exhaustion with isolated providers. It performs no external network or database writes.

The separate PostgreSQL integration qualification verifies atomic rollback, receipt reuse/conflict, duplicate semantics, selection/consent invariants, private grants, delivery claims and recheck behavior. Passing offline tests is not a claim of production rollout or a real customer submission.
