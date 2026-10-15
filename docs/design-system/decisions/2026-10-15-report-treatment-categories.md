# Report treatment categories follow Treatment Performance

- Date: 2026-10-15
- Status: Implemented; hosted release checks required

## Behavior

New manual reports use the native Lead Sheet Treatment Performance categories instead of splitting treatment performance by each offer title. The managed dashboard's evaluated Account-specific classification projection owns matching, category names and rule priority. Report code does not introduce another keyword/regex taxonomy or infer treatments from prices or influencer names. Unclassified items remain in the native unclassified category.

Read the configured workbook's classification projection with metadata bounds, unique header resolution, one column-data batch with repeated headers, no-store requests and the existing managed-read deadline. Only Account, original treatment and evaluated category are read. A missing, malformed, empty or conflicting projection stops generation with a recoverable classification error.

Classify copies of authorized stage-specific aggregate facts before producing report treatment rows and narrative. Existing Account/report-group ownership, dates, totals, daily rows, audit rows, Spend and deduplication remain unchanged. Merged Lead/Book/Show/No Show counts are summed once; ratios are recalculated from those counts. The same classifier is used for the arrival-revenue treatment breakdown, preserving visit identity, monetary authority and closing-rate denominators.

The immutable hashed snapshot records the category contract version and read time alongside the grouped result. Existing snapshots remain compatible. Native table geometry, fonts, colors, editable cells, density/pagination policy and report controls are unchanged; the fewer grouped rows use the approved template's existing layout rules. No shared React component state or visual baseline changes.

## Validation

Synthetic contracts exercise repeated offer variants, Account-specific categories, duplicate projection rows, missing mappings, conflicting mappings, reordered headers, input immutability, authorized scope and dates, weighted ratios, reconciliation with group/daily/audit totals and grouped revenue. Snapshot contracts cover classifier wiring, saved lineage and provider failure. The shared header-read tests cover both financial and classification projections without customer-contact columns.

Private live aggregate facts were grouped with the native classification projection and reconciled against all report-group totals. Resulting Account treatment and revenue slides were rendered and visually reviewed. Private rows, configuration extracts and screenshots are excluded from repository evidence.

Local production build, report contracts, TypeScript, focused lint, design contract and Storybook build passed. Hosted acceptance/design gates are required before release; exact source and release evidence belong to the PR. Existing browser installation limitations do not justify changing screenshot baselines or tolerances.

## Rollback

Revert the report-only classifier, optional snapshot lineage and shared read extension together. Existing saved snapshots remain renderable, the prior financial reader contract remains covered, and no source-data, native rule, schema, permission or template rollback is required.
