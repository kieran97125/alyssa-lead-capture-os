# Acquisition management — 2026-11-16

## Product outcome

Staff can create a website registration form or a connected landing page from one guided flow, identify the form's intended location, update its offer and branches, preview a saved page, publish explicitly, and archive or restore assets without breaking their public identity.

The canonical entry is the acquisition catalogue at `/campaigns`, with registration forms and landing pages presented together. Form placement labels describe intended usage. They do not claim that a Wix site is connected, that code is installed, or that a real submission has synchronized.

## State and persistence contract

| Asset or command | Result |
| --- | --- |
| New form | Active, revision 1, stable public token; ready to place |
| Ordinary form save | Same ID and public token; current status preserved |
| Form archive | Existing customer records retained; new registrations blocked |
| Form restore | Active catalogue selections checked; legacy default normalized only within existing explicit choices before activation |
| Form delete | Transactional; rejected when registrations, receipts or landing-page references exist |
| Form duplicate | New identity; one result per stable request UUID |
| New landing page | Saved private draft with its first version |
| Draft save | Metadata, content and images are saved as one version; published snapshot remains unchanged |
| Publish | Explicitly promotes a validated saved snapshot under revision control |
| Creation retry | Replays the accepted result for the same operation UUID and business payload; changed payload is rejected |
| Stale editor | No overwrite; asks staff to reload |
| Database or complete-read failure | Acquisition reads unavailable; no production seed substitution or success claim |

Form creation/update and branch/package membership commit in one service-only, invoker-rights database function. Compound form + landing-page creation wraps both domains in one database transaction, so failed page creation leaves no orphan form or accepted creation receipt. Current staff brand access is checked before server calls; SQL validates treatment, offer and branch membership independently.

Existing forms receive `placement_kind = unspecified`; no Wix usage is inferred. The optional placement URL accepts HTTP(S), excludes credentials and contributes its origin to the permitted website list. Landing-page forms include the configured public origin. Public token and identity remain stable after rename or offer changes.

## Connections and synchronization

Installed embed code uses the stable form token and reads current server configuration. Offer values, conversion mode and success destinations are not frozen into new snippets. Successful form and underlying configuration changes expire the shared public-form cache immediately; successful and terminal reads otherwise cache briefly, while transient failures are not cached.

The catalogue's registration and delivery activity comes from actual leads and the delivery outbox. Missing data availability is distinct from a valid zero. A placement label or copied snippet is never presented as proof of a working website installation.

The lead-monitor retirement included in this phase removes the old staff-facing monitor route and controls while retaining authorized background synchronization and recovery responsibilities. Existing reporting and historical customer records remain authoritative.

## Quality and tooling

React Hook Form 7.92.0 and `@hookform/resolvers` 7.0.6 were added for guided creation and settings editing, using the existing Zod 4.6.7 contract. They provide field validation and preserve inputs after a failed operation. Existing System components remain the UI contract; no additional UI kit was introduced.

### Database order

1. Existing deployed capture migration: `20261116033221_public_capture_receipts_and_delivery_outbox.sql`.
2. `20261116053511_managed_form_integrity.sql`.
3. `20261116053718_landing_page_version_integrity.sql`.

Both acquisition migrations are additive. Operation receipts are private and append-only for the service role. Each editor submits the revision it read; database locks and compare-and-set checks serialize competing operations.

### Qualification commands

- `npm run verify:acquisition-management` — scoped validation, configuration-read failure handling, embed synchronization, monitor retirement and acquisition helper contracts.
- `npm run build` — includes acquisition verification and existing project checks.
- `.github/workflows/acquisition-qualification.yml` — PostgreSQL 17 on isolated synthetic schema, real RPC role/transaction/lifecycle tests and competing sessions.
- UI, keyboard, accessibility and deterministic screenshots are qualified by the acquisition Playwright suite and the design workflow maintained alongside this change.

Database assertions cover parent/child rollback, archived-save behavior, stale and missing revisions, identity retention, replay and changed-body conflicts, cross-brand selections, inactive references, in-use deletion, truthful empty activity, version ownership, saved-draft preview, explicit publication, compound-create rollback and simultaneous requests. Test fixtures are synthetic and guarded to an isolated database name; none are application records.

## Evidence and release gates

| Evidence | Status / reference |
| --- | --- |
| Managed-form Node behavior suite | Passed locally: `node scripts/test-managed-form-management.mjs` |
| Combined acquisition Node suites | Passed locally: all six suites, including actual public-form runtime |
| Type check | Passed locally: `npx tsc --noEmit` |
| Production build | Passed on exact PR head in all required hosted application/design workflows |
| Migration and behavior transaction suites | Passed PostgreSQL 17 qualification `43818603494`; both additive production migrations applied and read back |
| Concurrent-session qualification | Passed in acquisition qualification `43818603494` |
| Desktop/mobile/accessibility screenshots | Passed Design `43818603524` and Acquisition Visual `43818603484`; ten acquisition screenshots visually reviewed |
| Release commit / PR | PR #159; `890216ffc074ec4fee2c87d5c10cd21197bc8fa4` |
| Production migration readback | 23 forms, seven pages, 26 versions retained; version metadata, receipt RLS and service-only invoker privileges verified |
| Production deployment and route readback | `dpl_FNptGsbU5xZSFMoXN956dczhxR7v` READY with intended aliases; authenticated operator readback awaits a connected staff session |
| Canonical Growth OS product-learning export | Pending sanitized classification and source evidence |

Pending means unverified; it is not a passed gate. The release owner replaces these entries with actual run, commit and deployment evidence.

## Rollback and operational recovery

The previous deployed application can remain available while the additive migrations are applied. During a release issue, restore the prior application deployment and retain the new columns, immutable receipts and customer data. Do not reverse database state by deleting receipts or customer records. The acquisition editor should remain unavailable when its required database contract is missing or unreadable.

For a failed creation, retry the unchanged request identity to resolve an accepted response. For a revision conflict, reload and review the current settings before submitting a new operation. Archive a used form rather than trying to remove its historical references.

Reusable product learning belongs in the canonical private Growth OS learning log after abstraction and classification. Client identifiers, domains, access credentials, public tokens and customer/staff data must remain isolated from that export.

Production release and remaining native/operator acceptance are recorded in [the takeover release ledger](../releases/2026-11-16-acquisition-production.md).
