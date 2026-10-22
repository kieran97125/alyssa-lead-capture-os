# Complete source refresh and classified feedback

Manual source updates were being cut off by the same 15-second provider budget used for report helpers. Two complete attempts then failed after roughly 35 seconds. The shared banner discarded the classified failure and only asked the operator to check the source.

The reader keeps the complete five-range request and all coverage, ownership and accepted-outcome validation. It requests compact values-only JSON and Google's gzip response contract. Manual and scheduled source syncs allow 60 seconds for each complete provider fetch and JSON body. Read-only dashboard requests retain their 12-second overall deadline, and report helpers retain their 15-second budget. The dashboard, performance, source administration, treatment mapping and existing cron entry points allow 180 seconds for both reads, validation and publication.

The existing shared banner now renders a fixed description for the classified failure. It never renders raw provider messages or customer cells. Busy is described as another update in progress and is not reported as published data. Existing button appearance, authorization, keyboard interaction, pending state and saved-snapshot behavior remain.

No dependency is required: built-in Node fetch, AbortSignal and existing TypeScript/Playwright/Storybook tooling cover this change. No native Sheet writer, timer, column layout, source value, identity guard or sort is changed by this release.

## Verification

- Virtual-clock transport tests exercise a complete response after 25 seconds, 60-second fetch and body aborts, unchanged 12-second dashboard and 15-second report limits, exact ranges and preserved values.
- Shared action tests exercise every existing role, timeout, pending identity, busy and unknown failures, and ensure raw provider payloads do not reach the banner.
- Existing identity, arrival, pending, manual sync, snapshot retention and native regression gates remain required.
- Production success requires a real completed refresh and the same persisted audit/snapshot readback. A READY deployment or tests alone do not establish it.

## Rollback

Revert this application release to the preceding production commit. No Sheet migration or data rollback is required. Keep the existing accepted registry and source identity repairs intact.

The longer read budget does not implement immediate identity repair or eliminate provider-side calculation contention. Those remain separate work under issue #141.
