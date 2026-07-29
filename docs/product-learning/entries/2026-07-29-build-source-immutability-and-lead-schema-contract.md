# Build-source immutability and public lead schema contract

- Date: 2026-07-29
- Source project: Alyssa Enterprise Pilot
- Module: LaunchHub / Lead Capture / Release Engineering
- Status: Hotfix validated; production release pending
- Classification: Core + Configurable

## Real operational problem

Production builds were applying text-based source rewrites immediately before compilation. Repository review and CI could therefore inspect one source tree while the deployed artifact ran another. An ambiguous replacement inserted an observability-only trace identifier into a database insert even though the target table had no such column, causing public lead creation to fail.

## Tested implementation

- Materialised the required generated behaviour into reviewed application source.
- Removed build-time source preparers from the production build and deleted the legacy mutation scripts.
- Added a TypeScript-AST contract gate that inspects the actual `leads.insert()` object.
- The gate rejects unknown columns, missing required fields, dynamic insert payloads, trace leakage into the persistence row, missing success-response trace IDs, and any return of source preparers to the build command.
- Matched the contract whitelist against the live production table definition.
- Added structured server-only database error logging with the attribution trace ID.
- Verified the new source against the previous generated production artifact; non-route application behaviour remained byte-identical.
- Verified that a production build leaves the source diff hash unchanged.

## Reusable abstraction

1. A production build must compile reviewed source, not mutate source.
2. Persistence boundaries need executable column contracts close to the route that writes them.
3. Observability identifiers belong in logs, event payloads and API responses unless they are explicitly migrated into a persistence schema.
4. Release gates should compare source state before and after a build.
5. When generated behaviour already exists in production, materialise and parity-check it before removing the generator.

## Client-specific elements that must remain isolated

- Form identifiers, brand configuration, package and branch mappings
- Production customer submissions and recovery handling
- Database credentials, runtime logs, domains and deployment identifiers

## Product classification reasoning

- Immutable build inputs, schema-contract tests and structured persistence errors are Core release-engineering capabilities.
- Table names, required-column sets, response telemetry and release-gate policy are Configurable.
- No Alyssa customer data or brand-specific workflow belongs in Growth OS Core.
