import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const paths = [
  "src/lib/marketing/workTasks.ts",
  "src/app/tasks/actions.ts",
  "src/app/tasks/page.tsx",
  "src/components/command-center/TaskCreateForm.tsx",
  "src/components/command-center/DesktopNotificationControl.tsx",
  "src/app/api/notifications/push/route.ts",
  "src/app/api/notifications/push/test/route.ts",
  "src/app/calendar/actions.ts",
  "src/app/calendar/page.tsx",
  "public/growth-os-sw.js",
  "supabase/migrations/20260828055157_work_task_start_dates_and_web_push.sql",
  "supabase/migrations/20260828055834_web_push_delivery_claiming_aftercare.sql",
  "supabase/migrations/20260828055853_web_push_stale_claim_recovery.sql",
  "supabase/migrations/20260828061134_pg_net_extension_schema_aftercare.sql",
  "supabase/migrations/20260828061810_atomic_work_task_schedule_sync.sql",
  "supabase/functions/marketing-web-push-dispatch/index.ts",
];
const files = Object.fromEntries(
  await Promise.all(
    paths.map(async (path) => [path, await readFile(`${root}${path}`, "utf8")])
  )
);

const workTasks = files["src/lib/marketing/workTasks.ts"];
assert.match(workTasks, /startDate: string/);
assert.match(workTasks, /startTime: string \| null/);
assert.match(workTasks, /\.gte\("start_date", weekStart\)/);
assert.match(workTasks, /\.lte\("start_date", weekEnd\)/);
assert.match(workTasks, /\.order\("start_date"/);
assert.doesNotMatch(
  workTasks,
  /task\.dueDate >= weekStart && task\.dueDate <= weekEnd/
);

const taskForm = files["src/components/command-center/TaskCreateForm.tsx"];
assert.match(taskForm, /name="startDate"/);
assert.match(taskForm, /Start Day／派 Job 日/);
assert.match(taskForm, /name="dueDate"/);
assert.match(taskForm, /Due Day／截止・出街/);
assert.match(taskForm, /列表按 Start Day/);

const taskActions = files["src/app/tasks/actions.ts"];
assert.match(taskActions, /start_date: startDate/);
assert.match(taskActions, /start_time: startTime/);
assert.match(taskActions, /dueDate < startDate/);
assert.match(taskActions, /export async function updateWorkTaskScheduleAction/);
assert.match(taskActions, /update_marketing_work_task_schedule/);
assert.match(taskActions, /published_calendar_immutable/);
assert.doesNotMatch(
  taskActions,
  /\.from\("marketing_calendar_items"\)[\s\S]{0,180}\.update\(\{[\s\S]{0,120}scheduled_date: dueDate/
);

const taskPage = files["src/app/tasks/page.tsx"];
assert.match(taskPage, /Start Day/);
assert.match(taskPage, /Due／出街/);
assert.match(taskPage, /DesktopNotificationControl/);
assert.match(taskPage, /data-testid="task-schedule-form"/);
assert.match(taskPage, /defaultStartDate=\{snapshot\.today\}/);
assert.match(taskPage, /id=\{`task-\$\{task\.id\}`\}/);

const calendarActions = files["src/app/calendar/actions.ts"];
assert.match(calendarActions, /taskStartDate/);
assert.match(calendarActions, /start_date: effectiveTaskStartDate/);
assert.match(calendarActions, /due_date: scheduledDate/);
const calendarPage = files["src/app/calendar/page.tsx"];
assert.match(calendarPage, /name="taskStartDate"/);
assert.match(calendarPage, /Due／出街日期/);

const pushControl =
  files["src/components/command-center/DesktopNotificationControl.tsx"];
assert.match(pushControl, /Notification\.requestPermission\(\)/);
assert.match(pushControl, /navigator\.serviceWorker\.register/);
assert.match(pushControl, /pushManager\.subscribe/);
assert.match(pushControl, /\/api\/notifications\/push\/test/);
assert.match(pushControl, /data-testid="desktop-notification-control"/);

const pushApi = files["src/app/api/notifications/push/route.ts"];
assert.match(pushApi, /source !== "supabase_auth"/);
assert.match(pushApi, /marketing_web_push_subscriptions/);
assert.match(pushApi, /marketing_web_push_deliveries/);
assert.match(pushApi, /vapid_public_key/);
const pushTestApi = files["src/app/api/notifications/push/test/route.ts"];
assert.match(pushTestApi, /desktop_test/);
assert.match(pushTestApi, /marketing_notifications/);

const serviceWorker = files["public/growth-os-sw.js"];
assert.match(serviceWorker, /addEventListener\("push"/);
assert.match(serviceWorker, /showNotification/);
assert.match(serviceWorker, /addEventListener\("notificationclick"/);
assert.match(serviceWorker, /openWindow/);

const foundation =
  files[
    "supabase/migrations/20260828055157_work_task_start_dates_and_web_push.sql"
  ];
assert.match(foundation, /add column if not exists start_date date/);
assert.match(foundation, /alter column start_date set not null/);
assert.match(foundation, /due_date is null or due_date >= start_date/);
assert.match(foundation, /marketing_web_push_subscriptions/);
assert.match(foundation, /marketing_web_push_deliveries/);
assert.match(foundation, /marketing_web_push_settings/);
assert.match(foundation, /create extension if not exists pg_net/);
assert.match(foundation, /queue-work-task-reminders/);
assert.match(foundation, /dispatch-marketing-web-push/);
assert.doesNotMatch(foundation, /vapid_public_key\s*,\s*'B[A-Za-z0-9_-]{20}/);

const claiming =
  files[
    "supabase/migrations/20260828055834_web_push_delivery_claiming_aftercare.sql"
  ];
assert.match(claiming, /for update skip locked/);
assert.match(claiming, /claim_marketing_web_push_deliveries/);
const recovery =
  files[
    "supabase/migrations/20260828055853_web_push_stale_claim_recovery.sql"
  ];
assert.match(recovery, /recovered_stale_delivery_claim/);
assert.match(recovery, /interval '10 minutes'/);
const pgNetAftercare =
  files[
    "supabase/migrations/20260828061134_pg_net_extension_schema_aftercare.sql"
  ];
assert.match(
  pgNetAftercare,
  /create extension if not exists pg_net with schema extensions/
);
assert.match(pgNetAftercare, /set search_path = public, net, pg_temp/);
assert.match(pgNetAftercare, /x-growth-os-dispatch-token/);
assert.doesNotMatch(
  pgNetAftercare,
  /dispatch_token\s*=\s*'[A-Za-z0-9_-]{20}/
);
const scheduleSync =
  files[
    "supabase/migrations/20260828061810_atomic_work_task_schedule_sync.sql"
  ];
assert.match(scheduleSync, /update_marketing_work_task_schedule/);
assert.match(scheduleSync, /for update/);
assert.match(scheduleSync, /published_calendar_immutable/);
assert.match(scheduleSync, /scheduled_date = due_date_input/);
assert.match(
  scheduleSync,
  /revoke all on function public\.update_marketing_work_task_schedule/
);
assert.match(scheduleSync, /to service_role/);

const dispatcher =
  files["supabase/functions/marketing-web-push-dispatch/index.ts"];
assert.match(dispatcher, /npm:web-push@3\.6\.7/);
assert.match(dispatcher, /claim_marketing_web_push_deliveries/);
assert.match(dispatcher, /setVapidDetails/);
assert.match(dispatcher, /contentEncoding: "aes128gcm"/);
assert.match(dispatcher, /statusCode === 404 \|\| statusCode === 410/);

console.log(
  "Task Start Day, Due Day calendar ownership, atomic schedule sync, reminders, Web Push subscription, atomic delivery, pg_net ownership, and Service Worker contracts verified."
);
