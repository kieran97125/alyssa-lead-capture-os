# Acquisition production rollout

Date: 2026-11-16 (HKT).

## Released boundary

PR #159 merged as `890216ffc074ec4fee2c87d5c10cd21197bc8fa4`. Production deployment `dpl_FNptGsbU5xZSFMoXN956dczhxR7v` is READY on that exact commit. The intended administration and public aliases are assigned with no alias error.

The release unifies forms and landing pages in a guided acquisition catalogue, separates draft save/real preview/publication, provides compact current-configuration Wix installation and removes noisy Lead row-change monitoring. Existing operational synchronization and delivery recovery remain separate capabilities.

## Qualification

Exact source `17c533792e1309c189b110015561ac531484897c` passed all six hosted workflows: CRM Playwright `43818603501`, Design Quality `43818603524`, System Foundation `43818603496`, Acquisition PostgreSQL/concurrency `43818603494`, Foundation Visual `43818603482` and Acquisition Visual `43818603484`. Ten acquisition desktop/mobile screenshots were visually reviewed; the integrated workflow also passed existing attribution and receipt conversion compatibility without blanket snapshot updates.

Both additive migrations, `managed_form_integrity` and `landing_page_version_integrity`, were applied to the verified Alyssa database. Independent readback retained 23 forms, seven pages and 26 versions, with complete version metadata and no preflight published-version ownership mismatch. Receipt RLS is enabled. All four acquisition RPCs are security invoker, executable by service role and denied to anonymous/authenticated callers.

The normal authenticated operator session became unavailable during this takeover; a separate browser reached the expected invited-account sign-in boundary. No real-customer form mutation or authenticated post-release editor action is claimed. Hosted behavior acceptance, schema readback and READY/alias evidence remain distinct from that remaining operator observation.

## Native synchronization cards

The prepared native source and expanded regression command are separate from this deployed application release. All existing and added offline native suites passed on the candidate, including cancellation/rebooking ownership, manual checkpoints, localized time, queue allocation, read-only diagnostics and governed orphan-binding recovery.

| Card | State | Next acceptance |
|---|---|---|
| SYNC-001: current missing bookings | Pending fresh native repair | Re-read current sources/registry/queue, use the governed writer, independently read back and verify an idempotent repeat. The earlier nine-record observation is not a current repair receipt. |
| SYNC-002: native manual-sync release | Prepared; not installed by this takeover | Compare copied live sources, retain localized time and extra live files, qualify real native reads, then save/read back the reviewed source and run the normal control. |
| SYNC-004: formula-driven master coverage | Current formula inspected; bridge/source-tail parity pending | Independently verify current bridge bounds and source/history coverage; a successful native receipt alone does not establish master freshness. |
| OPERATOR-001: authenticated acquisition readback | Login boundary observed | Reuse an authorized staff session and inspect the released catalogue/editor without creating customer enquiries. |

The actual read-only native probe began at 19:34:56 HKT and emitted its native-queue phase start; the browser connection then stopped returning observations. No terminal probe receipt, performance improvement, native repair or native production deployment is claimed.

## Recovery

Application rollback retains additive schema, immutable receipts and customer history. Never revert by deleting accepted registrations or versions. Native rollback uses exact pre-change source backups, preserves additional live files and retains accepted appointment/queue/history ownership. Uncertain writer outcomes must be resolved through existing journals before retry; direct business-row appends are not a substitute.
