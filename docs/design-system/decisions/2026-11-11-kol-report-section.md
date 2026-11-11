# Conditional KOL performance in fixed reports

The fixed report includes KOL成效 when its authorized Account selection includes
Alyssa Main. It also includes one segment-performance page for Alyssa Main,
Alyssa Main Medical and Alyssa Main Organic, with separate funnel counts,
recalculated Book/Lead, Show/Lead and Show/Book rates, and income.
A selection of other Accounts never reads the Main source or renders
the section. Existing saved snapshots without this optional field remain valid.

The source-owned `_report_kol_events` projection is independent of shared
Dashboard date and Account controls. Its generated definition is versioned in
`scripts/lead-sheet-kol-report-projection.mjs`. It consumes the existing evaluated
KOL/segment maps and authoritative Lead, Book, Show, No Show and visit-income
dates. It never changes those identities or the main report totals. Inquiry
rows are excluded from the three segment metric totals. Organic stage events
are retained for the segment page and excluded from the KOL-person page. Inquiry
ordinals support the existing latest-in-period selection without transmitting
customer contact details. Only aggregate KOL rows enter the immutable snapshot.

The report reader includes this projection in its existing three-GET read with
one shared deadline, metadata bounds, exact headers and repeated-header checks.
Malformed data fails the Main export before snapshot publication. Other Account
exports retain their existing read contract.

The new editable 11-column PowerPoint table reuses the approved cost slide's
native frame, theme, fills and footer. It adapts column widths and type down to
11 points before pagination. The current operational period fits one page.
Original offer labels remain in the snapshot; the table removes a repeated
leading KOL introduction because the adjacent column already identifies them.
Whole percentages omit redundant decimal zeroes. Long labels continue on native
editable rows with counts shown once. Google Slides receives the same artifact.
PDF and text also consume the same optional snapshot section.
PDF explicitly paginates conservative, bounded text fragments and repeats the
section/table headings; numeric metrics appear only on the first fragment.

## Verification

- All live KOL rows, treatment/offer sets, counts, ratios and revenue reconciled
  against the evaluated operational KOL page for the same selected period.
- Synthetic contracts cover date boundaries, earlier Leads booked in-period,
  latest inquiry across KOL/Organic, same-day source order, empty periods,
  missing/reordered headers, income cents/refunds and non-Main suppression.
- Native XML checks cover editable columns, bounds, pagination, continuation
  integrity and compatibility with the unchanged report template.
- Report contracts, TypeScript, design contract, Storybook and browser gates are
  required before release. Local renders remain private test evidence.
- Deterministic synthetic fixtures render the actual PDF and editable PowerPoint
  through Poppler/LibreOffice. Playwright image baselines cover both new tables
  in both formats and the first/last pages of an oversized PDF offer. The design
  workflow installs these renderers and verifies the snapshots on every report
  change. Approved presentation screenshots use the Ubuntu 24.04 renderer in CI;
  LibreOffice 26 renders native table leading differently. Review and approve CI
  images without widening the pixel-difference threshold. No operational records
  or customer identifiers enter those fixtures.

## Rollback

Revert the application change to remove the optional section and source read.
The hidden additive projection may remain inert or be removed after no released
report reader depends on it. Preserve all original source and operational sheets.
