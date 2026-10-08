# Manual source selection on the native arrival register

Staff can classify an existing booked Lead as AD, KOL or OG on 到店紀錄. Source defaults to blank, meaning unreviewed; it is not inferred as organic when API attribution is absent.

## Saved configuration

- Added the visible 來源 column at AC, immediately after the last visible business column 分店 (the existing N:AB columns remain hidden). No operational column was inserted or moved.
- AC7 follows the existing editable-column header style; AC8:AC has a strict native AD/KOL/OG dropdown, plain text and a 100-pixel width. The validation uses an open-ended row range. Header/input notes explain the labels, leave-blank policy and existing-appointment-only use.
- Staff choices are ordinary editable values on the persistent queue row alongside its existing Appointment ID and Queue Entry ID. The managed producer updates only its original 27-column logical contract; AC remains outside its write ranges. A schedule/outcome refresh keeps the same appointment and manual value. A separately created booking starts blank and requires its own classification.
- All four native filter-view rectangles now include the source column and current grid height, preserving their original criteria and sorting. These views change display order, not physical row ownership.
- Grid allocation increased by only one column (706 cells). No extra production data table, provider API call, dependency, trigger, installer, source rewrite or application release was added.

This is a manual booked-Lead annotation on the native register. It is not first-touch tracking, automatic campaign attribution, a new funnel metric or a claim that the application already consumes this source label. Staff must not enter a source on an empty queue row or sort just the source column separately from its appointment record.

## Verification

- Native cell metadata confirms exact AD/KOL/OG validation at existing and trailing blank rows, matching header/input formatting. The native browser dropdown visibly exposes all three values; it was dismissed without assigning a guessed source to a real customer.
- An isolated temporary native sheet demonstrated that both appended rows and inserted trailing rows inherit the open-ended dropdown. Three synthetic selections remained AD/KOL/OG; the QA tab was removed afterwards.
- `scripts/test-arrival-source-extension.mjs` executes the saved native producer, supplied as a private local file. It verifies refresh/revision retention, AD/KOL/OG, a new blank booking, a deliberate clear, unchanged CS/helper/appointment fields, the source-only edit fast path and rejection of a changed owner.
- The test used the saved 2026-10-06 producer readback, SHA-256 `af01ab2afcfef3edce7f516faa8a75ea62719d8489a03b2289fcc593797100d4`. It does not claim a fresh full-source browser export or a real staff tagging event. The later identity/label extension is separate from this trailing-column contract.
- Post-write native queue metadata had no cell errors. Book/Show/No Show remained 35/12/2 in the current October selection. Lead advanced from 179 to 180 while colleagues were active; the change requests write no Lead or metric cells.
- Native source cells remain blank until staff classify them. No customer or booking source was invented for testing.

Existing Node built-ins and native Sheets validation meet this task's tooling needs; no package was installed. No shared application component or UI contract changed.

## Follow-up and recovery

Observe a legitimate staff classification through the next normal background update. Future API attribution must preserve manual provenance, establish a verified provider identity and use explicit evidence for organic classification. An absent advertising token alone is insufficient. Keep the platform-specific acquisition taxonomy configurable and review conflicts before changing manually selected values.

If this configuration must be withdrawn, first preserve any staff-entered source labels together with their exact Appointment/Queue/Lead IDs and Account. Disable the AC dropdown and remove the field from filter views if needed. Do not delete the column once real annotations exist without a durable keyed export. The original managed writer and operational schemas require no rollback.
