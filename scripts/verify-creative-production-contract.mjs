import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

const permissions = read("src/lib/security/workspacePermissions.ts");
const internalAccess = read("src/lib/security/internalAccess.ts");
const nav = read("src/components/alyssa/AppNavClient.tsx");
const teamSettings = read("src/app/settings/team/page.tsx");
const migration = read(
  "supabase/migrations/20260901020000_creative_production_studio.sql"
);
const actions = read("src/app/creative-jobs/actions.ts");
const safeDeleteMigration = read(
  "supabase/migrations/20260901104500_creative_job_safe_delete_and_push_guard.sql"
);
const createAction = read("src/app/creative-jobs/createAction.ts");
const createState = read("src/lib/creative/createState.ts");
const createDialog = read("src/components/creative/CreativeJobCreateDialog.tsx");
const store = read("src/lib/creative/store.ts");
const creativeTypes = read("src/lib/creative/types.ts");
const editor = read("src/components/creative/CreativeBriefEditor.tsx");
const studio = read("src/components/creative/CreativeJobStudio.tsx");
const listPage = read("src/app/creative-jobs/page.tsx");
const deleteControl = read("src/components/creative/CreativeJobDeleteControl.tsx");
const historyDialog = read("src/components/creative/CreativeBriefHistoryDialog.tsx");
const editorStyles = read("src/components/creative/CreativeBriefEditor.module.css");
const detailPage = read("src/app/creative-jobs/[jobId]/page.tsx");
const edgeFunction = read(
  "supabase/functions/marketing-web-push-dispatch/index.ts"
);
const packageJson = JSON.parse(read("package.json"));

assert.match(permissions, /"creative_jobs"/);
assert.match(permissions, /marketer:[\s\S]*?"creative_jobs"/);
assert.match(permissions, /designer:[\s\S]*?"creative_jobs"/);
const csBlock = permissions.match(/cs:\s*\[([^\]]*)\]/)?.[1] ?? "";
assert.doesNotMatch(csBlock, /creative_jobs/);
assert.match(permissions, /pathname\.startsWith\("\/creative-jobs"\)/);
assert.match(internalAccess, /\| "creative_jobs"/);
assert.match(nav, /href: "\/creative-jobs"/);
assert.match(nav, /label: "設計工作"/);
assert.match(teamSettings, /\["creative_jobs", "設計工作"\]/);

for (const table of [
  "creative_taxonomy_items",
  "creative_designer_profiles",
  "creative_jobs",
  "creative_job_assets",
  "creative_job_comments",
  "creative_job_brief_versions",
  "creative_job_audit",
]) {
  assert.match(migration, new RegExp(`create table if not exists public\\.${table}`));
}
assert.match(migration, /default \(\(now\(\) at time zone 'Asia\/Hong_Kong'\)::date\)/);
assert.match(migration, /values \('Amber', 10\), \('Vicky', 20\)/);
assert.match(migration, /category in \('source', 'usage', 'media_format'\)/);
assert.match(migration, /workspace_role in \('owner', 'admin', 'manager', 'marketer', 'designer'\)/);
assert.match(migration, /workspace_role in \('cs', 'viewer'\)/);
assert.match(migration, /save_creative_job_with_calendar/);
assert.match(migration, /queue_creative_job_reminders/);
assert.match(migration, /restore_creative_brief_version/);
assert.match(migration, /creative-job-assets/);

assert.match(actions, /createCreativeDraftAction/);
assert.match(createAction, /^"use server";/);
assert.match(createAction, /export async function createCreativeJobAction/);
assert.doesNotMatch(
  createAction,
  /^export\s+(?:const|let|var|class)\s+/m
);
assert.match(createState, /initialCreativeJobCreateState/);
assert.match(createDialog, /@\/lib\/creative\/createState/);
assert.match(createDialog, /SystemButton/);
assert.doesNotMatch(
  createDialog,
  /initialCreativeJobCreateState,[\s\S]*?createAction/
);
assert.match(actions, /updateCreativeJobAction/);
assert.match(actions, /isCreativeOperationsRole/);
assert.match(actions, /creative_assigned/);
assert.match(actions, /save_creative_job_with_calendar/);
assert.match(store, /getCreativeWorkspaceRole\(access\) === "designer"/);
assert.match(store, /assignee_member_id/);
assert.match(store, /requesterName/);
assert.match(creativeTypes, /requesterName: string \| null/);
const sortContract = store.match(/function sortJobs[\s\S]*?\n}\n/)?.[0] ?? "";
assert.ok(
  sortContract.indexOf("const start =") < sortContract.indexOf("const priority ="),
  "Creative Job List must sort by Start Day before priority"
);
assert.match(store, /if \(!filters\.status && !filters\.view\)/);
assert.match(actions, /派 Job 畀 Designer 前必須設定 Due Day/);
assert.match(actions, /Source、用途同媒體格式/);
assert.match(migration, /workspace_member_module_permissions_key_check/);
assert.match(migration, /creative_calendar_already_published/);

assert.match(editor, /@tiptap\/react/);
assert.match(editor, /@tiptap\/extension-text-style/);
assert.match(editor, /Color, TextStyle/);
assert.match(editor, /setColor/);
assert.match(editor, /unsetColor/);
assert.doesNotMatch(editor, /onAssetCreated/);
assert.match(editor, /不會列入正式素材/);
assert.match(editor, /creative-brief-toolbar/);
assert.match(editorStyles, /position: sticky/);
assert.match(editorStyles, /overflow: visible/);
assert.match(editor, /FileHandler\.configure/);
assert.match(editor, /onDrop:/);
assert.match(editor, /onPaste:/);
assert.match(editor, /Ctrl \+ V/);
assert.match(editor, /\/api\/creative-jobs\/\$\{jobId\}\/brief/);
assert.match(editor, /persistenceEnabled/);
assert.match(studio, /同步營銷日曆/);
assert.match(studio, /Start Day/);
assert.match(studio, /Due Day/);
assert.match(studio, /Publish Day/);
assert.match(listPage, /Source/);
assert.match(listPage, /媒體格式/);
assert.match(listPage, /Designer/);
assert.match(listPage, /建立者：/);
assert.match(listPage, /creative-job-row/);
assert.match(listPage, /CreativeJobDeleteControl/);
assert.match(listPage, /listReturnPath/);
assert.match(listPage, /returnPath=\{listReturnPath\}/);
assert.match(deleteControl, /SystemConfirmationDialog/);
assert.match(deleteControl, /deleteCreativeJobAction/);
assert.match(deleteControl, /creative-job-list-delete-button/);
assert.match(deleteControl, /creative-job-delete-button/);
assert.match(deleteControl, /icon-sm/);
assert.match(studio, /建立者/);
assert.match(studio, /CreativeJobDeleteControl/);
assert.match(studio, /CreativeBriefHistoryDialog/);
assert.match(studio, /creative-job-settings-form/);
assert.match(studio, /value=\{draft\.title\}/);
assert.match(studio, /creative-job-settings-feedback/);
assert.match(studio, /creative-job-settings-draft:/);
assert.match(studio, /sessionStorage\.setItem/);
assert.match(studio, /sessionStorage\.getItem/);
assert.doesNotMatch(studio, /type RightPanel/);
assert.doesNotMatch(studio, /Job 素材庫/);
assert.doesNotMatch(studio, /留言／修改要求/);
assert.match(historyDialog, /SystemButton/);
assert.match(historyDialog, /creative-brief-version-dialog/);
assert.match(detailPage, /key=\{detail\.job\.id\}/);
assert.match(detailPage, /creative_message/);
assert.match(actions, /readString\(formData, "returnPath"\)/);
assert.match(actions, /redirectWithMessage\(\s*returnPath/);
assert.match(actions, /soft_delete_creative_job_and_retire_notifications/);
assert.match(actions, /cancelledDeliveryCount/);
assert.match(actions, /publishedCalendarPreserved/);
assert.match(actions, /未送出提醒已取消/);
assert.match(
  safeDeleteMigration,
  /soft_delete_creative_job_and_retire_notifications/
);
assert.match(safeDeleteMigration, /delivery\.status in \('pending', 'retry', 'sending'\)/);
assert.match(safeDeleteMigration, /last_error = 'creative_job_deleted'/);
assert.match(safeDeleteMigration, /notification\.is_read = false/);
assert.match(safeDeleteMigration, /v_calendar_status = 'published'/);
assert.match(safeDeleteMigration, /claim_marketing_web_push_deliveries/);

assert.match(edgeFunction, /creative_job_id/);
assert.match(edgeFunction, /action_url/);
assert.match(edgeFunction, /creative_overdue/);
assert.match(edgeFunction, /activeCreativeJobIds/);
assert.match(edgeFunction, /creative_job_state_query_failed/);
assert.match(edgeFunction, /last_error: "creative_job_deleted"/);

for (const dependency of [
  "@tiptap/react",
  "@tiptap/starter-kit",
  "@tiptap/extension-image",
  "@tiptap/extension-link",
  "@tiptap/extension-task-list",
  "@tiptap/extension-task-item",
  "@tiptap/extension-placeholder",
  "@tiptap/extension-file-handler",
  "@tiptap/extension-underline",
  "@tiptap/extension-text-style",
]) {
  assert.ok(
    packageJson.dependencies?.[dependency],
    `Missing rich brief dependency: ${dependency}`
  );
}
assert.ok(packageJson.scripts?.["verify:creative-production-contract"]);
assert.match(packageJson.scripts.build, /verify:creative-production-contract/);

console.log(
  "Creative Production Studio schema, permissions, navigation, rich brief, calendar, audit and Web Push contracts verified."
);
