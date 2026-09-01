from __future__ import annotations

from pathlib import Path
import re
import textwrap


def read(path: str) -> str:
    return Path(path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(content, encoding="utf-8")


def replace_once(content: str, old: str, new: str, label: str) -> str:
    count = content.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one match, found {count}")
    return content.replace(old, new, 1)


def sub_once(content: str, pattern: str, replacement: str, label: str, flags: int = 0) -> str:
    updated, count = re.subn(pattern, replacement, content, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f"{label}: expected one regex match, found {count}")
    return updated


# ---------------------------------------------------------------------------
# 1. Fix the production module-evaluation crash.
# A `use server` module may export runtime functions only. The action file was
# exporting an initial-state object, which passed build but failed at runtime.
# ---------------------------------------------------------------------------
create_action_path = "src/app/creative-jobs/createAction.ts"
create_action = read(create_action_path)

create_action = create_action.replace(
    "export type CreativeJobCreateState = {",
    "type CreativeJobCreateState = {",
    1,
)
create_action, initial_state_count = re.subn(
    r"export const initialCreativeJobCreateState: CreativeJobCreateState = \{\s*"
    r"status: \"idle\",\s*message: \"\",\s*\};\s*",
    "",
    create_action,
    count=1,
)
if initial_state_count != 1:
    raise SystemExit("createAction.ts: exported initial state object was not found")
if re.search(r"export\s+(?:const|let|var|class)\s+", create_action):
    raise SystemExit("createAction.ts still exports a non-function runtime value")
if 'export async function createCreativeJobAction' not in create_action:
    raise SystemExit("createAction.ts lost the create action export")
write(create_action_path, create_action)


dialog_path = "src/components/creative/CreativeJobCreateDialog.tsx"
dialog = read(dialog_path)
dialog = sub_once(
    dialog,
    r'import \{\s*createCreativeJobAction,\s*initialCreativeJobCreateState,\s*\} '
    r'from "@/app/creative-jobs/createAction";',
    'import { createCreativeJobAction } from "@/app/creative-jobs/createAction";',
    "CreativeJobCreateDialog server import",
    flags=re.S,
)

props_match = re.search(
    r"type CreativeJobCreateDialogProps = \{.*?\n\};\n",
    dialog,
    flags=re.S,
)
if not props_match:
    raise SystemExit("CreativeJobCreateDialog props block was not found")
local_state = textwrap.dedent(
    '''

    type CreativeJobCreateState = {
      status: "idle" | "error";
      message: string;
    };

    const initialCreativeJobCreateState: CreativeJobCreateState = {
      status: "idle",
      message: "",
    };
    '''
)
dialog = (
    dialog[: props_match.end()]
    + local_state
    + dialog[props_match.end() :]
)
write(dialog_path, dialog)


# ---------------------------------------------------------------------------
# 2. Add one reusable, clearly labelled delete control.
# ---------------------------------------------------------------------------
delete_component_path = "src/components/creative/CreativeJobDeleteButton.tsx"
delete_component = textwrap.dedent(
    '''
    "use client";

    import { Trash2 } from "lucide-react";
    import { deleteCreativeJobAction } from "@/app/creative-jobs/actions";
    import { ConfirmSubmitButton } from "@/components/alyssa/ConfirmSubmitButton";

    export function CreativeJobDeleteButton({
      jobId,
      title,
      compact = false,
      fullWidth = false,
      fixtureMode = false,
    }: {
      jobId: string;
      title: string;
      compact?: boolean;
      fullWidth?: boolean;
      fixtureMode?: boolean;
    }) {
      const accessibleLabel = compact ? `刪除 ${title}` : "刪除 Job";
      const buttonClass = compact
        ? "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-[#e5c5c8] bg-white px-2.5 text-[10px] font-black text-[#a43b50] transition hover:border-[#cf969d] hover:bg-[#fff5f5] xl:w-8 xl:px-0"
        : `inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-[#e5c5c8] bg-white px-3 text-xs font-black text-[#a43b50] transition hover:border-[#cf969d] hover:bg-[#fff5f5] ${fullWidth ? "w-full" : ""}`;

      return (
        <form
          action={fixtureMode ? undefined : deleteCreativeJobAction}
          onSubmit={fixtureMode ? (event) => event.preventDefault() : undefined}
          className={fullWidth ? "w-full" : ""}
        >
          <input type="hidden" name="jobId" value={jobId} />
          <ConfirmSubmitButton
            className={buttonClass}
            pendingLabel="刪除中…"
            confirmMessage={`確定刪除「${title}」？工作會從 Job List 移除；Audit 紀錄仍然保留。`}
            aria-label={accessibleLabel}
            title="刪除 Job"
          >
            <Trash2 size={13} />
            <span className={compact ? "xl:sr-only" : ""}>刪除 Job</span>
          </ConfirmSubmitButton>
        </form>
      );
    }
    '''
).lstrip()
write(delete_component_path, delete_component)


# ---------------------------------------------------------------------------
# 3. Put delete directly in the Job List, outside the row link.
# ---------------------------------------------------------------------------
page_path = "src/app/creative-jobs/page.tsx"
page = read(page_path)
create_dialog_import = (
    'import { CreativeJobCreateDialog } from "@/components/creative/CreativeJobCreateDialog";\n'
)
page = replace_once(
    page,
    create_dialog_import,
    create_dialog_import
    + 'import { CreativeJobDeleteButton } from "@/components/creative/CreativeJobDeleteButton";\n',
    "Creative Jobs delete import",
)

old_grid = (
    "grid-cols-[minmax(240px,1.45fr)_minmax(150px,0.85fr)_"
    "minmax(260px,1.35fr)_minmax(240px,1.2fr)_minmax(110px,0.55fr)]"
)
new_header_grid = old_grid[:-1] + "_44px]"
if page.count(old_grid) < 2:
    raise SystemExit("Creative Jobs list grid contract changed unexpectedly")
page = page.replace(old_grid, new_header_grid, 1)

page = sub_once(
    page,
    r"(<span>狀態</span>)(\s*</div>\s*\{snapshot\.jobs\.map)",
    r'\1\n                      <span className="sr-only">操作</span>\2',
    "Creative Jobs operation header",
    flags=re.S,
)

map_start = page.find("{snapshot.jobs.map((job) => {")
if map_start < 0:
    raise SystemExit("Creative Jobs map start was not found")
return_start = page.find("                      return (", map_start)
link_start = page.find("                        <Link", return_start)
row_end_marker = "                        </Link>\n                      );"
row_end = page.find(row_end_marker, link_start)
if min(return_start, link_start, row_end) < 0:
    raise SystemExit("Creative Jobs row boundary was not found")
row_end += len(row_end_marker)

link_block = page[link_start : page.find("                        </Link>", link_start) + len("                        </Link>")]
link_block = replace_once(
    link_block,
    "                          key={job.id}\n",
    "",
    "Creative Jobs link key removal",
)
old_link_class = (
    'className="grid min-w-0 grid-cols-1 gap-4 border-b border-[#f0e7e2] '
    'px-4 py-4 text-[11px] font-semibold transition last:border-b-0 '
    'hover:bg-[#fff9fb] md:grid-cols-2 xl:'
    + old_grid
    + ' xl:items-center"'
)
new_link_class = (
    'className="grid min-w-0 grid-cols-1 gap-4 px-4 py-4 text-[11px] '
    'font-semibold md:grid-cols-2 xl:'
    + old_grid
    + ' xl:items-center"'
)
link_block = replace_once(
    link_block,
    old_link_class,
    new_link_class,
    "Creative Jobs row link class",
)

row_replacement = (
    "                      return (\n"
    "                        <article\n"
    "                          key={job.id}\n"
    "                          className=\"grid min-w-0 grid-cols-1 border-b border-[#f0e7e2] transition last:border-b-0 hover:bg-[#fff9fb] xl:grid-cols-[minmax(0,1fr)_44px] xl:items-stretch xl:gap-4\"\n"
    "                        >\n"
    + link_block
    + "\n"
    "                          {snapshot.canCreate ? (\n"
    "                            <div className=\"flex items-center justify-end px-4 pb-4 xl:px-0 xl:pb-0 xl:pr-3\">\n"
    "                              <CreativeJobDeleteButton\n"
    "                                jobId={job.id}\n"
    "                                title={job.title}\n"
    "                                compact\n"
    "                              />\n"
    "                            </div>\n"
    "                          ) : null}\n"
    "                        </article>\n"
    "                      );"
)
page = page[:return_start] + row_replacement + page[row_end:]
write(page_path, page)


# ---------------------------------------------------------------------------
# 4. Put the same clear delete action in the Job header and settings column.
# ---------------------------------------------------------------------------
studio_path = "src/components/creative/CreativeJobStudio.tsx"
studio = read(studio_path)
confirm_import = (
    'import { ConfirmSubmitButton } from "@/components/alyssa/ConfirmSubmitButton";\n'
)
studio = replace_once(
    studio,
    confirm_import,
    confirm_import
    + 'import { CreativeJobDeleteButton } from "@/components/creative/CreativeJobDeleteButton";\n',
    "Creative Job Studio delete import",
)
studio = replace_once(
    studio,
    "  deleteCreativeJobAction,\n",
    "",
    "Creative Job Studio old delete action import",
)

settings_pattern = (
    r"(\{props\.canManageSettings \? \(\s*"
    r"<Link\s+href=\"/settings/creative\".*?"
    r"<Settings2 size=\{15\} /> 分類及 Designer\s*"
    r"</Link>\s*\) : null\})"
)
studio = sub_once(
    studio,
    settings_pattern,
    r'''\1
          {props.canEditMetadata ? (
            <CreativeJobDeleteButton jobId={props.job.id} title={props.job.title} />
          ) : null}''',
    "Creative Job Studio header delete",
    flags=re.S,
)

bottom_delete_pattern = (
    r"\{props\.canEditMetadata \? \(\s*"
    r"<form action=\{deleteCreativeJobAction\}>.*?"
    r"<Trash2 size=\{14\} /> 封存呢張 Job.*?"
    r"</form>\s*\) : null\}"
)
studio = sub_once(
    studio,
    bottom_delete_pattern,
    '''{props.canEditMetadata ? (
            <CreativeJobDeleteButton
              jobId={props.job.id}
              title={props.job.title}
              fullWidth
            />
          ) : null}''',
    "Creative Job Studio bottom delete",
    flags=re.S,
)
write(studio_path, studio)


# ---------------------------------------------------------------------------
# 5. Keep the existing safe soft-delete, but make the outcome explicit.
# ---------------------------------------------------------------------------
actions_path = "src/app/creative-jobs/actions.ts"
actions = read(actions_path)
actions = replace_once(
    actions,
    'redirectWithMessage("/creative-jobs", true, "設計工作已移至系統封存。" );',
    'redirectWithMessage("/creative-jobs", true, "設計工作已刪除；Audit 紀錄仍然保留。" );',
    "Creative Job delete success message",
)
write(actions_path, actions)


# ---------------------------------------------------------------------------
# 6. Keep the fixture and acceptance coverage aligned with production.
# ---------------------------------------------------------------------------
fixture_path = "src/components/creative/CreativeProductionFixture.tsx"
fixture = read(fixture_path)
fixture_import = (
    'import { CreativeJobCreateDialog } from "@/components/creative/CreativeJobCreateDialog";\n'
)
fixture = replace_once(
    fixture,
    fixture_import,
    fixture_import
    + 'import { CreativeJobDeleteButton } from "@/components/creative/CreativeJobDeleteButton";\n',
    "Creative fixture delete import",
)
fixture = sub_once(
    fixture,
    r'''<span className="w-fit rounded-full bg-\[#f5f1ef\] px-2 py-1 text-\[9px\] font-black">\s*製作中\s*</span>''',
    '''<div className="flex flex-wrap items-center gap-2">
              <span className="w-fit rounded-full bg-[#f5f1ef] px-2 py-1 text-[9px] font-black">
                製作中
              </span>
              <CreativeJobDeleteButton
                jobId="fixture-job"
                title="GOS KOL 脫毛廣告片"
                compact
                fixtureMode
              />
            </div>''',
    "Creative fixture delete control",
    flags=re.S,
)
write(fixture_path, fixture)


test_path = "e2e/creative-production.spec.ts"
tests = read(test_path)
video_assertion = '  await expect(list).toContainText("Video");\n'
tests = replace_once(
    tests,
    video_assertion,
    video_assertion
    + '''  await expect(
    list.getByRole("button", { name: "刪除 GOS KOL 脫毛廣告片" })
  ).toBeVisible();
''',
    "Creative delete button acceptance",
)
dialog_test_marker = (
    'test("new Creative Job opens in a focused dialog and keeps date guidance contextual", async ({\n'
)
route_test = '''test("Creative Jobs route loads without invalid use-server exports", async ({ page }) => {
  const response = await page.goto("/creative-jobs", {
    waitUntil: "domcontentloaded",
  });
  expect(response?.status() ?? 500).toBeLessThan(500);
  await expect(page.getByRole("heading", { name: "設計工作" })).toBeVisible();
});

'''
tests = replace_once(
    tests,
    dialog_test_marker,
    route_test + dialog_test_marker,
    "Creative route runtime acceptance",
)
write(test_path, tests)


contract_path = "scripts/verify-creative-production-contract.mjs"
contract = read(contract_path)
action_read = 'const actions = read("src/app/creative-jobs/actions.ts");\n'
contract = replace_once(
    contract,
    action_read,
    action_read
    + 'const createAction = read("src/app/creative-jobs/createAction.ts");\n'
    + 'const createDialog = read("src/components/creative/CreativeJobCreateDialog.tsx");\n'
    + 'const deleteButton = read("src/components/creative/CreativeJobDeleteButton.tsx");\n',
    "Creative contract new source reads",
)
action_assertion = 'assert.match(actions, /createCreativeDraftAction/);\n'
contract = replace_once(
    contract,
    action_assertion,
    action_assertion
    + 'assert.doesNotMatch(createAction, /export\\s+(?:const|let|var|class)\\s+/);\n'
    + 'assert.match(createAction, /export async function createCreativeJobAction/);\n'
    + 'assert.match(createDialog, /const initialCreativeJobCreateState/);\n'
    + 'assert.match(deleteButton, /deleteCreativeJobAction/);\n'
    + 'assert.match(deleteButton, /Audit 紀錄仍然保留/);\n',
    "Creative contract server/delete assertions",
)
list_assertion = 'assert.match(listPage, /Designer/);\n'
contract = replace_once(
    contract,
    list_assertion,
    list_assertion
    + 'assert.match(listPage, /CreativeJobDeleteButton/);\n'
    + 'assert.match(studio, /CreativeJobDeleteButton/);\n'
    + 'assert.match(actions, /creative_job\.deleted/);\n',
    "Creative contract delete surface assertions",
)
write(contract_path, contract)


learning_path = (
    "docs/product-learning/entries/"
    "2026-09-01-creative-job-create-delete-hotfix.md"
)
learning = textwrap.dedent(
    '''
    # Creative Job 建立失敗與刪除入口修正

    ## 問題

    新增設計 Job 後，Production 顯示伺服器錯誤。Vercel Runtime Error 指向：`A "use server" file can only export async functions, found object.`

    同時，Job List 冇直接刪除入口；原有軟刪除操作只放喺 Job 詳情頁底部，而且文字寫成「封存」，使用者難以發現。

    ## 根因

    `src/app/creative-jobs/createAction.ts` 係 `use server` 模組，但除咗 async Server Action 外，亦 export 咗 `initialCreativeJobCreateState` object。Next.js Production runtime 會拒絕載入呢類非 async runtime export。

    ## 修正

    - Initial action state 移回 Client component，Server Action 模組只保留 async runtime export。
    - Job List 每行加入清晰「刪除 Job」入口，並避免將 button 放入 Link。
    - Job 詳情頁頂部同左側設定區都使用同一個刪除控制。
    - 刪除採用 soft delete：工作即時從日常 Job List 移除，但 Audit 紀錄仍然保留。
    - 加入實際 `/creative-jobs` route runtime acceptance，防止 Build 綠燈但 Production module evaluation 失敗。

    ## 可重用規則

    1. `use server` 檔案不得 export object、array、class 或其他 runtime value；共享 initial state 應放 Client／neutral module。
    2. 刪除操作要喺使用者管理資料嘅主要列表或頁首清晰可見，不應只藏喺長頁底部。
    3. 可回溯資料以 soft delete 處理，日常介面移除但 Audit 證據保留。
    4. Server Action 相關改動除咗 Build，必須實際載入引用該 Action 嘅 route。
    '''
).lstrip()
write(learning_path, learning)

print("Creative Job runtime crash, delete discoverability, contracts and learning record patched.")
