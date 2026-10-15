# Arrival revenue in the approved presentation

- Date: 2026-10-15
- Status: Implemented; hosted release checks required

## Behavior and layout

The existing editable PowerPoint report gains an arrival-revenue section starting on page 4, immediately after the approved cost page. The first three slides are unchanged. The new section reuses the approved native cost table, theme, fonts, master and footer; no interactive report controls or shared React components change.

Rows show each selected Account followed by its treatment breakdown: trial income, order income, total revenue, orders/attended visits, closing rate and Account ROAS. Account summaries and the overall total are bold. Treatment rows retain their Account label across continuation pages. Text can reduce from 18 to 13 points; larger sets continue on another page rather than overflow. An Account with no monetary entries is omitted. Existing direct PPTX download remains the default.

## Calculation and source contract

- Read only the configured managed register's brand, outcome, actual arrival date, Account, treatment, appointment identity and three monetary fields. Resolve financial columns by their unique headers and verify headers again with the data read. Metadata bounds the read; a shared deadline aborts stalled requests.
- Apply the report's selected Accounts, authorized Brands and inclusive date range to completed arrivals using actual arrival date. Distinct appointments remain distinct visits, including repeat customers. Reject missing/duplicate appointment identity rather than silently duplicate revenue.
- Trial income sums the trial-price field (AF in the current register). Order income sums the order-amount field (AG). Total revenue sums the authoritative total field (AH); only a blank total falls back to trial plus order. Never add the total to its components. Currency aggregates in integer cents.
- An order is a completed visit with order amount greater than zero. Closing rate is order visits / completed visits in that same Account, treatment and period. Blank or zero order amount is not an order. Visits without monetary entries still count in the denominator for an included Account. This is a visit conversion metric, separate from the existing first-Show customer funnel.
- Account ROAS divides total revenue by its existing canonical paid-Spend allocation for the same period. Treatment ROAS and Accounts without allocated positive Spend remain blank. The combined ROAS remains blank if any included Account lacks a comparable paid denominator.
- Save aggregate financial results and source read time inside the existing immutable hashed snapshot. Raw rows, customer contacts and appointment identifiers never enter that snapshot. A failed financial read stops generation with a recoverable error rather than reporting zero.

No spreadsheet write, CS change, date change, outcome change or database migration is involved. Existing Lead/Book/Show counts and cost calculations retain their contracts.

## Evidence

Synthetic contracts cover monetary authority, cents, explicit zero versus blank, repeat visits, date/outcome scope, Account selection, Brand authorization, weighted closing rates, paid attribution, duplicate identity and reordered headers. Live source readback was independently aggregated and Account/treatment sums reconciled without copying private rows into the repository. Snapshot tests verify the selected scope, hashed financial payload and provider-failure behavior.

Native PPTX tests verify byte-identical first-three-slide XML, editable seven-column financial tables, complete long-label continuation, valid relationships, fonts/themes and numbered footers. Rendered synthetic and private aggregate fixtures were visually reviewed at full size: amounts, long labels, title, footer and table bounds fit the approved canvas.

Full production build, report contracts, design-system contract and Storybook build passed locally. The local Playwright design run could not launch because the browser was absent and the vendor download was truncated. Existing visual baselines and tolerances remain unchanged; hosted acceptance and design gates must pass before release. Final source/CI/deployment evidence belongs to the release PR.

## Rollback

Revert this feature's report aggregation, bounded read, optional snapshot field and presentation/text rendering as one unit. Existing saved snapshots remain valid because the financial field is optional. No source data, schema, OAuth scopes, template asset, sharing setting or saved report must be rolled back.
