# Historical appointment pointers after Account relocation

Moving a durable Lead to another Account may leave its current pointer referencing
a current or closed appointment recorded under the former Account. The registry
preserves that historical attribution. Requiring every such pointer to match the
current Account blocked the whole validated source read.

The pending projection now accepts that reference only when the appointment
exists, owns the exact stable Lead ID, and has a canonical recorded Account. The
verified latest master row owns current Account, brand and treatment dimensions
for pending, cancellation and requested-reschedule projections across all states.
Completed/superseded appointments remain ineligible for pending. It does not
rewrite registry rows or the independent authoritative historical funnel.

Account relocation alone no longer blocks the entire source, including while the
native guarded Account transfer catches up. Missing pointers, wrong Lead IDs,
unknown Accounts, duplicate IDs, mismatched master identities and malformed cells
still fail closed. An exactly owned active rebooking counts as pending even after
an earlier authoritative outcome.

Validation: `npm run verify:lead-sync-recovery-contract`,
`npm run verify:lead-book-dimensions-contract`, and `npm run build`. The regression
fixture reproduces every appointment state after a move, with independent funnel,
current-status and ownership assertions.

Rollback: revert the parser and regression change. The correction performs no
source, journal, registry or queue mutation, so no business-data rollback is needed.
