from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    (ROOT / path).write_text(content, encoding="utf-8")


def replace_once(path: str, old: str, new: str) -> None:
    content = read(path)
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one match, found {count}: {old[:120]!r}")
    write(path, content.replace(old, new, 1))


# 1) Weekly Tasks data ownership: selected week follows start_date only.
work_tasks_path = "src/lib/marketing/workTasks.ts"
replace_once(
    work_tasks_path,
    "  createdByEmail: string | null;\n  dueDate: string | null;",
    "  createdByEmail: string | null;\n  startDate: string;\n  startTime: string | null;\n  dueDate: string | null;",
)
replace_once(
    work_tasks_path,
    "          createdByEmail: member.email,\n          dueDate: shiftDate(input.weekStart, 3),",
    "          createdByEmail: member.email,\n          startDate: shiftDate(input.weekStart, 1),\n          startTime: \"09:30\",\n          dueDate: shiftDate(input.weekStart, 3),",
)
replace_once(
    work_tasks_path,
    '          "id,brand_id,treatment_id,treatment_label,title,description,status,priority,assignee_member_id,assignee_email,created_by_email,due_date,due_time,performance_marker,completed_at,updated_at"',
    '          "id,brand_id,treatment_id,treatment_label,title,description,status,priority,assignee_member_id,assignee_email,created_by_email,start_date,start_time,due_date,due_time,performance_marker,completed_at,updated_at"',
)
replace_once(
    work_tasks_path,
    '''        .in("brand_id", brandIds)
        .or(
          `due_date.is.null,and(due_date.gte.${shiftDate(weekStart, -14)},due_date.lte.${shiftDate(weekEnd, 14)})`
        )
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false }),''',
    '''        .in("brand_id", brandIds)
        .gte("start_date", weekStart)
        .lte("start_date", weekEnd)
        .order("start_date", { ascending: true })
        .order("start_time", { ascending: true, nullsFirst: true })
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false }),''',
)
replace_once(
    work_tasks_path,
    "        createdByEmail: textValue(row.created_by_email, 180),\n        dueDate: textValue(row.due_date, 10),",
    "        createdByEmail: textValue(row.created_by_email, 180),\n        startDate: textValue(row.start_date, 10) || weekStart,\n        startTime: textValue(row.start_time, 16),\n        dueDate: textValue(row.due_date, 10),",
)
replace_once(
    work_tasks_path,
    '''  tasks = tasks.filter(
    (task) =>
      task.dueDate === null ||
      (task.dueDate >= weekStart && task.dueDate <= weekEnd) ||
      (task.status !== "done" && task.dueDate < weekStart)
  );''',
    '''  tasks = tasks.filter(
    (task) => task.startDate >= weekStart && task.startDate <= weekEnd
  );''',
)

# 2) Server actions: validate and persist Start Day; keep linked Calendar on Due Day.
actions_path = "src/app/tasks/actions.ts"
replace_once(
    actions_path,
    '.select("id,brand_id,title,status,assignee_member_id,assignee_email")',
    '.select("id,brand_id,title,status,assignee_member_id,assignee_email,start_date,start_time,due_date,due_time")',
)
replace_once(
    actions_path,
    '''function actorEmail(access: { email?: string; accessLevel: string }) {
  return access.email || (access.accessLevel === "master" ? "master" : "shared_admin");
}
''',
    '''function actorEmail(access: { email?: string; accessLevel: string }) {
  return access.email || (access.accessLevel === "master" ? "master" : "shared_admin");
}

function compactTime(value: unknown) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, 5)
    : "";
}

function scheduleSummary(input: {
  title: string;
  startDate: string;
  startTime?: string | null;
  dueDate?: string | null;
  dueTime?: string | null;
}) {
  const start = `Start ${input.startDate}${input.startTime ? ` ${compactTime(input.startTime)}` : ""}`;
  const due = input.dueDate
    ? `Due ${input.dueDate}${input.dueTime ? ` ${compactTime(input.dueTime)}` : ""}`
    : "Due 未設定";
  return `${input.title}\\n${start} · ${due}`;
}

function returnPathForTaskStart(path: string, startDate: string, taskId: string) {
  const url = new URL(path, "https://growth-os.internal");
  url.searchParams.set("week", startDate);
  url.searchParams.set("focus", taskId);
  url.searchParams.delete("command_status");
  url.searchParams.delete("message");
  return `${url.pathname}?${url.searchParams.toString()}`;
}
''',
)
replace_once(
    actions_path,
    '''  const assigneeMemberId = readString(formData, "assigneeMemberId") || null;
  const dueDate = readString(formData, "dueDate") || null;
  const dueTime = readString(formData, "dueTime") || null;''',
    '''  const assigneeMemberId = readString(formData, "assigneeMemberId") || null;
  const startDate = readString(formData, "startDate");
  const startTime = readString(formData, "startTime") || null;
  const dueDate = readString(formData, "dueDate") || null;
  const dueTime = readString(formData, "dueTime") || null;''',
)
replace_once(
    actions_path,
    '''  if (dueDate && !/^\\d{4}-\\d{2}-\\d{2}$/.test(dueDate)) {
    redirectResult(returnPath, false, "請檢查截止日期。" );
  }
  if (dueTime && !/^\\d{2}:\\d{2}/.test(dueTime)) {
    redirectResult(returnPath, false, "請檢查截止時間。" );
  }''',
    '''  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(startDate)) {
    redirectResult(returnPath, false, "請設定有效 Start Day／派 Job 日。" );
  }
  if (startTime && !/^\\d{2}:\\d{2}/.test(startTime)) {
    redirectResult(returnPath, false, "請檢查 Start Time。" );
  }
  if (dueDate && !/^\\d{4}-\\d{2}-\\d{2}$/.test(dueDate)) {
    redirectResult(returnPath, false, "請檢查 Due Day／截止日期。" );
  }
  if (dueTime && !/^\\d{2}:\\d{2}/.test(dueTime)) {
    redirectResult(returnPath, false, "請檢查 Due Time。" );
  }
  if (dueDate && dueDate < startDate) {
    redirectResult(returnPath, false, "Due Day 唔可以早過 Start Day。" );
  }''',
)
replace_once(
    actions_path,
    '''      created_by_member_id: access.memberId || null,
      created_by_email: actorEmail(access),
      due_date: dueDate,
      due_time: dueTime,''',
    '''      created_by_member_id: access.memberId || null,
      created_by_email: actorEmail(access),
      start_date: startDate,
      start_time: startTime,
      due_date: dueDate,
      due_time: dueTime,''',
)
replace_once(
    actions_path,
    '''    type: "task_assigned",
    title: "你有新工作事項",
    body: title,
    dedupeKey: `task_assigned:${task.id}:${assigneeMemberId || "none"}`,''',
    '''    type: "task_assigned",
    title: "你有新工作事項",
    body: scheduleSummary({ title, startDate, startTime, dueDate, dueTime }),
    dedupeKey: `task_assigned:${task.id}:${assigneeMemberId || "none"}`,''',
)
schedule_action = r'''
export async function updateWorkTaskScheduleAction(formData: FormData) {
  const returnPath = safeReturnPath(readString(formData, "returnPath"));
  const access = await requireTaskOperator(returnPath);
  const taskId = readString(formData, "taskId");
  const startDate = readString(formData, "startDate");
  const startTime = readString(formData, "startTime") || null;
  const dueDate = readString(formData, "dueDate") || null;
  const dueTime = readString(formData, "dueTime") || null;
  if (!taskId || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    redirectResult(returnPath, false, "請設定有效 Start Day。" );
  }
  if (startTime && !/^\d{2}:\d{2}/.test(startTime)) {
    redirectResult(returnPath, false, "請檢查 Start Time。" );
  }
  if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    redirectResult(returnPath, false, "請檢查 Due Day。" );
  }
  if (dueTime && !/^\d{2}:\d{2}/.test(dueTime)) {
    redirectResult(returnPath, false, "請檢查 Due Time。" );
  }
  if (dueDate && dueDate < startDate) {
    redirectResult(returnPath, false, "Due Day 唔可以早過 Start Day。" );
  }

  const taskResult = await getAccessibleTask(taskId, access);
  if (
    taskResult.error ||
    !taskResult.data ||
    !canAccessInternalBrand(access, taskResult.data.brand_id)
  ) {
    redirectResult(returnPath, false, "你未獲授權更新呢項工作日期。" );
  }

  const supabase = createSupabaseAdminClient();
  const linksResult = await supabase
    .from("marketing_task_calendar_links")
    .select("calendar_item_id")
    .eq("task_id", taskId);
  if (linksResult.error) {
    redirectResult(returnPath, false, "未能核對相關營銷日曆事項。" );
  }
  const calendarItemIds = (linksResult.data ?? [])
    .map((row) => String(row.calendar_item_id ?? ""))
    .filter(Boolean);
  if (calendarItemIds.length > 0 && !dueDate) {
    redirectResult(
      returnPath,
      false,
      "已連結營銷日曆嘅工作必須保留 Due Day／出街日期。"
    );
  }

  const currentDueDate = String(taskResult.data.due_date ?? "");
  const currentDueTime = compactTime(taskResult.data.due_time);
  const dueChanged =
    (dueDate || "") !== currentDueDate ||
    compactTime(dueTime) !== currentDueTime;
  if (calendarItemIds.length > 0 && dueChanged) {
    const calendarStatus = await supabase
      .from("marketing_calendar_items")
      .select("id,status")
      .in("id", calendarItemIds);
    if (calendarStatus.error) {
      redirectResult(returnPath, false, "未能核對日曆發布狀態。" );
    }
    if ((calendarStatus.data ?? []).some((item) => item.status === "published")) {
      redirectResult(
        returnPath,
        false,
        "已 Published 嘅日曆事項唔可以再改 Due Day；請另建新事項保留歷史紀錄。"
      );
    }
  }

  const { error } = await supabase
    .from("marketing_work_tasks")
    .update({
      start_date: startDate,
      start_time: startTime,
      due_date: dueDate,
      due_time: dueTime,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);
  if (error) {
    redirectResult(returnPath, false, "工作日期更新失敗。" );
  }

  if (calendarItemIds.length > 0 && dueChanged && dueDate) {
    const calendarUpdate = await supabase
      .from("marketing_calendar_items")
      .update({
        scheduled_date: dueDate,
        scheduled_time: dueTime,
        updated_at: new Date().toISOString(),
      })
      .in("id", calendarItemIds);
    if (calendarUpdate.error) {
      redirectResult(
        returnPath,
        false,
        "工作已更新，但相關營銷日曆未能同步；請立即檢查日曆。"
      );
    }
  }

  if (
    taskResult.data.assignee_member_id &&
    taskResult.data.assignee_member_id !== access.memberId
  ) {
    await insertNotification({
      recipientMemberId: taskResult.data.assignee_member_id,
      recipientEmail: taskResult.data.assignee_email,
      brandId: taskResult.data.brand_id,
      taskId,
      type: "task_schedule_changed",
      title: "工作日期已更新",
      body: scheduleSummary({
        title: taskResult.data.title,
        startDate,
        startTime,
        dueDate,
        dueTime,
      }),
    });
  }
  revalidateOps();
  redirectResult(
    returnPathForTaskStart(returnPath, startDate, taskId),
    true,
    calendarItemIds.length > 0 && dueChanged
      ? "Start Day 已更新；Due Day 亦已同步至營銷日曆。"
      : "工作 Start Day／Due Day 已更新。"
  );
}

'''
replace_once(
    actions_path,
    "export async function updateWorkTaskStatusAction(formData: FormData) {",
    schedule_action + "export async function updateWorkTaskStatusAction(formData: FormData) {",
)
replace_once(
    actions_path,
    '''    type: "task_assigned",
    title: "你獲派一項工作",
    body: taskResult.data.title,
  });''',
    '''    type: "task_assigned",
    title: "你獲派一項工作",
    body: scheduleSummary({
      title: taskResult.data.title,
      startDate: String(taskResult.data.start_date ?? ""),
      startTime: taskResult.data.start_time,
      dueDate: taskResult.data.due_date,
      dueTime: taskResult.data.due_time,
    }),
  });''',
)

# 3) Calendar-created work receives its own Start Day while scheduled_date remains Due Day.
calendar_actions_path = "src/app/calendar/actions.ts"
replace_once(
    calendar_actions_path,
    '''  const createTask = readBool(formData, "createTask");
  const taskPriority = readString(formData, "taskPriority") || "normal";''',
    '''  const createTask = readBool(formData, "createTask");
  const taskPriority = readString(formData, "taskPriority") || "normal";
  const taskStartDate = readString(formData, "taskStartDate");
  const taskStartTime = readString(formData, "taskStartTime") || null;
  const effectiveTaskStartDate = taskStartDate || scheduledDate;''',
)
replace_once(
    calendar_actions_path,
    '''  if (!(["low", "normal", "high"] as string[]).includes(taskPriority)) {
    redirectResult(returnPath, false, "請選擇有效工作 Priority。" );
  }
''',
    '''  if (!(["low", "normal", "high"] as string[]).includes(taskPriority)) {
    redirectResult(returnPath, false, "請選擇有效工作 Priority。" );
  }
  if (
    createTask &&
    (!/^\\d{4}-\\d{2}-\\d{2}$/.test(effectiveTaskStartDate) ||
      effectiveTaskStartDate > scheduledDate)
  ) {
    redirectResult(
      returnPath,
      false,
      "同步工作嘅 Start Day 必須有效，而且唔可以遲過 Due／出街日期。"
    );
  }
  if (createTask && taskStartTime && !/^\\d{2}:\\d{2}/.test(taskStartTime)) {
    redirectResult(returnPath, false, "請檢查同步工作 Start Time。" );
  }
''',
)
replace_once(
    calendar_actions_path,
    '''        created_by_email:
          verified.access.email ||
          (verified.access.accessLevel === "master" ? "master" : "shared_admin"),
        due_date: scheduledDate,
        due_time: scheduledTime,''',
    '''        created_by_email:
          verified.access.email ||
          (verified.access.accessLevel === "master" ? "master" : "shared_admin"),
        start_date: effectiveTaskStartDate,
        start_time: taskStartTime,
        due_date: scheduledDate,
        due_time: scheduledTime,''',
)
replace_once(
    calendar_actions_path,
    '''          notification_type: "task_assigned",
          title: "你有新工作事項",
          body: title,
          dedupe_key: `calendar_task_assigned:${calendarItem.id}:${assignee.id}`,''',
    '''          notification_type: "task_assigned",
          title: "你有新工作事項",
          body: `${title}\\nStart ${effectiveTaskStartDate}${taskStartTime ? ` ${taskStartTime.slice(0, 5)}` : ""} · Due ${scheduledDate}${scheduledTime ? ` ${scheduledTime.slice(0, 5)}` : ""}`,
          dedupe_key: `calendar_task_assigned:${calendarItem.id}:${assignee.id}`,''',
)

calendar_page_path = "src/app/calendar/page.tsx"
replace_once(
    calendar_page_path,
    "                {snapshot.month.label} · Idea → Scheduled → Published。Scheduled 事項到排定 HKT 時間會自動發布，亦可以同步建立 Weekly 工作。",
    "                {snapshot.month.label} · 日曆日期代表 Due／出街日。Scheduled 事項到排定 HKT 時間會自動發布；同步工作可另設較早嘅 Start Day。",
)
replace_once(
    calendar_page_path,
    "                <span>日期</span>",
    "                <span>Due／出街日期</span>",
)
replace_once(
    calendar_page_path,
    '              <div className="calendar-notes-field grid gap-2 rounded-2xl border border-[#ead9cf] bg-[#fff9f3] p-3 sm:grid-cols-2">',
    '              <div className="calendar-notes-field grid gap-2 rounded-2xl border border-[#ead9cf] bg-[#fff9f3] p-3 sm:grid-cols-2 lg:grid-cols-4">',
)
replace_once(
    calendar_page_path,
    "                    <small>建立一項 linked Weekly Task；如負責人係系統同事會收到通知。</small>",
    "                    <small>建立 linked Weekly Task；工作列表跟 Start Day，日曆同出街仍跟 Due Day。</small>",
)
replace_once(
    calendar_page_path,
    '''                <label>
                  <span>同步工作 Priority</span>
                  <select name="taskPriority" defaultValue="normal">''',
    '''                <label>
                  <span>同步工作 Start Day</span>
                  <input
                    type="date"
                    name="taskStartDate"
                    defaultValue={createDefaultDate}
                  />
                  <small>決定工作出現喺邊一週；必須早過或等於 Due／出街日期。</small>
                </label>
                <label>
                  <span>同步工作 Start Time</span>
                  <input type="time" name="taskStartTime" />
                  <small>留空會於 Start Day 09:00 HKT 提醒。</small>
                </label>
                <label>
                  <span>同步工作 Priority</span>
                  <select name="taskPriority" defaultValue="normal">''',
)

# 4) Build and browser regressions.
package_path = ROOT / "package.json"
package = json.loads(package_path.read_text(encoding="utf-8"))
scripts = package.setdefault("scripts", {})
verification = "npm run verify:work-ops-contract"
if verification not in scripts["build"]:
    scripts["build"] = scripts["build"].replace(
        " && next build", f" && {verification} && next build"
    )
scripts["verify:work-ops-contract"] = (
    "node scripts/verify-work-task-push-contract.mjs"
)
package_path.write_text(
    json.dumps(package, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
)

e2e_path = "e2e/connected-marketing-ops.spec.ts"
replace_once(
    e2e_path,
    '''  await expect(page.getByText("同步建立工作事項", { exact: true })).toBeVisible();
});''',
    '''  await expect(page.getByText("同步建立工作事項", { exact: true })).toBeVisible();
  await expect(page.getByText("Due／出街日期", { exact: true })).toBeVisible();
  await expect(page.locator('input[name="taskStartDate"]')).toBeVisible();
});''',
)
replace_once(
    e2e_path,
    '''  await expect(page.getByText("期限", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Priority", { exact: true }).first()).toBeVisible();''',
    '''  await expect(page.getByText("Start Day", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Due／出街", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Priority", { exact: true }).first()).toBeVisible();''',
)
replace_once(
    e2e_path,
    '''  await expect(page.getByText(/只顯示擁有此品牌 Access/)).toBeVisible();

  const firstTask = page.locator("[data-task-id]").first();''',
    '''  await expect(page.getByText(/只顯示擁有此品牌 Access/)).toBeVisible();
  await expect(page.getByTestId("task-create-form").locator('input[name="startDate"]')).toBeVisible();
  await expect(page.getByTestId("desktop-notification-control")).toBeVisible();

  const firstTask = page.locator("[data-task-id]").first();''',
)
replace_once(
    e2e_path,
    '''  await expect(firstTask.getByTestId("task-status-form").getByRole("button", { name: "更新" })).toBeVisible();
  const deleteControl = firstTask.getByTestId("task-delete-control");''',
    '''  await expect(firstTask.getByTestId("task-status-form").getByRole("button", { name: "更新" })).toBeVisible();
  await firstTask.locator("summary").first().click();
  const scheduleForm = firstTask.getByTestId("task-schedule-form");
  await expect(scheduleForm.locator('input[name="startDate"]')).toBeVisible();
  await expect(scheduleForm.locator('input[name="dueDate"]')).toBeVisible();
  await expect(scheduleForm.getByRole("button", { name: "更新日期" })).toBeVisible();
  const deleteControl = firstTask.getByTestId("task-delete-control");''',
)

print("Task Start Day, Due Day, Calendar sync and Web Push integration patched.")
