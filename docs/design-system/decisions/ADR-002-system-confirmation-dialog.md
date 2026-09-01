# ADR-002 — App-owned confirmation for destructive actions

Date: 2026-09-01
Status: Accepted
Source: PR #79

## Context

Creative Job deletion is a high-impact interaction. The first implementation exposed a delete icon but delegated confirmation to `window.confirm`, which cannot be visually governed, reliably screenshotted, or reviewed as part of the Alyssa design system. It also left the confirmation experience inconsistent across desktop, mobile and future destructive workflows.

## Decision

1. Introduce `SystemConfirmationDialog` under `src/components/system` using the existing Base UI Dialog primitive and approved System button variants.
2. Keep business-specific wording and server actions in `CreativeJobDeleteControl`; the shared component owns focus, overlay, hierarchy, cancel behavior and responsive layout only.
3. Require an explicit second action labelled `確認刪除` before the server action runs.
4. Keep deletion permission-gated and soft-delete the Job so operational Audit evidence remains available.
5. Preserve the active Job List query after deletion by passing a validated internal `returnPath`.
6. Protect the closed and open states with Storybook plus deterministic desktop and mobile Playwright screenshots.

## Consequences

- Destructive confirmations are now app-owned, keyboard accessible and visually reviewable.
- Feature code cannot silently replace the confirmation hierarchy with browser-native prompts.
- The same System dialog may be reused by future destructive actions, while product wording and authorization stay feature-specific.
- No database migration or existing production row is changed.

## Operational deletion lifecycle

The confirmation wording is backed by an atomic database function. It soft-deletes the Job, retires linked unread notifications, marks pending/retry/sending Web Push deliveries as failed with `creative_job_deleted`, removes an unpublished linked Calendar item and preserves a Published Calendar item. The Push dispatcher also rechecks Creative Job state after claiming deliveries.

## Product Learning Sync

Reusable confirmation, soft-delete, notification-retirement and Server Action runtime-boundary learning is recorded in the canonical `kieran97125/leadhub-source-os` entry `2026-09-01-app-owned-destructive-action-lifecycle.md`. Client identity, users, domains, credentials and production records remain isolated.
