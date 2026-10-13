# Report scope is selected by Account

The report form now asks for dates and Account selection. It removes the Brand
filter and its explanatory paragraph, retaining the existing Account checkboxes,
SystemButton, output formats, pending/error states and empty-selection guard.
Desktop dates occupy two columns; mobile retains the existing single column.

An explicit Account selection includes all authorized Brands present in that
Account's facts. Facts are loaded for authorized Brands before Account filtering;
configured default Brand membership cannot truncate a moved or mixed-Brand Lead.
A stale Brand filter sent by an old client is ignored when Accounts are selected.
Existing Brand permissions still apply. Spend remains attributed by its configured
paid Account mapping, with no cost assigned to a KOL-only selection.

Validation: Account-selection contracts include both Aesthetics brands, stale
filters, a production-query fixture with multiple Brands under Main, authorization
and Spend isolation. Storybook exposes default and single-Account states. Updated
desktop/mobile screenshots cover keyboard selection, direct download, empty
selection and server error recovery, with axe accessibility checks.

Rollback: revert this form, scope resolution and associated fixture changes.
Stored immutable snapshots retain their exact original selection and totals.
