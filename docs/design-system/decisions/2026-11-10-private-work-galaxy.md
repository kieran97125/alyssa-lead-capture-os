# Private work galaxy

## Problem and behavior

The operator needs a persistent view of relationships between brand operations, acquisition, Creative, CS outcomes, reporting, systems and team coordination. A private work graph at `/workbench` connects those responsibilities to personal Jobs, checklists and the existing operational screens.

The main canvas uses draggable planet nodes, explicit labelled relations and contextual jobs. The existing sidebar shows the entry only for the configured owner principal. Standard Admin and other member identities cannot read the page or its APIs.

## Data and access contract

- One versioned JSON document per immutable owner member, with typed nodes, edges, jobs and bounded activity. It supports atomic graph changes, export and restore without duplicating shared CRM records.
- The server supplies the owner ID; requests cannot choose a different owner. Both document and system-context routes recheck current internal access.
- The current signed Master password principal maps to the configured sole owner. Email-authenticated access additionally requires that exact member ID. Another email-authenticated Master/owner is denied. Anonymous, standard Admin and unconfigured development access are denied.
- The database table has RLS enabled and no `anon`/`authenticated` grants. Only owner-checked server code uses the existing service client. No new browser database privilege is granted.
- Updates compare the persisted revision. A conflict preserves the current tab, reports the conflict and offers export/reload; it never silently overwrites a newer saved document.
- Node/edge/job removal is archival. Undo, archival restore and JSON export are available. Nested checklist edits are local to the editor until Save.
- Account metrics reuse the saved Lead Dashboard service and preserve its source timestamp and availability. Context includes only aggregate L/B/S and bounded titles/statuses for existing Jobs. It does not expose customer-level records or perform Sheet writes, sends, task assignment notifications or background scheduling.

## Component and dependency review

- Reuses `SystemButton`, `SystemConfirmationDialog` and the existing Base UI Dialog primitive. Modal focus/escape behavior remains library-owned.
- Uses scoped canvas colors; shared System control contracts and global tokens are unchanged.
- Adds exact `@xyflow/react@12.10.0` (MIT). Its purpose is maintained graph interaction: keyboard node movement, drag, connections, zoom, pan and mini-map. Direct runtime dependencies are `@xyflow/system`, `zustand` and `classcat`; the lockfile records the resolved dependency graph.
- Graph code is dynamically imported on the private route and does not enter unrelated Dashboard routes. It is a functional graph package; no remote component registry or visual-effect pack is installed.
- Provides populated/empty Storybook stories and dedicated desktop/mobile Playwright snapshots, keyboard/functional checks and axe coverage.

## Verification and limits

Production build, TypeScript, the existing design contract, the new owner/data-model checks and Storybook build pass locally. Database privileges were inspected after migration: RLS enabled, no anonymous/member select/insert/update, server access present.

The execution sandbox cannot launch Chromium because it denies its local socket. Browser qualification therefore runs on the standard hosted CI runner, with fixture data and without production database credentials. Browser evidence and final release status are recorded in the release note after qualification.

Initial operational job content is seeded privately into the owner's document. Unverified conversations remain labelled as requiring confirmation; completed work is retained as completed. Production rows and personal job payloads are not bundled into public source or Storybook fixtures.

## Rollback

Revert the feature commit, or remove the owner environment configuration to immediately deny access and hide the navigation entry. Keep the service-only table and private document for recovery; do not delete the user's workspace as part of rollback. Remove the graph dependency only after reverting its imports and lockfile changes.
