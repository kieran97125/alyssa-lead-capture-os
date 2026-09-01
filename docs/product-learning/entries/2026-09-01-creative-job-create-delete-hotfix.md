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
- 加入會實際載入新增 Job Dialog 同 Server Action module 嘅 runtime acceptance；Production 上線後再以真實 `/creative-jobs` route 做 smoke check。

## 可重用規則

1. `use server` 檔案不得 export object、array、class 或其他 runtime value；共享 initial state 應放 Client／neutral module。
2. 刪除操作要喺使用者管理資料嘅主要列表或頁首清晰可見，不應只藏喺長頁底部。
3. 可回溯資料以 soft delete 處理，日常介面移除但 Audit 證據保留。
4. Server Action 相關改動除咗 Build，CI 必須實際載入引用該 Action 嘅 Client module；Production 亦要做真實 route smoke check。
