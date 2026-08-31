# Creative Production Studio v1 Release Record

## Scope

This release adds a dedicated Marketer-to-Designer production workflow without changing Lead, Book, Show, CRM, attribution, Spend or report calculations.

## Product surfaces

### Left navigation

```text
工作協作
  ├─ 營銷日曆
  ├─ 工作事項
  └─ 設計工作
```

`設計工作` has its own unread-notification badge.

### Job List

- Separate Source, Usage and Media Format columns.
- Brand, Designer, Priority, Start Day, Due Day, Publish/Calendar and Status columns.
- Quick views for open work, waiting assets, review/revision, overdue, upcoming publishing and completed work.
- Filters for scope, brand, designer, status and priority.
- Default view excludes completed and cancelled work.
- Sort order: Start Day first; within the same Start Day, urgent/priority/normal; then Due Day.

### Creative Job Studio

- Compact settings panel for assignment, classification, schedule and output specifications.
- Central rich Brief Workspace for long text, headings, lists, checklists, links and inline screenshots.
- Paste and drag images directly into the brief.
- Right-side asset library, discussion and version history.
- Google Drive and other HTTPS links can be stored as assets and inserted into the workspace.
- Draft, review, revision, approval, final delivery, completion, blocked and cancellation states.

## Schedule contract

| Field | Responsibility |
|---|---|
| Start Day | Defaults to current Hong Kong date; owns Job List placement and start reminder |
| Due Day | Designer delivery deadline; owns due-soon and overdue reminders |
| Publish Day | Available only when Calendar sync is enabled; owns Calendar/publishing date |

Due Day cannot precede Start Day. Publish Day cannot precede Due Day. A published Calendar item cannot have its historical publishing date changed or be detached through the Creative Job.

## Assignment completeness

A draft can be saved while incomplete. Before assigning a Designer, the job requires:

- a meaningful Job title
- Due Day
- Source
- Usage
- Media Format

Amber and Vicky are seeded as Designer profiles. A profile can receive work before it is linked to an account, but desktop and in-system delivery requires account linking.

## Permissions

| Role | Default access | Record scope | Main abilities |
|---|---|---|---|
| Owner / Master | Yes | All authorized brands | Full workflow, taxonomy, designer registry and account linking |
| Admin / Manager | Yes | Authorized brands | Create, assign, edit, review, approve, complete |
| Marketer | Yes | Authorized brands | Create, assign, edit brief, review, request revision, approve |
| Designer | Yes | Assigned jobs only | View brief, add assets/comments, update production/delivery states |
| CS | No | None | Module hidden unless owner explicitly changes access policy |
| Viewer | No | None | Module hidden unless owner explicitly changes access policy |

Team Settings includes a per-member `設計工作` checkbox. Source, Usage, Media Format and Designer registry management remain Master-only even when another role can use the module.

## Storage and history

- Metadata, brief documents, comments, versions and audit events are stored in Supabase.
- Inline screenshots and uploaded images use a private `creative-job-assets` bucket.
- Image limit: 25 MB; supported types: JPEG, PNG, WebP and GIF.
- Large video footage remains in Google Drive and is linked into the asset library.
- Assets are served through an authenticated route that rechecks module, brand and assignment access.
- Asset removal unlinks it from the job; it does not delete a Google Drive original.
- Autosave uses an 850 ms debounce.
- Periodic and manual versions are recoverable; restore preserves the previous current version.
- Every important create, edit, assignment, classification, asset and status operation writes an audit event.

## Notifications

Creative notifications reuse the existing Web Push delivery system and deep-link directly to the job:

- new assignment
- urgent or priority change
- Start Day
- Due Day within 24 hours
- overdue
- comments
- review submission
- revision request
- final delivery
- approval and completion

A Designer receives desktop notifications only after:

1. a personal workspace account exists
2. the member has `設計工作` and appropriate brand access
3. the Designer profile is linked to that member
4. the member signs in and enables desktop notifications on that device

## Verification

The feature branch passed:

- production build and TypeScript
- Creative Production architecture contract
- dedicated Creative UI acceptance
- desktop and mobile rich-Brief checks
- complete existing Playwright regression suite

## Rollback

- Revert the release merge commit to remove product routes and UI.
- Database tables are additive and can remain without affecting existing modules.
- Disable the `creative_jobs` module permission to hide access immediately.
- Unschedule `queue-creative-job-reminders` if reminder dispatch must be stopped.
- Do not drop audit or version data during an emergency UI rollback.
