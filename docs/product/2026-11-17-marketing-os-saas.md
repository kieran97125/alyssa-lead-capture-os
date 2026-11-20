# Marketing OS product transition

## Product and authority

Marketing OS is the product name. Alyssa is the existing customer workspace. Product identity, platform administration, client membership, customer brands and external-source ownership are distinct concepts. Renaming a deployment or database project does not change customer data ownership or perform a legal company transfer.

Kieran's existing company-email membership remains the customer owner; Winnie remains its manager. Existing staff membership states, brand access, operational roles, source IDs, reporting authority and customer rows are preserved. Legacy owner/master compatibility applies only to customer administration. It cannot pass the platform route or operator gate. The separate platform operator registry uses verified Supabase identity and an atomic subject-binding receipt; personal identity details are configured privately, not seeded into shared source.

The neutral product appears on navigation, login/confirmation, email templates, reports, browser/PWA assets and package/project metadata. Customer campaign brands remain their real brands. Existing domains and campaign URLs remain functional during a separately verified neutral-domain transition.

## Implemented delivery boundary

The control plane contains customer workspaces, separate platform operators, atomic provisioning/identity-binding audit, private login throttles and persistent system cards. Existing members and brands are bound to the first customer. Reserved identities can request a safety-bounded email login; unknown or throttled identities receive the same public response. Customer shared-password compatibility is never platform authentication.

New customer records start as provisioning. The database rejects activation without isolation qualification, and the application currently rejects every additional customer data plane, including an incorrectly flagged record. This gate must remain closed until the following isolation work is complete. Registry presence, a platform page, successful rename or green UI tests are not commercially ready SaaS acceptance.

## Target architecture and modular delivery

1. **Product/control plane**: neutral identity, verified platform operators, customer registry, plans/entitlements, membership, lifecycle, immutable audit and safe invitation. Preserve the established marketing, creative, reporting and acquisition experience.
2. **Tenant data plane**: explicit workspace ownership on every business table and queued job, composite cross-workspace foreign keys, scoped uniqueness and database authorization for server reads/writes and RPCs. Reconcile brand permission with customer boundaries. Remove global first-source, global connection and global reporting assumptions. Namespace caches and receipts. Qualify two customers using the same phone, setting keys and provider-local IDs.
3. **Source/credential ownership**: tenant-owned OAuth credentials, configuration, source schemas and account classification. Public forms and landing pages resolve an explicit verified workspace. Background workers and webhook delivery bind tenant scope before business access. Keep the canonical native writer/accepted appointment state authoritative during staged migration.
4. **Commercial operations**: controlled customer onboarding and suspension, role changes, support-access audit, recovery/export and configurable feature entitlements. Pricing/billing remains a separate product decision; no payment dependency or automatic charge is introduced.
5. **Omnichat ingestion**: a documented provider adapter feeds a durable event inbox, canonical contact/lead/appointment writes and an outbox for Sheet projection. Verify signature format, source attribution, duplicate/late delivery and event availability with the actual vendor account. Do not invent a vendor signature contract or declare it connected from a placeholder endpoint.

The existing project is retained in place. A separate Convelta application or Growth OS Core is not renamed or modified by this transition. Reusable lessons are abstracted through the private Product Learning Log; client data is not copied into Core.

## System cards

| Card | Acceptance |
|---|---|
| MKT-TENANCY | Every business read/write/RPC/public route/cache/job has verified customer scope; independent cross-customer tests and live qualified-tenant readback pass. |
| MKT-ONBOARDING | Customer provisioning, invite/roles, suspension, verified operator login and audit pass; open admission only after the data-plane gate. |
| MKT-OMNICHAT | Vendor confirms actual event/signing/plan contract; real accepted delivery, replay, ordering, attribution and booking qualification pass. |
| MKT-DOMAIN | Company domain DNS/TLS, neutral entry, email confirmation and existing/new callback links verified before canonical-host cutover. |

## Infrastructure and verification

Vercel target remains the original immutable project ID and team; rename metadata only. Supabase retains its project ref, organization, data and credentials. The managed project-name script patches only the name and verifies the same ID/organization. Auth template sync updates product wording through the existing managed configuration path; it does not change signup, MFA, sessions or permissions. Repository naming is independent of customer-source/profile identifiers and historical compatibility URLs.

Qualification includes production build/contracts, TypeScript, focused authority tests, isolated PostgreSQL 17 provisioning/throttle/role tests, Storybook and required design/accessibility screenshots. Hosted names, live customer behavior and platform login are separate actual acceptance boundaries, recorded only after observation. No synthetic customer is activated in production to bypass missing isolation.
