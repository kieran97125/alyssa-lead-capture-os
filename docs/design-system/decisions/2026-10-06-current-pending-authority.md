# Current pending appointment authority

Historical Lead/Book/Show/No Show dimensions remain unchanged. Pending arrival is a current appointment projection with its own current brand/treatment and scheduled day; the KPI, dimensions, trend, permission filtering and detail list now consume the same projection. A prior outcome does not prevent a later active rebooking.

Existing System controls, layout, interactions and visual states are reused without appearance changes. No stories or approved screenshots change. Versioned encrypted snapshots reject older pending semantics, incomplete source/registry binding, and malformed pending relationships; deployment requires one protected manual refresh to initialize the new snapshot.

Validation: production build and existing design contract/Storybook build pass locally; current appointment behavior, scopes, permissions, facts, trend and corruption cases execute real modules against synthetic fixtures. Hosted Chromium/design gates and populated production refresh remain release gates.

Rollback: revert this App change to the previous manual-refresh release while retaining independent outcome authority. Earlier v1 snapshots remain stored; never reset historical source data, clear audits, or change authorization/trigger installation to roll back the App.
