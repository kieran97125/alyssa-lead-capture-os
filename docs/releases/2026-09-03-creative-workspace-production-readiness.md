# Creative Workspace production readiness

## Scope

PR #83 replaces the permanent three-column Creative Job detail layout with a shared two-column Studio for every historic and newly created Job.

- Left: compact Job settings.
- Main: expanded Creative Brief workspace.
- `交付／留言`: on-demand collaboration side sheet for production assets, Drive links and revision discussion.
- `版本`: on-demand Brief version side sheet.
- Brief-only screenshots remain private inline explanation assets and do not appear as production deliverables.

No Job-age condition, record migration or legacy-layout flag is involved. Once this PR reaches `main`, existing Jobs and new Jobs use the same component and layout.

## Verified head

Implementation commit: `195c5e510bcf72960515d39315e166c5656d9b4b`

Verification workflow: `33729418913`

- Production build, TypeScript and all contracts: passed.
- Storybook, including the open collaboration sheet state: passed.
- Creative Production focused suite: `14/14` passed after snapshot refresh and `14/14` passed again.
- Design and accessibility suite: `5/5` passed.
- Full product regression: `136/136` passed.
- Deterministic collaboration-sheet visual baseline committed.
- Temporary release workflow and correction script removed after successful verification.

## Release gate

This document records pre-merge evidence only. Production is considered released only after PR #83 is merged, the matching Vercel Production deployment is Ready, and `main` is verified to contain the two-column Studio implementation.
