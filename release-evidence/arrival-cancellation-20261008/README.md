# Managed arrival cancellation correction — 2026-10-08

Selecting `取消` after `已到店` previously left the registered appointment completed and its current outcome as Show. The queue-action guard rejected cancellation unless the outcome had first been cleared manually. The displayed cancellation therefore disagreed with the registry, source metadata and Show projection.

The saved bound script now treats cancellation of a managed completed appointment as one correction: clear the current outcome, actual arrival date and generated arrival evidence, set the current state to canceled, and retain the former completion in the existing history Before snapshot. Booking registration, schedule, appointment/Lead/queue identities and history remain intact. One revision is recorded; a repeated cancellation makes no further changes. Imported historical Show evidence and the existing completed-reschedule guard remain protected.

## Implementation and deployment

- Replacement definition: `scripts/apps-script/arrival-cancel-correction-v1.gs`.
- Replace the existing `oa2QueueAction_` definition once. The live saved source was copied back from the editor and exactly matched the tested replacement; all other main-source content was unchanged.
- Before SHA-256: `5db786bd66d3e70b83df63d2a0905e1b42c847226d910bf556b6237b585434a8`.
- Saved/read-back SHA-256: `160610080e279c4f37d87beb23962277602e15958fd239bc8e87282bc179d84f`.
- No installer, trigger, permissions, schema, formatting, Account sorting, application deployment or direct reporting-fact write was performed.

## Validation

Run `node scripts/test-arrival-cancel-correction.mjs`. The baseline contains only the relevant pure transition contract copied from the saved source; no customer fixtures or credentials are included. A complete saved bound source can optionally be supplied as the first command argument.

The original source reproduces the rejection. The replacement passed 37 synthetic checks locally and in the native Apps Script runtime with zero spreadsheet writes: Show/No Show/pending to cancellation, one revision and retained audit before-image, stable booking identity, queue display, reversal of current Show/No Show while preserving Book, repeated cancellation, explicit pending restoration and re-completion, staged worker absorption, schedule/identity conflicts, imported history, reschedule and invalid-action guards.

The one affected managed mismatch was then reconciled using the existing queue handler and commit coordinator. The first attempts returned staff-priority/document-lock busy without writing. An admitted execution completed and independently read back state canceled, empty outcome and arrival date, and revision 3. A separate native Sheets read confirmed the queue display was 已取消, source arrival-result metadata was 取消, the source recovery anchor was clear and the authoritative Show date was empty. Lead and Book metric dates remained present. The visible page was refreshed and independently showed 已取消.

The one-off recovery entry point in `native-qa.gs` was removed from the live QA file after completion. The live QA file retains only the synthetic zero-write verifier. The checked-in recovery function is release evidence and a guarded manual procedure; it fails fast while staff have priority or the document lock is held, requires exactly one matching managed mismatch, and calls the existing handler without raw registry mutations. Provider latency remains outside the transition fix's guarantees.

## Rollback

After checking for intervening source edits, restore only the former `oa2QueueAction_` definition from `transition-baseline.gs`. Preserve the workbook, registry, history, source anchors and completed corrections. Do not restore an entire old source over subsequent edits, reinstall triggers, or rewrite reporting facts.
