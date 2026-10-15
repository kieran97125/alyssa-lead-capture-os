# Brand-owned visit revenue across reports and the native dashboard

- Date: 2026-10-15
- Status: Implemented; hosted release checks required

## Behavior

The revenue page retains its Account total and adds explicit Brand subtotals and their treatment rows when an Account contains several reporting Brands. The mixed Account always exposes its medical Brand separately. Brand comes from the authoritative arrival register, never an inference from a treatment name. Categories remain owned by the native treatment map. Existing selected-Account scope, access checks, date ownership, appointment identity, AH monetary authority, cents arithmetic and visit-based closing denominators remain intact.

The approved editable seven-column revenue table now labels its first column Account/Brand/treatment. Existing pagination and typography fit the longer hierarchy. First three slide XML, theme, embedded fonts, masters and layouts are unchanged. Optional Brand rows and financial return fields preserve old immutable snapshots. Presentation and text share one display hierarchy. Accounts/Brands/treatments without any monetary entry are omitted; entered zero remains valid. Unentered visits remain in the applicable closing denominator.

The native marketing dashboard adds an adjacent financial block in K21:T. It uses the existing date, Account and technical-category controls without changing them. Separate Account/Brand summaries and treatment detail show trial income, order income, total revenue, orders, visits and closing rate. Positive matching Brand-level paid Spend enables ROAS and advertising ROI. Treatment return columns stay blank because the ledger has no treatment allocation. A treatment filter also suppresses whole-Brand cost and return values. Advertising ROI is (Revenue - Ad Spend) / Ad Spend, not margin after treatment/operating costs; a header note states this scope. Empty selections produce no financial block.

## Data and publication boundary

A hidden formula projection reads completed arrivals and the existing technical-category map. It changes no operational fields, CS ownership, dates, outcomes, amounts or Lead/Book/Show calculation. Monetary fields resolve by header. Repeated visits retain distinct appointment identities; missing/duplicate completed identity rejects the financial projection. The capacity is bounded and preserves future row growth.

A separate hidden installed-only Spend projection receives the canonical system ledger, grouped by day/Account/Brand in integer cents across all channels. Only dates, canonical labels and amounts are exported. Runtime writes require exact headers and a version marker; no unknown destination is created or overwritten. Replacement clears stale owned values and writes a complete replacement in one provider batch, including an update timestamp. Provider calls share a bounded signal and read errors do not publish partial ledgers. No new dependency or database schema is required.

After a successful authorized Lead refresh or committed Spend save, the application refreshes this installed projection. Export failure is explicitly reported as a financial refresh warning; it never reclassifies a completed Lead refresh or committed ledger save as failed. The previous Spend projection is retained when provider publication fails. Its timestamp remains visible. Native revenue continues to follow source amounts directly.

## Evidence

Report contracts cover mixed-Brand treatment labels, per-Brand paid denominators, preserved Account totals, weighted closing rates, explicit zero versus blank, immutable snapshot compatibility and editable hierarchy rendering. Projection contracts cover cents, canonical allocation, exact destination ownership, one-batch replacement, data minimization, absent installation and provider/database failure isolation. All-staff refresh checks retain permission boundaries and confirm a financial-export warning cannot produce a false Lead-sync failure.

Private native formula readback reconciled Account/Brand and treatment amounts, visit counts and closing rates against the application aggregation. Native all-Account QA used a hidden scratch area rather than changing live operator filters. No-entry selection and filtered-treatment returns are checked independently. Rendered medical/mixed revenue pages fit the approved canvas. No customer data or native financial extracts are included in repository evidence.

Local build, TypeScript, focused lint, report contracts, design-system contract and Storybook build are required. Local browser installation remains unavailable; hosted acceptance and design checks must pass before release. Native visual verification uses source/effective formatting metadata where the browser is signed out. Exact release evidence belongs to the PR and private learning log.

## Rollback

Revert the report model/display changes and the optional Spend-export hooks together. Clear only the authored dashboard financial block; remove its formula projection and Spend projection after recording their owned version. Do not restore whole operational rows, reset filters, change staff cells, remove any source amounts or roll back the ledger. Existing financial report snapshots remain renderable.
