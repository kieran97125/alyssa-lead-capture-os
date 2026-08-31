# Creative Production Needs a Dedicated Operating System, Not a Larger Task Form

## Context

General work tasks were suitable for short operational assignments, but creative production requires a richer contract: the material source, intended placement and final media format are different dimensions; long briefs mix text, screenshots, links and checklists; drafts and revisions need version history; and a designer delivery date is not necessarily the publishing date.

## Product decision

Alyssa Growth OS now has a dedicated Creative Production Studio built on the same workspace identity, brand access, Calendar and Web Push foundations as the rest of the system.

The workflow is:

```text
Marketer creates a Creative Job
  → assigns a Designer
  → Designer produces and submits for review
  → Marketer requests revision or approves
  → Final is delivered
  → optional Publish Day syncs to Marketing Calendar
```

## Data model learning

Three independent classifications are required:

- **Source:** where the working material comes from.
- **Usage:** where the output will be used.
- **Media format:** what the designer must deliver.

Combining these into one “type” field makes reporting, filters and future automation unreliable.

The formal schedule also needs three dates:

- **Start Day:** owns Job List placement and start reminders; defaults to the current Hong Kong date.
- **Due Day:** owns delivery deadlines, 24-hour warnings and overdue status.
- **Publish Day:** exists only when Calendar sync is enabled and owns the actual publishing schedule.

## Rich Brief learning

A creative brief is a working document rather than a note field. It therefore uses a structured rich-text document with headings, lists, task lists, links and inline images. Images pasted or dragged into the brief are stored privately, and the brief only stores references to those assets.

Autosave prevents accidental loss, while periodic and manual versions make major edits recoverable. Restoring a version also preserves the pre-restore content so rollback never destroys the current state.

## Permission learning

Module visibility and record visibility are separate controls:

- Marketer, Manager, Admin and Owner can receive module access and manage jobs for their authorized brands.
- Designer can receive module access but can only see jobs assigned to their linked member account.
- CS and Viewer do not receive the module by default.
- The system owner can still enable or disable the module per individual in Team Settings.
- Source, Usage, Media Format and Designer registry administration remain system-owner only.

UI hiding is not the security boundary. Every server action and private asset route rechecks module, brand and assignment access.

## Notification learning

A named Designer profile is not enough for delivery. The profile must be linked to a personal workspace member, and that person must enable Web Push on each device. Until both conditions are met, the job remains assignable and visible to operations, but the system clearly warns that desktop delivery is unavailable.

## Reusable rule

When a workflow contains its own vocabulary, lifecycle, permissions, documents and audit requirements, extend the shared platform foundations but give the workflow a dedicated product surface. Do not force it into a generic task card or rebuild identity, Calendar and notifications from scratch.
