# Task Start Day / Due Day / Web Push release verification

## Scheduling contract

- Weekly task list filters and sorts by `start_date` only.
- Due Day cannot precede Start Day.
- Calendar scheduled date/time is owned by Task Due Day/Time.
- Moving Start Day does not move Calendar or performance-event dates.
- Updating Due Day synchronizes linked unpublished Calendar items in one database transaction.
- Published Calendar dates remain immutable.

## Desktop notification contract

- Individual invited workspace accounts can enroll each browser/device.
- Shared password sessions cannot bind private devices.
- Browser permission is requested only after an explicit user click.
- Service Worker receives background Push and routes notification clicks back to the relevant Task or Calendar item.
- New notifications dispatch immediately and are reconciled every minute.
- Start Day, 24-hour Due and overdue reminders are queued every 15 minutes.
- Delivery claiming is atomic; transient errors retry and expired subscriptions are retired.

## Production evidence recorded before PR

- Supabase migrations applied through `20260828062233`.
- Atomic Task/Calendar transaction test passed and rolled back without persistent test rows.
- Edge Function dispatch called through `pg_net` and returned HTTP 200.
- Supabase security advisor showed no new exposed-table or extension-schema warning.
- Performance advisor finding introduced by Web Push was resolved with a covering subscription index.
- Feature-branch Production build and TypeScript checks passed before opening the PR.
