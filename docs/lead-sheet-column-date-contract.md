# Lead Sheet source-column date contract

Contract version: `lead-sheet-column-dates-v1`.

The operational Lead Sheet, its `mkt_dashboard` projection and application reporting use the same source-owned date rules. This contract supersedes the older Created At booking fallback and event-ledger KPI override for these reporting surfaces. The event ledger remains available as audit history; its timestamps do not replace the columns below.

## Metric ownership

The metric contract is independent of physical column order. Both application readers and native dashboard formulas resolve source headers. The governed v6 A:Y layout reorders the first fourteen columns while preserving O:Y; the prior v5 layout remains readable.

| Metric | Date owner | Qualifying row | Selection within one identity |
|---|---|---|---|
| Lead | `Created At` | Any accepted operational row | Earliest valid creation date |
| Book | `最後更新日期` | Follow-up status normalizes to `booked`, `show`, or `no_show` | Earliest valid update date across qualifying rows |
| Show | `確認到店日期` | Follow-up status normalizes to `show` | Earliest valid confirmed-show date across qualifying rows |
| No Show | `預約日期` | Follow-up status normalizes to `no_show` | Earliest valid appointment date across qualifying rows |

`已預約`, `已到店`, and `no show` are the primary operational labels for the three progressed stages. C `跟進狀態` is authoritative whenever it contains a value. Only a genuinely blank C allows legacy S `Status` / T `Show up` fallback. An unrecognized nonblank C does not inherit a progressed legacy status.

A populated confirmed-show date alone does not establish Show without a qualifying Show status. A No Show row can contribute Book on its update date and No Show on its appointment date; it does not contribute Show merely because a confirmed-show date also exists.

A missing or invalid required date excludes that identity from the affected metric unless another qualifying row supplies that metric's valid date. There is no update-to-creation booking fallback. Missing Show dates do not inherit update dates, appointment dates or the event ledger. Missing-date exceptions cannot be assigned to a reporting month until the source is corrected.

## Identity, first touch and dimensions

- Normalize the Account value and group by **Account + phone last eight digits**. Numeric and formatted phone values must resolve to the same identity. A matching phone in a different Account remains a separate identity.
- In the Account-based contract, an absent or too-short phone falls back to source-row identity. Such rows stay separate even when another optional key is repeated.
- Select first touch from the earliest valid Created At across the whole identity before applying a reporting date filter: calendar day, then time of day to the second, then source-row order. Numeric serial dates and text timestamps must share this ordering; equal timestamps use the source row as the deterministic tie-break. If every Created At value is invalid, retain deterministic row selection for dimensions but emit no Lead date.
- First touch owns Account, Brand, Treatment, source, campaign and branch attribution. Later duplicate rows can provide metric dates without moving the identity to another acquisition dimension.
- For Account-based input, explicit `品牌` and `療程項目` remain authoritative. Treatment falls back to `療程 / 優惠`, then `未分類療程`; campaign keywords do not override populated Brand or Treatment fields. Whitespace normalization applies consistently.
- Required Account and Brand mappings must be resolvable before accepting the source. Do not silently drop unmapped rows to make totals agree.

Each identity contributes at most one Lead, Book, Show and No Show across the source history, using the earliest valid date for each qualifying metric independently. An identity may have both a Show and a No Show when separate qualifying source rows retain both outcomes. Counting is based on the rows currently retained in the canonical source, so editing those dates or removing those rows can change the projection.

## Period and rate semantics

Treat dates as source calendar days in the configured reporting timezone. Include the entire end date: native formulas use `date >= start` and `date < end + 1`; application projections compare normalized calendar dates. Do not filter source rows to the report period before deduplication or first-touch selection.

Lead uses acquisition dates while progressed stages use their own source dates. A lead created in an earlier month may therefore contribute Book or Show in the selected month without adding another Lead. Book / Lead and Show / Book are same-period operational ratios, not fixed-cohort conversion rates; a narrow period can produce a ratio above 100%.

## Physical schema compatibility

| v6 column | Header | Prior v5 column |
|---|---|---|
| A | 最後更新日期 | A |
| B | Created At | B |
| C | 跟進狀態 | C |
| D | CS同事名 | E |
| E | 品牌 | D |
| F | 預約日期 | L |
| G | 預約時間 | M |
| H | 確認到店日期 | N |
| I | 客人姓名 | G |
| J | 電話 | H |
| K | 療程 / 優惠 | J |
| L | 療程項目 | K |
| M | 分店 | F |
| N | Email | I |

O:Y retain their existing order, including U `Account`. Moving columns does not change metric ownership: in v6 the physical date columns are B/A/H/F, but the four header names remain the authoritative contract. Source headers must be present and unique; a missing required header must not silently resolve to an unrelated physical position.

## Implementations

- `src/lib/marketing/googleSheetsMetricParser.ts` defines the shared grouping, status, dimension and metric-date rules for live and imported application reporting.
- `src/lib/marketing/leadDashboard.ts` reads the operational source for the live dashboard without applying event-ledger overrides.
- `scripts/lead-sheet-dashboard-formulas.mjs` generates native Sheet formulas for the same contract. It exports `METRIC_CONTRACT_VERSION`, `FACT_HEADERS`, `factsFormula`, `countFormula`, `pendingFormula` and `treatmentFormula`.

The native projection uses a derived `_funnel_metrics` tab:

| Derived column | Meaning |
|---|---|
| A | Account-scoped identity |
| B–D | First-touch Account, Brand and Treatment |
| E–H | Lead, Book, Show and No Show dates |
| I–K | Missing Book, Show and No Show date flags |
| L | First source row |

Write `FACT_HEADERS` to A1:L1 and `factsFormula()` to A2 only after verifying the canonical `lead` input and the destination are ready for the spill range. The generator resolves every source field through `MATCH` against the header row, so the same formula works before and after the v5-to-v6 reorder. `factsFormula(limit, { sourceSheet, headerRange })` optionally targets a synthetic fixture tab or a separate header range; the defaults remain `lead` and its A1:Y1 headers. KPI formulas use E, F, G and H respectively. Missing-date flags describe identities with a qualifying status but no valid date anywhere in their group; they are not additional metric counts. `pendingFormula` applies Account/Treatment filters but cannot apply a date range to an absent date.

The generator uses a bounded source range through row 30000 and matching bounded dashboard reads. Capacity changes must update the facts and consumer ranges together and be verified before source data exceeds the bound. Do not copy derived identity values into public diagnostics or application responses.

## Validation and release evidence

Run the existing meaningful contract checks from the repository root:

```sh
npm run verify:lead-sheet-book-date-contract
npm run verify:lead-audit-contract
```

The date-contract check runs `scripts/test-lead-metric-date-contract.mjs` with synthetic fixtures covering mixed numeric/string dates and phones, cross-period stage dates, first-touch dimension ownership, missing dates, status precedence, no-phone rows, ledger conflicts, end-date boundaries and v5/v6 header-permutation equivalence. Keep first-touch tie and invalid-date cases in the shared conformance suite as the implementations evolve.

Before declaring worksheet/application parity, use the same accepted source snapshot, timezone, start/end dates, Account and Treatment. Compare all four metric totals and their Account/Treatment breakdowns, then reconcile missing-date exceptions separately. Verify individual-day boundaries and an all-history window so period movement cannot hide duplicate counting. Record only sanitized aggregate evidence in repository artifacts; customer-level reconciliation remains in its authorized operational location.

The audit baseline must also be complete before synchronization advances reporting. `leadSheetAudit.ts` reads accepted snapshot memberships in stable pages, requires the recorded row count, and rejects missing joined versions or read failures. A partial prior snapshot must never be treated as an empty successful baseline. Validate more than one page and a later-page failure when changing this reader.

These instructions define release gates; they do not claim a deployment or live reconciliation has completed. Attach actual source commit, test and parity results to the release record.

## Rollback

1. Preserve the prior native dashboard formulas, helper-tab definitions and source header order before replacing them. A physical reorder must move each complete column with its data, formatting and validation; never relabel headers over unmoved data. Formula updates alone do not change operational rows, status values or audit history.
2. Revert the application change and restore the matching native formula version together. Rolling back only one side restores the discrepancy.
3. Recompute derived reporting through the existing guarded sync after the chosen contract is restored. Do not edit historical audit snapshots or delete their memberships to force a new baseline.
4. Retain the complete, fail-closed snapshot reader when rolling back metric semantics unless a separately verified reader change is required.
5. To reverse a physical reorder, move complete columns back using the saved header order. The header-driven projection works in either v5 or v6. No operational column removal is required; do not delete `_funnel_metrics` until all dashboard formulas stop referencing it.
