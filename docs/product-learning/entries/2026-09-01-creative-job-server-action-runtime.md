# Creative Job Server Action runtime boundary

## 問題

`src/app/creative-jobs/createAction.ts` 使用 `"use server"`，但同時 export 了 `initialCreativeJobCreateState` object。Next.js 可以完成靜態 Build，實際載入引用該模組的 Production route 時則可能拒絕 module evaluation。

## 修正

- Server Action 模組只保留 async function runtime export。
- Form initial state及 type 移到 neutral `src/lib/creative/createState.ts`。
- 加入實際 `/creative-jobs` route acceptance，而唔只測 fixture。
- Build contract 禁止 `use server` Creative create module再 export const／class／其他 runtime value。

## 驗證證據

- Production build、TypeScript 同所有 contracts 通過。
- Creative Job route／新增視窗／刪除確認專項測試通過。
- Design Quality gate 通過。
- Full Playwright regression 通過。
- 驗證完成 commit：`55446da77a972032e06355b746e73b813da117d4`。

## 可重用規則

1. `"use server"` action file 只 export async Server Actions；UI state 放 neutral 或 client-owned module。
2. Server Action 相關改動要測實際引用 route，因為 Build 成功唔代表 runtime module evaluation 成功。
3. Contract test 要保護 module boundary，避免日後 refactor 將 runtime object 搬返入 action file。