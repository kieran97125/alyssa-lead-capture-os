# New-lead identity and arrival display repair

Observed source sync diagnostic: `bridge_row`. Three newly eligible Lead rows lacked stable source IDs; their projection flags therefore failed the contract. Source Account edit routing only handled booking status/date/time edits. The background worker eventually registered the IDs.

The live bound script now registers missing stable IDs for meaningful non-booking edits under the existing document lock before appointment processing. Existing IDs remain; orphaned appointment metadata and concurrent source edits fail before writes. Account + Lead ID must both match before the original full phone is used for a new arrival label. Canonical last-eight identity remains unchanged.

The patch file contains named replacement functions, not a standalone installer. Replace the matching definitions in the existing bound source and add `oa2EnsureEditedLeadIds_`; do not append duplicate definitions. Saved live source was copied back and compared exactly. No trigger or permission changes were made.

Verified 211 existing arrival display cells from Account-scoped source evidence and widened the display column. Ten historical rows have missing or ambiguous full-phone evidence and were preserved. No arrival outcomes, schedules, booking dates, or registry identities were modified.

Run `node scripts/apps-script/verify-identity-label.mjs`. Synthetic regression passed for new and existing IDs, non-booking edits, orphan metadata, concurrent source changes, full phone, and exact Account/Lead binding.

Manual system sync remains unverified: system browser is signed out and automatic review rejected emergency administrator credential access. The source bridge has since passed, but the system remains on its prior failed run. Follow-up: #115; validate programmatic writes too, since API writes do not emit native edit events.

Rollback: remove the identity-registration call/helper and restore the prior `oa2Record_`/`oa2QueueLabel_` functions from the bound source backup. Preserve already allocated IDs and arrival evidence. Reverting display formatting does not require deleting any registry data.
