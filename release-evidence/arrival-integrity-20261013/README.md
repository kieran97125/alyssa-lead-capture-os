# Arrival integrity native maintenance — 2026-10-13

## Saved native changes

The saved source was reloaded and copied back for an exact comparison with the tested candidate.

- Stable appointment ownership recovery helper: SHA-256 `22a358f96165d443160ffef54c89f9eb0ceb5a239ee413d8b9d35acb95c049d2`.
- Main producer with repeat-visit eligibility, owner-bound phone fallback and occupied-CS protection: SHA-256 `673003acc40c41161f664f0111e878549105bb2b1ca16aa0470987834b363b16`.

Every distinct booked or Show source record participates in arrival reconciliation, including non-current rows sharing a phone. Person-level current selection and reporting metric definitions are unchanged. Appointment IDs still deduplicate the same visit. Existing completed outcomes and cancellations remain authoritative.

Automatic CS synchronization populates only physically empty cells. It preserves every occupied cell, including existing names and historical placeholders, and writes only changed blank-cell groups after fresh ownership/source/output checks. This replaces the prior full-column rewrite.

A missing full-source snapshot can use only the registry phone whose complete stable customer key agrees with that phone. A foreign source record cannot supply the displayed phone. Internal Lead IDs are no longer the last visible fallback.

## Operational readback

Five placeholder labels were repaired from uniquely identified source rows; every other entered value and formula in those records compared unchanged. An operational stable-ID audit found one named owner mismatch; that single arrival CS cell was corrected to its source owner after fresh Lead/Appointment pointer verification. Other entered values compared unchanged. No customer identities or source rows are included in this evidence file.

This is not acceptance of all historical owner relationships: legacy aliases and manual ownership intentions remain separate evidence.

## Validation

- `node scripts/test-arrival-source-reconciliation.mjs`: passed.
- `node scripts/test-arrival-repeat-visit-eligibility.mjs`: passed.
- `node scripts/test-arrival-cs-preservation.mjs`: passed.

The two reviewed-functions files are replacement snapshots and deterministic test inputs, not files to add beside existing bound definitions.

## Outstanding native acceptance

The existing journaled catch-up was started after saved-source verification. Its completion/coverage must be read back before reporting all missing appointments recovered. Do not treat saved code, test results or a READY application preview as completed native reconciliation.

The visible manual synchronization control, persistent date/time ordering and separated Brand/phone display columns remain unimplemented in this change.

## Rollback

Restore the preceding saved versions of the affected bound function definitions. Keep current appointment/arrival/history records and the existing backup intact; do not erase source records, manual owners, outcomes or amounts. No triggers, sharing, permissions, report metric contracts or provider consent changed.
