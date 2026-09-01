# Creative Job delete and notification lifecycle

## Problem

Creative Job deletion was hidden and ambiguously labelled, while the first New Job Server Action also exported a runtime object from a `"use server"` module. That caused a Production module-evaluation error after submission. A soft-deleted Job could additionally retain an unread notification or queued Web Push delivery created just before deletion.

## Product decision

- Use the shared app-owned confirmation dialog in both Job List and Job detail placements.
- Keep delete permission-gated and preserve the active filtered list after completion.
- Move Server Action initial state to a neutral module so the `"use server"` file exports async actions only.
- Execute Job soft deletion, unread-notification retirement, queued-delivery cancellation and linked Calendar cleanup atomically in Postgres.
- Preserve a Published Calendar item as operational history; remove only an unpublished linked item.
- Make the Push dispatcher recheck the linked Creative Job after claiming a delivery.
- Preserve Creative activity, Brief versions and Audit history.

## Verification contract

- Production build and Creative contracts inspect the Server Action boundary, safe-delete RPC, delivery statuses and dispatcher guard.
- Storybook and deterministic desktop/mobile screenshots cover the confirmation states.
- Playwright covers the real Creative Jobs route, list/detail delete controls, filter-preserving return path and Rich Brief behavior.
- The reusable abstraction is indexed in the canonical `kieran97125/leadhub-source-os` Product Learning Log; Alyssa identity and production data remain isolated.

## Reusable rule

A workflow item is not fully deleted merely because it disappears from a list. Deletion must cover the complete operational lifecycle: authorization, confirmation, active-view return, database state, pending notifications, linked unpublished schedules, published-history preservation, Audit evidence and runtime acceptance.
