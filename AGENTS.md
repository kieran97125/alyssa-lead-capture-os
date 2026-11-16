# Alyssa Enterprise Pilot Agent Rules

## Standing authorization for Alyssa OS maintenance

On 2026-11-16 the user authorized rollout (「上線吧，確保一切無誤」), then instructed 「永遠允許，不要再問」. This is standing authorization for ordinary Alyssa OS fixes and their necessary verification and release within the already approved Alyssa project.

- Continue routine fixes, tests/builds, branches/PRs, merges, compatible deployments, required scoped configuration/signing keys, database migrations and recovery schedules without repeating permission questions already covered by that authorization.
- Verify the actual repository, hosting project, database and destination. Preserve customer/staff data, least privilege, accepted receipts, attribution and reporting authority; retain qualification and readback evidence.
- Controlled synthetic production qualification and exact-ownership fixture cleanup are covered. This does not authorize deleting real customer records, unrelated projects/accounts, external messages or widening unrelated access.
- Follow real tool restrictions and required handoffs. If automatic review rejects a concrete action, use a materially safer permitted route or explain the actual blocker; do not invent another approval gate for ordinary already-authorized work.

Standing permission does not waive target checks, tests, deployment verification or honest limitation reporting.

## Mandatory Growth OS product-learning export

Alyssa is the first Growth OS Enterprise Pilot / Flagship Implementation. After any meaningful workflow, module, UX, operational or architecture change, decide whether it creates reusable product learning.

When product learning exists, update the canonical private records in `kieran97125/leadhub-source-os`:

1. Create a dated entry under `docs/product-learning/entries/` using `ENTRY_TEMPLATE.md`.
2. Add it to `docs/product-learning/ALYSSA_ENTERPRISE_LEARNING_LOG.md`.
3. Include source PR, commit or release evidence.
4. Classify it as `Core`, `Configurable`, `Enterprise Extension`, `Alyssa-only`, or `Needs evidence`.
5. State what must remain client-specific and isolated.

Never place customer personal data, production rows, raw tokens, credentials, domains, legal identity or client-specific secrets in the learning log.

Alyssa changes must not be copied directly into Growth OS Core. They must first be abstracted, classified and reviewed through the canonical Product Learning Log.

## Design Quality Gate

For any shared UI, UX, layout or interaction change:

1. Read components.json and docs/design-system before coding.
2. Reuse src/components/system before creating feature-local controls.
3. Use only registries approved by design/registry-allowlist.json; the default is deny-by-default.
4. Do not introduce raw hex colours, recurring arbitrary control sizes or a second component contract inside System components.
5. Add or update Storybook stories for shared components and important states.
6. Add or update deterministic Playwright screenshots when the approved appearance changes.
7. Run npm run verify:design-system-contract, npm run build:storybook and npm run test:design.
8. Record the change, evidence and rollback path under docs/design-system.
9. Preserve Alyssa product direction; do not turn the system into a generic dashboard, generic task app or chatbot wrapper.
10. Treat automated accessibility as a floor. Keyboard, focus, hierarchy, density and human visual review remain mandatory.
