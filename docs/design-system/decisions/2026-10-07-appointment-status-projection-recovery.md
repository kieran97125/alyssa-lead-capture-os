# Saved appointment counts and concise source status

## Problem and behavior

A successful managed refresh published complete per-customer appointment exception data, but two reporting adapters dropped its `current-appointment-v1` marker. The shared summary interpreted the missing marker as unavailable and displayed em dashes for cancellation/reschedule. Source audit warnings also generated a generic paragraph about checking the last sync even after successful publication.

Preserve the marker through aggregation and snapshot publication. After authenticated payload decryption and full saved-group validation, recover an omitted marker only for nonempty data with the additive appointment-status field on every group. Partial legacy data and empty snapshots without explicit authority remain unavailable. A complete validated zero displays zero. This recovery is read-only and needs no new reporting sync or persistence rewrite.

Remove the user-requested generic source-status paragraph from valid saved Dashboard data. Retain successful data timestamps, actual refresh-result feedback and specific excluded-data diagnostics. Source errors still retain last-good data; no source status or business record is fabricated or cleared.

## UI and tool boundary

Reuse the existing LeadDashboardPanel, AppointmentStatusSummary and SystemDetails. No new component, colors, layout or dependency is introduced. React, Base UI, Storybook, Playwright and axe are already installed. Add the successful-with-audit-warnings story and desktop/mobile fixture states. Both must match the existing verified-empty goldens, show numeric zeroes and omit the generic paragraph; existing unknown and previous-failed-update cases remain intact.

## Evidence

Tests cover aggregate-to-publication authority propagation, encrypted full/partial/empty compatibility reads without writes, cancellation numbers after recovery, genuine unknown data, failure retention and Account/Brand/date permissions. Local recovery/Book/saved-store tests, focused lint, design contract and Storybook build pass. Hosted production build, CRM acceptance and visual/accessibility gates are required before release. Read-only native reconciliation supplies current cancellation/reschedule totals; no customer records enter this decision document.

## Rollback and isolation

Revert the code commit. Additive markers are ignored by prior versions; no data migration or operational Sheet edit occurs. Reverting compatibility recovery returns omitted-marker snapshots to unavailable. Snapshot encryption, source/run/config binding, owner checks and metric definitions remain mandatory. Canonical product learning must record the adapter-propagation and narrow reader-compatibility pattern separately from any Growth OS adoption.
