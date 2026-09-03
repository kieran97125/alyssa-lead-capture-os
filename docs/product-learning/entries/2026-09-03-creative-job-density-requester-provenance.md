# Creative Job operational density, requester provenance and Brief workspace

## Problem

The first Creative Production release used generous display sizing and a permanent three-tab right rail. With real work imported, the Job List became visually heavy, creator ownership was hidden, metadata edits could appear to revert after a server validation/navigation, and explanatory Brief screenshots were mixed into the same visible area as production assets. Long Briefs also forced users to scroll back to formatting controls.

## Decision

Creative Job rows use a compact but readable hierarchy: title/priority, persisted creator provenance, brand/designer, production taxonomy, schedule and status. Creator and assigned Designer remain separate concepts. Operational labels stay at or above the approved readable scale; density comes from spacing, grouping and control height rather than microscopic text.

Job settings use a controlled client draft keyed only by Job ID. Before a real server submission, the current draft is handed across the redirect boundary in session-scoped storage. Validation errors restore that same draft and show the server message inside the settings panel; successful saves clear the handoff. Unrelated Brief interaction cannot replace the current draft with stale `defaultValue` state, while a hard reload still projects canonical database values.

The Brief workspace is the primary production surface. It reclaims the former right rail, keeps a bounded readable canvas, exposes a sticky formatting toolbar, and adds Tiptap text colour through the existing open-source text-style extension. Pasted/dropped screenshots remain private inline Brief attachments and are not presented as production materials. Version history is available through a compact same-page side sheet; asset/comment records and backend actions remain intact but are not permanent workspace panels.

## Guardrails

- Creator means the persisted requester, never the current Designer.
- Member display name is preferred; email local part and `system import` are transparent fallbacks.
- Controlled form state and failed-validation handoff are scoped to one Job ID.
- Server validation feedback is visible and invalid edits are not silently discarded.
- Database values remain the source of truth after a successful save and hard reload.
- Inline Brief images stay private and retrievable, but are not classified as production assets.
- Removing asset/discussion panels is an information-architecture change, not data deletion.
- Sticky controls must not introduce horizontal page overflow or unbounded line length.
- Existing permissions, calendar sync, notifications, audit, versions, assets and comments remain intact.
- No Lead, Book, Show, Spend, CRM, attribution or reporting logic changes.

## Classification

- **Core**: creator/assignee separation; stable controlled settings draft; inline-explanation versus production-asset separation; version history as an on-demand surface; readable operational density.
- **Configurable**: exact density tokens, responsive breakpoints, colour palette defaults, editor canvas width and labels.
- **Enterprise Extension**: role/brand permissions, audit, private attachment delivery, calendar synchronization and desktop notifications.
- **Client-specific and isolated**: brand names, team member identities, campaign terminology, visual brand colours, real URLs and production Job content must never be copied into Growth OS Core or the canonical learning record.

## Evidence

- Source PR: `kieran97125/alyssa-lead-capture-os#83`.
- Initial compact-list implementation commit: `b08afe214cb1e11e68baf7ae5594581c1d2d1e37`.
- Final verified implementation commit: `d37b44716416d9e505039e8c73ae0b087d6f0390`.
- Verification workflow: GitHub Actions run `33722436828`.
- Verification result: production build and TypeScript passed; Storybook passed; Creative Production `13/13` passed twice; design/accessibility `5/5` passed; full product regression `135/135` passed.
- Vercel Preview for the final implementation commit reached Ready before merge.

## Verification

- Production build and TypeScript contracts.
- Tiptap text-colour and sticky-toolbar acceptance.
- Controlled Job settings persistence, failed-validation handoff and inline feedback acceptance.
- Version side-sheet and removal of permanent asset/discussion panels.
- Creator provenance and minimum readable metadata sizing.
- Compact desktop list visual baseline, no horizontal scrolling and mobile acceptance.
- Design/accessibility suite and full product regression.

## Rollback

Revert PR #83. No migration is required. Stored Jobs, settings, Brief documents, inline images, versions, production asset records, comments, notifications, requester identity and audit history remain unchanged.
