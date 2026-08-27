# Connected Marketing Operations

## Problem

Marketing Calendar、每週工作、同事指派、通知及成效時間線原本係分散流程，日曆發佈後亦缺乏一個可追溯、可供 Dashboard 共用嘅營運事件層。

## Product direction

將 Calendar、Weekly Tasks、Notifications 同 Performance Timeline 組成同一套 Marketing Operations workflow，而唔另建一套品牌權限或重複資料模型。

## Architecture decisions

- Calendar 對外工作狀態收斂為 `Idea / Scheduled / Published`。
- Scheduled 項目按香港時間自動轉 Published；未填時間時使用 12:00 HKT。
- Weekly Tasks 重用現有 Calendar module permission 及 Brand Access，避免出現第二套權限口徑。
- Calendar 可以同步建立 Task；Task 可以加入 Calendar；連結後更新排期會同步 due date / due time。
- Calendar Published 可完成相連執行工作，但一般 Task 完成不會反向發佈 Calendar，避免誤操作。
- `marketing_operational_events` 作為中央事件層，統一供 Dashboard 及 Treatment Performance 顯示成效標記。
- 資料寫入繼續由 server-side service role 執行；瀏覽器角色不直接寫入營運資料表。

## Reliability boundaries

- 指派人選必須具備相同品牌 Access。
- Published timestamp、auto-published timestamp、來源 entity 及 metadata 均保留作 audit evidence。
- Calendar／Task event 由 database trigger 同步，避免 UI 成功但時間線漏記。
- 自動發佈由 `pg_cron` 每分鐘 reconcile，亦提供可手動呼叫嘅 idempotent function。

## Verification contract

- Calendar 只顯示三個核准狀態。
- Weekly Tasks 顯示 To-do / In progress / Done、指派、留言、通知及 Calendar linking。
- `/tasks` 必須沿用 Calendar module permission。
- Dashboard 及 Treatment Performance 必須讀取同一個 connected operational event layer。
- 舊導航數目及舊「日曆操作」測試字眼已更新為新產品結構，避免 regression suite 將正確改動誤判為失敗。
