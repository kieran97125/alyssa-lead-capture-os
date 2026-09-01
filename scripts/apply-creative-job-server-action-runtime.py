from pathlib import Path
import re
from textwrap import dedent


def read(path: str) -> str:
    return Path(path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"Missing patch marker: {label}")
    return text.replace(old, new, 1)


write(
    "src/lib/creative/createState.ts",
    dedent(
        '''\
        export type CreativeJobCreateState = {
          status: "idle" | "error";
          message: string;
        };

        export const initialCreativeJobCreateState: CreativeJobCreateState = {
          status: "idle",
          message: "",
        };
        '''
    ),
)

action_path = "src/app/creative-jobs/createAction.ts"
action = read(action_path)
action = replace_once(
    action,
    dedent(
        '''\
        import {
          creativePriorities,
          creativeWorkloads,
        } from "@/lib/creative/types";

        export type CreativeJobCreateState = {
          status: "idle" | "error";
          message: string;
        };

        export const initialCreativeJobCreateState: CreativeJobCreateState = {
          status: "idle",
          message: "",
        };
        '''
    ),
    dedent(
        '''\
        import {
          creativePriorities,
          creativeWorkloads,
        } from "@/lib/creative/types";
        import type { CreativeJobCreateState } from "@/lib/creative/createState";
        '''
    ),
    "server action exported initial state",
)
if re.search(r"^export\s+(?:const|let|var|class)\s+", action, re.MULTILINE):
    raise SystemExit("createAction.ts still exports a non-function runtime value")
write(action_path, action)

dialog_path = "src/components/creative/CreativeJobCreateDialog.tsx"
dialog = read(dialog_path)
dialog = replace_once(
    dialog,
    dedent(
        '''\
        import {
          createCreativeJobAction,
          initialCreativeJobCreateState,
        } from "@/app/creative-jobs/createAction";
        '''
    ),
    dedent(
        '''\
        import { createCreativeJobAction } from "@/app/creative-jobs/createAction";
        import { initialCreativeJobCreateState } from "@/lib/creative/createState";
        '''
    ),
    "client initial state import",
)
write(dialog_path, dialog)

test_path = "e2e/creative-production.spec.ts"
tests = read(test_path)
route_test = dedent(
    '''\
    test("Creative Jobs production route evaluates without invalid server exports", async ({
      page,
    }) => {
      const response = await page.goto("/creative-jobs", {
        waitUntil: "domcontentloaded",
      });
      expect(response?.status() ?? 500).toBeLessThan(500);
      await expect(page.getByRole("heading", { name: "設計工作" })).toBeVisible();
      await expect(page.locator("body")).not.toContainText(
        'A "use server" file can only export async functions'
      );
    });

    '''
)
marker = 'test("creative Job List keeps source, usage and media format separate without horizontal scrolling", async ({\n'
if route_test not in tests:
    tests = replace_once(tests, marker, route_test + marker, "production route test")
write(test_path, tests)

contract_path = "scripts/verify-creative-production-contract.mjs"
contract = read(contract_path)
contract = replace_once(
    contract,
    'const actions = read("src/app/creative-jobs/actions.ts");\n',
    'const actions = read("src/app/creative-jobs/actions.ts");\nconst createAction = read("src/app/creative-jobs/createAction.ts");\nconst createState = read("src/lib/creative/createState.ts");\nconst createDialog = read("src/components/creative/CreativeJobCreateDialog.tsx");\n',
    "create action contract sources",
)
contract = replace_once(
    contract,
    'assert.match(actions, /createCreativeDraftAction/);\n',
    dedent(
        '''\
        assert.match(actions, /createCreativeDraftAction/);
        assert.match(createAction, /^"use server";/);
        assert.match(createAction, /export async function createCreativeJobAction/);
        assert.doesNotMatch(
          createAction,
          /^export\s+(?:const|let|var|class)\s+/m
        );
        assert.match(createState, /initialCreativeJobCreateState/);
        assert.match(createDialog, /@\/lib\/creative\/createState/);
        assert.doesNotMatch(
          createDialog,
          /initialCreativeJobCreateState,[\s\S]*?createAction/
        );
        '''
    ),
    "server action runtime contract assertions",
)
write(contract_path, contract)

write(
    "docs/product-learning/entries/2026-09-01-creative-job-server-action-runtime.md",
    dedent(
        '''\
        # Creative Job Server Action runtime boundary

        ## 問題

        `src/app/creative-jobs/createAction.ts` 使用 `"use server"`，但同時 export 了 `initialCreativeJobCreateState` object。Next.js 可以完成靜態 Build，實際載入引用該模組的 Production route 時則可能拒絕 module evaluation。

        ## 修正

        - Server Action 模組只保留 async function runtime export。
        - Form initial state 及 type 移到 neutral `src/lib/creative/createState.ts`。
        - 加入實際 `/creative-jobs` route acceptance，而唔只測 fixture。
        - Build contract 禁止 `use server` Creative create module再 export const／class／其他 runtime value。

        ## 可重用規則

        1. `"use server"` action file 只 export async Server Actions；UI state 放 neutral 或 client-owned module。
        2. Server Action 相關改動要測實際引用 route，因為 Build 成功唔代表 runtime module evaluation 成功。
        3. Contract test 要保護 module boundary，避免日後 refactor 將 runtime object 搬返入 action file。
        '''
    ),
)

print("Creative Job server action runtime boundary repaired and protected.")
