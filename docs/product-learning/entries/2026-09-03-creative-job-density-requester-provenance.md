# Creative Job density and requester provenance

## Problem

The operational Job List used generous card and control sizing after the first Creative Production release. With real imported work, rows became visually heavy and managers could not immediately see who created each Job. The requester identity already existed in the database but was not projected as a human name.

## Decision

Creative Job rows use a compact desktop information hierarchy: title and priority first, creator provenance in the supporting line, then brand/designer, production taxonomy, schedule and status. Requester member ID is resolved through the workspace member directory and exposed as `requesterName`; email and system-import labels remain fallbacks. The same provenance appears in the Job detail header.

Toolbar filters, quick views, action buttons, schedule tiles, badges and row delete controls use a smaller but still keyboard-focusable density. The long-form Job editor and creation form keep larger input targets because they are data-entry surfaces rather than scanning surfaces.

## Guardrails

- Creator means the persisted requester/creator of the Job, not the current Designer.
- Existing requester ID and email remain the audit source of truth; display name is a projection.
- Missing requester identity displays a transparent system-import fallback rather than guessing a colleague.
- Compact desktop rows must not reintroduce horizontal scrolling.
- Mobile remains stacked and readable.
- No database migration or historical rewrite is required.

## Classification

- **Core**: creator provenance, separation of creator and assignee, compact operational-list density.
- **Configurable**: exact density tokens, labels and responsive breakpoints.
- **Needs evidence**: future requester filtering or workload reporting should be added only when operations require it.

## Verification

- Production build and Creative Production contract.
- Deterministic compact-list visual baseline.
- Maximum row, create-action and delete-action dimensions.
- Existing create, delete, rich Brief, navigation and mobile acceptance.
- Design/accessibility and full product regression.

## Rollback

Revert the source PR. Stored Jobs, requester identity, Brief versions, assets and audit records remain unchanged.
