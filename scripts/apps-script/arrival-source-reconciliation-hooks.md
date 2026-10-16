# Bound source integration

Apply to the currently saved, reviewed bound source. Keep existing source-date,
stable-owner, journal, lock and queue-write guards.

1. `oa2Record_`: include `confirmedAt: row[c.SHOW_DATE-1]` in its record object.
2. `oa2ProcessAccount_`: after assigning a stable Lead ID and computing edit
   flags, call `oa2EnsureUnqueuedSourceShow_(ctx,r,queue)` for current records
   before the ordinary `oa2ReconcileRecord_` call.
3. `oa2ReconcileRecord_`: its pending reschedule condition also admits an
   `unscheduled` appointment with no stored date when a source date exists.
   This repairs a late-filled date even when `lastSchedule` already matches.
4. `oa2Due_`: admit both active and unscheduled appointments without outcomes.
   An unknown appointment date remains blank in the queue.
5. `oa2ReadQueue_`: read the complete physical width once, map its governed
   26 fields through `layout.columns`, and mark slots with manual source,
   trial-price or order-amount values as occupied. Numeric zero is entered data.
6. `oa2WriteQueue_`: before claiming a new/unowned slot, freshly check its manual
   columns. Abort allocation if staff entered data after the initial snapshot.
7. `oa2RehomeMovedAccountAppointments_`: exclude records accepted by
   `oa2IsHistoricalCrossAccountRecord_` from open-appointment transfers. In the
   `oa2ProcessAccount_` record loop, add those rows to `snap.deferredRows` and
   skip their source metadata reconciliation. A moved source record with a
   matching stable Lead ID and an existing completed outcome must not abort
   unrelated records or move its historical visit/money to another Account.
   Open appointments still use the existing unique-source identity checks.

The separately named helper file has no trigger installer and does not replace
existing function definitions. Existing triggers run the saved integration.
Repair functions take the normal document lock, preserve a hidden full snapshot,
run the ordinary journaled reconciliation, then compare all manual values by
stable appointment/arrival ID. Source confirmation/registration dates are never
invented. Existing queued outcomes and historical visits remain authoritative.
The hidden backup freezes values after removing copied input validations from
the backup only; legacy values are valid historical evidence even when current
dropdown rules reject them. A ready marker prevents overwriting a completed
backup; an interrupted, unready copy can finish before any repair mutation.

Rollback: restore the preceding bound project source and leave the preserved
register/history and backup sheets intact. Do not remove user-entered amounts.
