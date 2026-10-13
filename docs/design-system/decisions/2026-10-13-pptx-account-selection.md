# Direct PowerPoint download with Account selection

- Date: 2026-10-13
- Status: Implemented, validation in progress

## Behavior

The reporting form defaults to PowerPoint and downloads the approved editable series deck directly. PPTX requests return an authenticated attachment with the proper MIME type and snapshot headers. Neither the report page nor the PPTX delivery path requires Google OAuth or checks a Drive folder. Explicit legacy Google Slides API requests retain the existing separate delivery path.

Operators can select multiple authorized Accounts with labeled native checkboxes. The existing SystemButton continues to own submit behavior. A fieldset groups the Account choices, keyboard Space toggles them, no selected Account disables generation, and errors remain visible beside the form.

Server normalization rejects empty, malformed or unknown selections. The server revalidates Account authorization, intersects the chosen Accounts with authorized Brands, filters the persisted stage-specific aggregate facts, and applies the canonical Account-to-Spend Brand mapping. KOL-only scope cannot inherit paid-ad Spend. All period totals, comparison totals, daily rows, treatment rows, series groups and audit rows consume the same filtered data. The selection is stored inside the immutable hashed snapshot. Excluded series groups and treatment pages disappear; an unselected slot on a paired daily page contains no counts.

## Validation

Report contract, Account selection, approved-template rendering and authenticated download suites cover direct PPTX delivery without Drive, empty/unknown/unauthorized selections, brand intersections, current/comparison isolation, reconciled daily/group totals and KOL Spend isolation. Storybook includes the default download and restricted-brand composition. Desktop/mobile Playwright stories cover KOL deselection, keyboard generation, observed browser download, error/empty states and accessibility. Local and CI execution results are recorded with the release.

## Reusable learning

Classification: Configurable. Artifact delivery destination and Account selection should be independent of approved rendering and fact construction. Templates, Account aliases, reporting groups, authorization and spend ownership stay client-specific. Canonical private learning is required before Core adoption.

## Rollback

Revert this change as one unit: form/page, API download routing, Account snapshot/series scope, PPTX selected-group pages and related tests/baselines. No migration or Google sharing change is involved. Existing immutable snapshots remain intact.
