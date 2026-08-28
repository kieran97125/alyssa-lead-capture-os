-- Pre-cutover tasks did not have an explicit Start Day. For those historical
-- rows only, the closest auditable equivalent to「派 Job 日」is the HKT date
-- on which the task was created, not its former Due Day.

update public.marketing_work_tasks
set
  start_date = (created_at at time zone 'Asia/Hong_Kong')::date,
  updated_at = now()
where created_at < timestamptz '2026-08-28 05:51:57+00'
  and start_date = due_date
  and due_date > (created_at at time zone 'Asia/Hong_Kong')::date;
