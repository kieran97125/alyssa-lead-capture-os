# Native source identity recovery

API-imported or interrupted Account rows could remain without a stable source ID. The existing timer registered only its current Account and advanced its cursor only after the complete display/sort path. An unrelated Account header or post-commit display error could therefore starve later Accounts. The website must retain ownership validation; omitting identity checks would make repeat customers and distinct appointments unsafe.

## Candidate behavior

The dated `scripts/apps-script/releases/20261022` release retains the existing DocumentLock, staff admission policy and trigger handlers. It discovers source identity candidates, isolates business-header errors, and gives one Account a bounded missing-only identity pass. It does not add another trigger or an HTTP endpoint. An expensive identity commit replaces the normal heavy Account pass for that cycle. Review-only rows do not consume the accepted-record budget, and the cursor continues through later Accounts after an attempted batch or post-commit failure.

Missing IDs are recovered only from exact Appointment ID or validated durable source-intent evidence with consistent source ownership. Recovery claims are reserved before writes and rechecked against fresh global metadata. Phone, email or social identifiers are corroboration, never a search key for a different source record. New UUIDs require absence of appointment/history metadata and must be unique. Both low-level allocator sites reject orphan metadata so another public/manual path cannot bypass a review.

Booked records use a scoped journal/registry/queue commit, not an ID-only write. Confirmed outcomes and completed histories are retained. Invalid dates, invalid times, future appointments, cancellations and ownership conflicts are not converted into Show. Existing complete appointments are skipped; original CS names, remarks, brands and amounts remain. A real CS status/date/time booking edit preserves the existing known registration-time semantics; a timer/import/remark repair cannot invent a historical Book time.

Rejected identities receive a fixed Chinese system note on the ordinary follow-up-status cell, preserving manual note text and leaving business values unchanged. Only the system-owned note is cleared after accepted same-target readback. Interactive rejection also raises an error. This uses native Google Sheets notes without adding a column, second status control or custom UI dependency.

## Validation and release boundary

`npm run verify:native-identity-contract` runs the existing schedule, manual missing-only and accepted-outcome contracts against this exact release, plus identity/concurrency and Google-isolation guards. Existing Node/VM tooling is sufficient; no new package or OAuth scope is needed for the native change.

The staged QA builder wraps every candidate declaration inside one explicit QA handler. This allows the new code to run against a new synthetic Google spreadsheet before replacing any operational function. The QA runner uses the actual DocumentLock, skips for staff/busy admission, isolates its history cursor in execution memory and verifies original project properties were not changed. Candidate onEdit/timer declarations stay local to that QA wrapper. No synthetic row is inserted into the production spreadsheet.

The real Google fixture execution, final source hashes and production readback are release gates. Local tests alone do not establish them. Do not describe this release as a website-click RPC: the existing website does not yet call the native allocator synchronously. That remaining boundary stays in issue #141.

## Recovery

Preserve `20261021` as the operational source rollback. Live files map as follows:

| Repository file | Bound project file |
| --- | --- |
| native-main.gs | 程式碼.gs |
| arrival-workflow.gs | ArrivalWorkflow20261013.gs |
| arrival-integrity.gs | ArrivalIntegrity20261013.gs |

Restore the prior main file first, then the prior workflow if rollback is required. These code versions do not require a wholesale spreadsheet restore. A full private spreadsheet copy and freshly read source archive are retained separately; use targeted recovery to preserve colleagues' subsequent edits. Website transport release #142 remains intact.
