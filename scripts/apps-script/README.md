# Bound Lead automation

`lead-bound-automation.gs` is the reviewed source for the spreadsheet-bound Lead 工具 automation. It preserves the existing menu and trigger handler names. It resolves operational fields from row 1 and supports the original 24-column layout, the 25-column layout with CS owner, and the reordered `lead.v6` layout. Missing or duplicate required headers stop the edit before row mutations.

Deploy by replacing the existing bound project source and saving it. Existing triggers use the saved code; the column migration does not require running the installer. This script has no `doPost` handler and is not the legacy webhook receiver. It never rewrites the master formula, dashboard formulas, or operational headers.

Changing follow-up status updates the last-updated date and audit ledger as before. It does not fill or overwrite the confirmation date or appointment date. Sorting includes all populated columns so trailing provenance remains attached. Existing event headers and event identities remain unchanged. Treatment rules accept historical I/J, J/K, current K/L and semantic header labels.

Run `node scripts/verify-bound-lead-automation.mjs` for the synthetic Apps Script regression suite. It checks field identity across all three layouts, status date preservation, treatment mappings, event deduplication, provenance sorting, fail-closed header validation and safe menu/installer behavior without accessing a live spreadsheet.

Before rolling back to older positional script source, restore the matching spreadsheet layout as well. This header-resolved source can remain in place when reversing the column order.
