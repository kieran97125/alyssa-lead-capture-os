# Bound Lead automation

`lead-bound-automation.gs` is the reviewed source for the spreadsheet-bound Lead 工具 automation. It preserves the existing menu and trigger handler names. It resolves operational fields from row 1 and supports the original 24-column layout, the 25-column layout with CS owner, and the reordered `lead.v6` layout. Missing or duplicate required headers stop the edit before row mutations.

Deploy by replacing the existing bound project source and saving it. Existing triggers use the saved code; the column migration does not require running the installer. This script has no `doPost` handler and is not the legacy webhook receiver. It never rewrites the master formula, dashboard formulas, or operational headers.

Changing follow-up status updates the last-updated date and audit ledger as before. It does not fill or overwrite the confirmation date or appointment date. Sorting includes all populated columns so trailing provenance remains attached. Existing event headers and event identities remain unchanged. Treatment rules accept historical I/J, J/K, current K/L and semantic header labels.

Run `node scripts/verify-bound-lead-automation.mjs` for the synthetic Apps Script regression suite. It checks field identity across all three layouts, status date preservation, treatment mappings, event deduplication, provenance sorting, fail-closed header validation and safe menu/installer behavior without accessing a live spreadsheet.

Before rolling back to older positional script source, restore the matching spreadsheet layout as well. This header-resolved source can remain in place when reversing the column order.

## CS phone search (v1.6)

Reload the spreadsheet after saving the bound source, open an Account tab, then choose **Lead 工具 → 搜尋電話移到底部**. Enter a complete phone number or its last eight digits. The command searches only the current operational Account tab, groups every matching whole record at the end of populated data, preserves the relative order of both matching and other records, and selects the result for editing. Filters remain in place; a filtered-out result may need the filter cleared manually. Master, history, helper and dashboard tabs are rejected.

Search does not change Created At, last-updated, appointment, confirmation date, status, treatment, or event ledger. A later manual status edit still follows the existing automation. Invalid input, cancellation, no match, a changed active tab or an unavailable lock leave records untouched. An already-bottom group is only selected. The UI prompt precedes the document lock, and alerts run after release.

The implementation deliberately uses one native full-width range sort with unique temporary keys, then removes the temporary column in `finally`. It includes hidden trailing columns and retains cell notes, formats and validations. It does **not** structurally move rows: a native synthetic fixture demonstrated that `moveRows`/`moveDimension` can shrink external bounded source ranges when their first row moves, breaking the master and duplicate-phone cache. Range sorting kept those references and conditional-format rules unchanged. Row heights and hidden-row positions are sheet layout, not record fields.

Validation: the synthetic VM suite covers all three header layouts, stable grouping, same-date first-touch ordering, complete record metadata, cleanup/error paths and menu safeguards. A native seven-row synthetic sheet verified the full-grid case, exact cell metadata, external array/count formulas and unchanged conditional formatting. This validates the sorting operation; it does not establish that the bound UI source has been deployed.

Rollback for this feature: restore the v1.5 bound source and reload the sheet. No installer run or trigger change is required. Any already-grouped records remain in their current order; their dates and values are unaffected.
