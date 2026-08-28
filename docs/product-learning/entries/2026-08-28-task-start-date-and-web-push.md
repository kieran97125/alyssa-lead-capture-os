# Task Start Day、Due Day 與 Web Push

## Problem

Weekly Tasks 原本只得 `due_date`，同一個日期同時被用作「幾時開始做」、「工作出現喺邊一週」、「幾時截止」同「幾時出街」。結果係派 Job、工作週列表、營銷日曆及發布時間共用錯誤口徑，亦令同事只可以喺 Growth OS 頁面內見到通知，關閉分頁後收唔到提醒。

## Product direction

正式將工作排程拆成兩個獨立概念：

- **Start Day／派 Job 日**：工作應該由幾時開始，以及顯示喺邊一週工作列表。
- **Due Day／截止・出街日**：交付期限、營銷日曆日期、內容出街／發布排期及到期提醒。

桌面通知使用標準 Web Push，作為現有系統內通知嘅送達層，而唔另建第二套工作事件來源。

## Scheduling ownership

- `/tasks` 只按 `start_date` 篩選及排序；Due Day 跨週唔會令工作走去另一週。
- 新工作必須有 Start Day；Start Time 可選，未填時以 09:00 HKT 作開始提醒時間。
- Due Day 可選，但設定後不得早過 Start Day；未填 Due Time 時以 12:00 HKT 作日曆及到期時間。
- Task 加入 Calendar 時，Calendar `scheduled_date / scheduled_time` 永遠由 Due Day／Due Time產生。
- Calendar 同步建立 Task 時，Calendar 日期仍然係 Due Day；使用者可以另設較早嘅 Task Start Day。
- 已連結而未 Published 嘅 Calendar item，Task Due Day 改動會同步更新 Calendar。
- 已 Published 嘅 Calendar item 保持 immutable；不允許透過 Task 改寫歷史出街日期。
- 改 Task Start Day 只移動工作所屬週，唔會改 Calendar 或成效事件日期。

## Notification architecture

- `marketing_notifications` 繼續係唯一通知事件來源。
- 新通知由 database trigger fan-out 至每個有效 `marketing_web_push_subscriptions`。
- Web Push 裝置訂閱只屬於已登入嘅個人 workspace member；共用管理員密碼 session 不會綁定私人裝置。
- 瀏覽器必須由使用者主動按「開啟桌面通知」後先要求 permission，避免未經互動彈權限視窗。
- Service Worker 負責背景接收、顯示 OS notification，以及點擊後導航至指定 Task／Calendar。
- Push dispatcher 使用 VAPID、`aes128gcm`、TTL、urgency、404／410 subscription retirement 同 transient retry backoff。
- VAPID private key、dispatch token 及 endpoint config 只存於 server-side private settings table，唔進入前端 bundle 或 Git migration。

## Reliability boundaries

- Push delivery 先由 `claim_marketing_web_push_deliveries()` 原子領取，使用 `FOR UPDATE SKIP LOCKED`，避免 trigger-driven 同 cron-driven dispatcher 重複發送。
- `sending` 超過 10 分鐘會被視為 stale claim 並安全重領，避免 Edge Function 中斷後永久卡住。
- 新通知會即時 request dispatch；每分鐘 cron 再做 reconciliation。
- Start Day、24 小時內 Due Day及逾期提醒由 15 分鐘 cron 建立，`dedupe_key` 確保同一工作／日期唔會重複產生相同提醒。
- Browser roles 對 Push subscriptions、deliveries、settings 仍無直接 table access；所有讀寫經 authenticated server API 或 service role。
- `pg_net` extension ownership 放喺 `extensions` schema，HTTP request API 繼續使用專用 `net` schema。

## Verification contract

- Weekly list query 必須使用 `start_date`，不得退回 `due_date` 作工作週口徑。
- Task create、Task row edit 同 Calendar create 必須同時清楚顯示 Start Day 同 Due Day。
- Due Day 早過 Start Day 必須由 UI、Server Action及 database constraint 三層拒絕。
- Linked Calendar 同步、Published immutability、assignment/status/comment/delete 原有流程必須保留。
- `/api/notifications/push` 必須只接受已驗證個人帳戶，並驗證 Push Subscription payload。
- Service Worker 必須處理 `push` 同 `notificationclick`。
- Build contract 必須驗證原子 claim、retry、stale recovery、私密設定隔離及 pg_net ownership。
- 完整 Playwright、Production build、Supabase advisor、Edge Function HTTP dispatch及正式頁面 smoke test 全部通過，先視為完成上線。
