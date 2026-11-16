# CRM outcome queues, Hong Kong dates and brand connection state

## Behavior

The appointment workspace now keeps completed appointment outcomes in its base set before applying the selected queue. A No Show case can therefore appear under **未到店**, while pending-result queues remain restricted to booked appointments whose confirmed time has passed. Cancelled appointments show **已取消**, rather than a pending-follow-up result.

CRM queue counts, sorting and row badges use the same Hong Kong day rules and one request clock. The shared pure rules accept an injected clock so midnight and host-timezone boundaries can be tested without production records.

The CRM channel notice reads only a selected single brand. Aggregate brand scopes no longer inherit the connection state of an unrelated brand. Settings use the operator's existing permitted brand configuration, distinguish saved credentials, verified webhook, successful test and error states, and preserve the selected brand through navigation, save and test redirects. Existing access checks remain in place; credentials are neither logged nor displayed.

CRM requests complete lead/case/booking reads. A failed or incomplete read renders the existing `DashboardRegionState` retry pattern and withholds the queue and totals, rather than presenting an empty subset as complete. A missing optional operational schema is shown as unavailable instead of silently supplying zero operational results.

## Existing product language and components

The dense horizontal CRM table, compact settings rows, shared shell, existing submit controls and System-based unavailable state are retained. No general UI library, theme or customer-data migration is introduced. The shell's optional brand context affects only routes that understand that context. Private settings and authorization boundaries are unchanged.

The old layout-only table fixture requires explicit opt-in, an empty input and the isolated fixture flag. It cannot replace valid cases. The new synthetic qualification route passes actual outcome cases to the production table and freezes its clock.

## Verification

- `node scripts/test-crm-operations.mjs`: passed. Covers actual queue helpers, three host timezones around HKT midnight, honest channel readiness, validated brand resolution, permitted/denied server actions and brand-preserving redirects.
- The same regression executes actual CRM route orchestration with synthetic failed lead, case and booking reads, proving that failed reads do not proceed to totals or table rendering.
- The settings route is executed against synthetic permitted brands and a saved-but-untested connection. It queries only the selected brand and renders **待測試**.
- TypeScript and the design-system contract passed during implementation. Record final release build, Storybook, visual, accessibility and hosted verification on the PR before release.

This is application qualification, not a change to the Lead Sheet or its appointment history. No source customer, staff assignment, booking outcome or business value is rewritten.

## Recovery

Revert the application release to restore the prior queue, connection and navigation presentation. No data rollback or schema migration is required for these CRM changes. The complete-read helper and publication work have their own release evidence and recovery notes.
