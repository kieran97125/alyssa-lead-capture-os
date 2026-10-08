# CS + AD report series template

`cs-ad-series-v1.pptx` is the approved report series template. All generated series reports use this one asset.

Version: `cs-ad-series-v1`.

Approved source SHA-256: `03d0d17c81c0b963128211ba211e5da08209e4d3cadeba76a8c78c7819c656d3`.

The asset preserves the approved 18-slide order, native editable tables, embedded fonts, slide dimensions, layouts, colors and typography. Expense, cost and brand performance remain pages 2, 3 and 4. Data values, periods and page numbers are placeholders. Source notes and document metadata have been removed.

The generator fills the existing shapes and tables in place. Dynamic rows use their original styles. It must never rebuild this design with a separate slide renderer.

To regenerate the sanitized asset, pass an explicit copy of the approved source deck to `node scripts/prepare-report-series-template.mjs <approved-source.pptx>`. The command validates the source digest, strips source data and metadata, and verifies that editable geometry and formatting remain identical.
