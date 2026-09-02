import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

const action = read("src/app/calendar/updateAction.ts");
const dialog = read("src/components/command-center/CalendarItemEditDialog.tsx");
const board = read("src/components/command-center/MarketingCalendarBoard.tsx");
const page = read("src/app/calendar/page.tsx");
const snapshot = read("src/lib/marketing/marketingCalendar.ts");
const shared = read("src/lib/marketing/calendarEdit.ts");
const commandActions = read("src/app/command-center/actions.ts");
const migration = read(
  "supabase/migrations/20260902024000_editable_marketing_calendar_items.sql"
);
const test = read("e2e/marketing-calendar-edit.spec.ts");
const packageJson = JSON.parse(read("package.json"));

assert.match(action, /updateCalendarItemAction/);
assert.match(action, /requireModuleAccess\("calendar"\)/);
assert.match(action, /canAccessInternalBrand/);
assert.match(action, /existingBrandId/);
assert.match(action, /marketing_calendar_items/);
assert.match(action, /expectedUpdatedAt/);
assert.match(action, /update_marketing_calendar_item_with_links/);
assert.match(dialog, /編輯日曆事項/);
assert.match(dialog, /showOnPerformanceTimeline/);
assert.match(dialog, /saveAction/);
assert.match(board, /CalendarItemEditDialog/);
assert.match(board, /calendar-task-edit/);
assert.match(page, /treatments=\{snapshot\.treatments/);
assert.match(snapshot, /show_on_performance_timeline,updated_at/);
assert.match(shared, /editableCalendarStatuses/);
assert.match(commandActions, /item\.updatedAt/);

assert.match(migration, /for update/);
assert.match(migration, /stale_calendar_item/);
assert.match(migration, /marketing_task_calendar_links/);
assert.match(migration, /update public\.creative_jobs/);
assert.match(migration, /creative_job_audit/);
assert.match(migration, /marketing_command_center_audit/);
assert.match(migration, /calendar_before_creative_due/);
assert.match(migration, /calendar_assignee_brand_access/);
assert.match(migration, /calendar_linked_designer_brand_access/);
assert.match(test, /calendar item can be fully edited/);
assert.match(test, /toHaveScreenshot/);
assert.match(test, /AxeBuilder/);
assert.ok(packageJson.scripts?.["verify:calendar-edit-contract"]);

console.log(
  "Editable Calendar dialog, dual-brand authorization, linked-record sync, concurrency, audit and visual acceptance contracts verified."
);
