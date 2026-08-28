from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "src/app/tasks/actions.ts"
content = PATH.read_text(encoding="utf-8")

function_start = content.index(
    "export async function updateWorkTaskScheduleAction(formData: FormData) {"
)
block_start = content.index(
    "  const supabase = createSupabaseAdminClient();", function_start
)
block_end = content.index(
    "\n\n  if (\n    taskResult.data.assignee_member_id", block_start
)

replacement = '''  const supabase = createSupabaseAdminClient();
  const scheduleResult = await supabase.rpc(
    "update_marketing_work_task_schedule",
    {
      task_id_input: taskId,
      start_date_input: startDate,
      start_time_input: startTime,
      due_date_input: dueDate,
      due_time_input: dueTime,
    }
  );
  if (scheduleResult.error) {
    console.warn("marketing_work_task_schedule_rpc_failed", {
      code: scheduleResult.error.code,
    });
    redirectResult(
      returnPath,
      false,
      "工作日期同步失敗，Task 同營銷日曆均未有更改。"
    );
  }

  const schedulePayload =
    scheduleResult.data &&
    typeof scheduleResult.data === "object" &&
    !Array.isArray(scheduleResult.data)
      ? (scheduleResult.data as Record<string, unknown>)
      : {};
  if (schedulePayload.ok !== true) {
    const reason = String(schedulePayload.reason ?? "");
    const message =
      reason === "linked_due_required"
        ? "已連結營銷日曆嘅工作必須保留 Due Day／出街日期。"
        : reason === "published_calendar_immutable"
          ? "已 Published 嘅日曆事項唔可以再改 Due Day；Start Day 仍可獨立調整。"
          : reason === "due_before_start"
            ? "Due Day 唔可以早過 Start Day。"
            : reason === "task_not_found"
              ? "工作已不存在，請重新整理。"
              : "工作日期更新失敗，Task 同營銷日曆均未有更改。";
    redirectResult(returnPath, false, message);
  }

  const linkedCount = Number(schedulePayload.linkedCount ?? 0);
  const dueChanged = schedulePayload.dueChanged === true;'''

content = content[:block_start] + replacement + content[block_end:]

function_end = content.index(
    "\nexport async function updateWorkTaskStatusAction", function_start
)
function_body = content[function_start:function_end]
old = "calendarItemIds.length > 0 && dueChanged"
if function_body.count(old) != 1:
    raise RuntimeError(
        f"Expected one legacy schedule success condition, found {function_body.count(old)}"
    )
function_body = function_body.replace(old, "linkedCount > 0 && dueChanged", 1)
content = content[:function_start] + function_body + content[function_end:]

PATH.write_text(content, encoding="utf-8")
print("Task schedule Server Action now uses atomic database RPC.")
