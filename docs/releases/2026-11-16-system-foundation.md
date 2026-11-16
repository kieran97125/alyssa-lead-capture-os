# System foundation production release

Date: 2026-11-16 (HKT). **First batch released; controlled production capture, replay, native delivery, cleanup and natural scheduled dispatch passed.** This does not certify future customer conversion or all provider outages.

## Source and qualification

| Boundary | Evidence |
|---|---|
| Production source | PR [#158](https://github.com/kieran97125/alyssa-lead-capture-os/pull/158), merged `489955f7611b9461857d27387fdf043cd318a006`, tree `bd0d60fe6b6442f0028b90f82338767786fe9bda`; qualified application retained. |
| Production deployment | `dpl_9uJgyynKWSSA6J4pDvXA46ghTWR9` READY; intended admin/public aliases verified. Later docs-only changes are not automatically claimed deployed. |
| Qualified application | `ec9de3867555951df70e26dca07e30608e194458`; full application [43803970886](https://github.com/kieran97125/alyssa-lead-capture-os/actions/runs/43803970886), 251/251 passed in 5.3 minutes; PostgreSQL 17 [43803970847](https://github.com/kieran97125/alyssa-lead-capture-os/actions/runs/43803970847); design/build/Storybook/axe/report [43803970860](https://github.com/kieran97125/alyssa-lead-capture-os/actions/runs/43803970860); focused desktop/mobile [43803970907](https://github.com/kieran97125/alyssa-lead-capture-os/actions/runs/43803970907), all successful. |
| Local contracts | Eight foundation programs, including 25 capture and 16 HMAC/HTTP cases, TypeScript and independent boundary review passed. Local Chromium EPERM was not treated as a browser pass; hosted browser evidence supplies qualification. |
| Human visual evidence | Ten new PNGs generated and checked without snapshot updates at implementation `3bbde1ac34799224d6b744a2820766a09856974a`, run `43803391043`; all reviewed. One explained existing CRM baseline approved after expected/actual/diff review; no layout assertions removed. Artifact `14197463036`, ZIP SHA-256 `3218d10ec9027423b2a13253f0c3fb7ab9c4134e3c4e070c7f2824125eb62452`. |
| Exact migration mapping | Source `supabase/migrations/20261116033221_public_capture_receipts_and_delivery_outbox.sql`, SHA-256 `ec218919042a9d06a89cf3b7cca6e64e724c54320121d48c17f9f3413f1e359c`; applied history version `20261116044421`, name `public_capture_receipts_and_delivery_outbox`. Qualified SQL unchanged; source file not renamed to match history. |
| Database readback | RLS enabled on all three new tables; four invoker RPCs; anon/authenticated execution denied and service role allowed; receipt/audit append-only behavior verified. |

## Authorization and activated configuration

The user explicitly authorized rollout and then standing Alyssa maintenance; see `AGENTS.md`. The earlier automatic-review rejection of proposed authentication configuration is historical and no longer a permission blocker. Do not repeat questions for ordinary work already covered by the scoped standing authorization; actual tool restrictions and target/data checks still apply.

Only the dedicated **production** `LEAD_DELIVERY_SIGNING_SECRET` and matching encrypted Vault URL/key references were created; no other environment key changed. An old URL candidate was caught and corrected before activation. The final direct URL targets the production admin `/api/cron/lead-deliveries` endpoint without redirect. No long-lived secret was logged or queued; temporary key material was cleared after secure configuration.

The critical invariant held: exact migration/configuration and matching deployment were verified before scheduling was enabled. One-shot HMAC and controlled capture/delivery passed before initial job 6 activation; pause, guarded cleanup, exact-recipe job 7 resume and natural tick verification followed. The existing daily Vercel source refresh and its credential remain separate. The unsupported five-minute Vercel manifest job was removed; database `pg_cron`/`pg_net`/Vault provide the reviewed recovery schedule.

## Real worker and schedule evidence

Fresh dedicated HMAC dispatch `129220` returned HTTP 200 and an accepted bounded worker result. Unsigned requests, stale proof `129254` and wrong-path proof `129255` returned 401. The proof covers exact GET/path/time, accepts at most 60-second age and 15-second future skew, and has no global bearer fallback.

Actual job 6 was unscheduled and absence verified, then the exact reviewed recipe resumed active job 7 on `*/5 * * * *`. Natural run `275774` succeeded at `2026-11-16T05:05:00.070Z`–`05:05:00.137Z`; matching request `129267` returned HTTP 200 at `05:05:03Z`, without timeout/error. Its result was `ok:true` with no claimed or failed work after fixture cleanup. Enqueue completion and the later HTTP result were checked separately; an empty tick is not evidence of real backlog recovery.

## Controlled production capture and Google delivery

The first private fixture destination was unavailable to the application's Google OAuth account. Two safe pre-append retries occurred, with no append. Its synthetic database records were removed under exact ownership guards.

A **new** isolated qualification brand/form/source then used a separate temporary tab in the official workbook. No pinned delivery was rebound and no existing staff tab was written. Real public acceptance returned 201; exact same-key replay returned 201 with the same IDs; changed business data returned 409; a recent duplicate under a new key returned 429. One contact, snapshot, lead, requested booking, receipt, outbox and three server events were independently verified. Requested booking remains distinct from CS-confirmed Book.

Actual native OAuth delivery appended one controlled row on attempt 1 with expected target/transport. Independent connector readback verified stable identity, phone, brand and account. The original 47 tab identities/titles/order remained unchanged.

Both synthetic database fixture sets were removed under guarded cleanup and verified absent, without live leases, fixture metric/audit-run references or pending outbox work. Before deleting the official temporary tab, its header and sole expected synthetic row were read back; fresh metadata then confirmed the temporary tab absent and all original tab identities/titles/order exactly restored. The header-only private fixture file was removed through the available delete API and metadata returned 404. No existing business rows, source configuration or sharing changed.

Final readback at `2026-11-16T05:09:33Z` confirmed no fixture contacts/forms/brands or capture receipts, no remaining outbox work, only the original global Google Sheet source preserved and the recovery job active. Two existing published LPs returned HTTP 200 with forms present. A real anonymous `booking_confirmed` event request returned 400 `invalid_event_type` before writing.

The final 15-minute error/fatal scan had no grouped request-path errors. Fresh health advisories had no findings. Security retained baseline intentional service-only RLS/no-policy information and the pre-existing `auth_leaked_password_protection` warning; this is not an all-security-warnings-clear claim or an unrelated Auth change.

Sanitized machine-readable receipt: [production evidence](evidence/2026-11-16-foundation-production.json).

## Compatible recovery and remaining boundaries

The source-only UI downgrade is `a30834824eb67c98dd6c9a9cb5bc15e382609714`, tree `ad333aae23f96ad2f52f3f9c106fbeee2e94f6b7`. Exactly seven CRM/system-audit presentation files differ; strict complete reads/fail-closed guards remain. Every capture/browser/worker/event/LP/migration/dependency file is byte-identical by inverse-path diff. It passed TypeScript, default Next 16.2.12 Turbopack build, capture 25, HMAC 16 and independent boundary review. No new restored-presentation UI/visual acceptance or actual downgrade deployment is claimed.

The legacy full source `ed5f0d6aad482158d40d62d934b65bafc74c3214` is an audit reference, **not** a compatible capture rollback. Keep accepted data, receipts and recovery evidence. Unscheduling stops future scheduled enqueueing only; queued HTTP, active leases, per-capture `after()` and manual recheck may still execute. It is not a global mutation pause.

Complete reads retain explicit 25,000-row/20-second bounds and are not a transactional database snapshot; failure is visible rather than a partial total. Uncertain zero-match appends remain unresolved and are not automatically resent; pinned destinations are not silently rebound. FND-010/011 track scalable projections and reviewed exception/rebind operations. Wider metric-generation consistency, UX consolidation and the LP studio remain separate [roadmap cards](../roadmap/2026-11-16-system-foundation.md).

Controlled synthetic production acceptance is not sustained real-customer adoption, a latency guarantee, every-outage recovery or cross-surface reporting parity.
