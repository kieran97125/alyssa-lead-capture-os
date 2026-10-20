# Treatment Performance technical categories

The native `mkt_dashboard` previously grouped the source treatment/offer text. Price, campaign, KOL and emoji variants therefore produced separate rows for the same technical item. The 2026-10-07 configuration groups **Account + source Brand + reporting category**. Operational treatment text and ownership remain authoritative.

## Configuration and projection

- `療程項目!G` is the short Dashboard category. `J` contains the account-scoped technical regular expression; `K` is priority (lower first, physical rule row breaks ties). `A` enables the rule and `B` scopes it to an Account. `L2` is a dynamic category dropdown list, including All and 未分類療程.
- Existing source-mapping keyword/output columns E/F remain intact. Additional reporting-only rules have E blank, so the bound automation ignores them for operational item/Brand rewriting.
- `_dashboard_treatment_map!A:E` caches unique Account + Brand + raw-treatment dimensions from the source and existing stage projections. It evaluates technical expressions once per unique dimension, then exposes an exact lookup key and category. No phone/customer data is required.
- Reporting category vectors are appended to `_funnel_metrics!M`, `_dashboard_book_dimensions!F` and `_arrival_pending_metrics!H`. Existing fact A:L, first-Book A:E and pending A:G contracts are unchanged. The application still reads the bounded raw A:L fact contract.
- The Treatment Performance formula and 41 other dashboard filter formulas use these vectors. The treatment selector uses the category list; current cancellation filtering also resolves the same reporting category. User-selected dates and Account are preserved.

Lead, Show and No Show still use their existing deduplicated fact dates/dimensions. Book still uses the last-update event date and first qualifying booking Brand/treatment. Changing a category does not combine identities across Accounts or move records between Brands.

Known technical aliases consolidate (for example XEOMIN, JULÄINE, Belotero, SlimCut and Facelift/Face Pilates). Explicit composite offers take priority over a single technology. Price or KOL name alone does not establish technology. Generic slimming/facial items remain 技術待確認, and unmatched items remain 未分類療程.

## Maintenance

New source items automatically enter the dynamic map and category vectors within the existing 30,000-row source bounds. Matching variants use the enabled Account-scoped rules. Unsupported new technologies remain visible under 未分類療程 until an operator adds a reporting expression/category in J/G/K. The hidden map currently has capacity for 4,999 unique dimensions; expand its grid before that capacity is reached. Rules are bounded at row 1,004, including dropdown categories.

This configuration adds formulas to the existing workbook. It neither triggers an application refresh nor changes the managed synchronization implementation. No provider-latency improvement or application technical-category parity is claimed by this change.

## Evidence

Native Google Sheets calculation and independent aggregation were reconciled for the existing selected period, 2026-10-01 through 2026-10-31, All Account / All treatment:

- 328 unique source/stage dimensions matched the independent classifier.
- 46 raw-name performance rows consolidated into 35 Account/Brand/category rows; every resulting stage count matched independent aggregation.
- Lead / Book / Show / No Show remained **179 / 35 / 12 / 2**. Current pending remained 16; cancel/reschedule/undated exceptions remained 4/0/1.
- 14 temporary native cases, including future offer text, composite precedence, wrong-Account and price-only inputs, passed and were removed afterwards.
- The production KPI formulas were evaluated against separate temporary selector inputs without changing the user's live selection. XEOMIN: All 23/3/1/1, Account Alyssa Aesthetics 19/2/1/1, Account Alyssa Medical 2/1/0/0. SlimCut＋AI追脂: All 17/3/1/0.
- Native dropdown validation/list and browser presentation were checked. Local focused verifier: `node scripts/test-lead-treatment-categories.mjs`; module syntax check passed.

These are point-in-time aggregates, not historical records to import into the application or a performance benchmark.

## Recovery

Read current native formulas and selectors before any repair. `scripts/lead-sheet-treatment-categories.mjs` supplies guarded summary/exception migrations plus category-map/vector generators. Unexpected formula schemas must stop rather than overwrite operator changes.

To reverse this reporting layer, restore the prior dashboard treatment-column references (fact M → D, first-Book F → D, pending H → D), restore the prior raw-treatment selector and summary indices (13 → 4 and 6 → 4), and restore the prior cancellation treatment expression. Reconcile all stages and ownership before removing the appended vectors or map. Keep existing source E/F rules, operational items and provider contracts intact. Do not delete the category cache while dashboard formulas still reference it.
