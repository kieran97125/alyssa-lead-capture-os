# Pending source time and appointment identity registration

## Source condition

A booked source row can carry a supplied appointment date and the exact time
marker `再約`, with no stable source or appointment ID yet. The native worker
previously treated every nonblank, nonclock time as malformed, so it left this
row unregistered. The application then correctly rejected the snapshot with
`bridge_registration_pending` instead of publishing an appointment whose owner
was not registered. A missing historical `Booking Registered At` is not the
trigger for that reason code.

## Change

Only the source time token `再約` is accepted as explicitly unspecified time.
The strict clock parser still returns blank for it. The source text is never
changed; registry and queue time remain blank, and the supplied date is retained.
The marker alone does not cancel a booking or change it to a reschedule request.
Other invalid time strings, ownership conflicts, invalid dates and outcome
restrictions remain guarded.

The source-time predicate is shared by identity priority, its registry/queue
commit, missing-only synchronization, source schedule catch-up and gap repair.
Gap discovery still treats this token as unavailable for filling an actual clock
time. An imported/scan registration keeps `legacy_registration_unknown` and an
empty `Booking Registered At`; no historical registration timestamp is invented.

## Verification and rollout

Synthetic governed-commit tests cover source business-cell preservation,
registry/queue ownership, repeat execution without new IDs or rows, later real
clock-time entry on the same appointment, and rejection of arbitrary invalid
time strings. Native schedule and missing-only tests exercise the same source
token while keeping outcomes and existing registration provenance unchanged.

The application projection guard is unchanged. Deploy the two native release
files together, run the existing governed registration path for the affected
Account, and then validate a fresh application synchronization. Code tests do
not by themselves establish that the production row was repaired or published.

Rollback both native release files together. Do not remove durable identities,
registry rows or queue entries already committed by a verified registration.
