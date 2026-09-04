# Lead Sheet v3：最後更新日期／Book Event Date Cutover

## 目的

- Lead：繼續按 `Created At`。
- Book：新 Lead 按最左欄 `最後更新日期`，由首次進入已預約／已到店／No Show 時鎖定。
- Show：繼續按 `確認到店日期`。
- No Show：繼續按 `預約日期`。
- 舊 Lead：最左欄保持空白，系統自動 fallback 至原本 `Created At`，不重寫歷史。

## 安全次序

1. 先上線 Growth OS v3 dual-reader（同時支援 legacy A:V 及 v3 A:W）。
2. 將已核對 Apps Script 完整取代現有版本。
3. 執行一次 Sheet v3 安裝／檢查功能：只在 A1 原為 `Created At` 時插入新 A 欄。
4. 確認新 Header：A=`最後更新日期`、B=`Created At`、I=`療程 / 優惠`、J=`療程項目`、W=`Show up`。
5. 確認所有舊資料 A2:A 保持空白，沒有 backfill。
6. 新建測試 Lead：A/B 應同為建立時間。
7. 隔日將該 Lead 首次改成 `已預約`：只更新 A；B 不變。
8. 再改 CS Remark／已到店：A 不可再刷新；Show 仍按確認到店日期。
9. 在 Growth OS 按「同步最新數據」，核對 Lead 日不再增加 Book，預約日增加 Book。
10. 核對全期 Lead／Book／Show 總數與切換前一致，再結束 cutover。

## Apps Script 必守

- Header Array 共 23 欄，`最後更新日期` 後必須有逗號。
- `doPost`、手動 WhatsApp Lead 都要寫 23 個值；新 Lead A/B 初始相同。
- `OFFER_CONFIG.SOURCE_COL=9`、`OUTPUT_COL=10`。
- H→I 文案及提示改成 I→J。
- `onEdit` 要先處理 Book event，再處理療程 I→J；不可因療程欄早退而漏更新。
- 只有第一筆 row 本身屬 v3（A 初始有值）先可鎖 Book 日期；A 原本空白嘅舊 Lead永遠不可自動補。
- 只在由非 Book 狀態首次轉入 Book 狀態時更新 A；之後改到店、No Show、備註或分店都不可再覆蓋。
- 插欄及 Header migration 必須用 Script Lock，避免同時兩筆 Lead 重複插欄。
- 插欄後 A 欄設 HKT date-time format；不要改舊 Lead 內容。

## Rollback

Growth OS 可先回退程式而不改 Sheet；v3 Reader 對 legacy／v3 都兼容。若 Sheet 已插欄，不應直接刪 A 欄，先停止寫入並匯出備份，再按事件日期紀錄決定 rollback。
