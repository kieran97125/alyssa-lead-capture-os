# Omnichat 接駁 Marketing OS — 洽談重點

建議接駁。目標係同事唔使抄電話／渠道／優惠入 Lead 表，確認預約時只補療程、分店、日期時間等必要資料。Marketing OS 建立穩定 Lead／預約身份，Google Sheet 作可追溯營運投影。

官方資料已確認 Open API／Webhook 同 Contact 自訂屬性更新接駁能力；目前帳戶實際可用事件、費用、簽署規格同廣告歸因欄位仍需供應商確認。不可將其他同名 Omnichat 服務的文件套用。

## 可直接向客戶經理提出的要求

希望將 Omnichat 接駁我哋自家 Marketing OS，減少客服重複入 Lead 資料。請提供：

1. 現有方案可開放或需加購嘅 Open API／Webhook，費用、API 額度、延遲及支援渠道。
2. 新聯絡人、首次對話、聯絡人資料／自訂屬性／標籤變更、客服指派、對話狀態等事件的完整清單。以上為需求清單，未全部確認供應商支援。
3. 匿名樣本 payload、事件 ID、聯絡人 ID、對話 ID、渠道／品牌識別、事件時間、版本及刪除／合併聯絡人的處理。
4. CTWA／FB／IG 廣告來源能否帶出 campaign、ad set、ad、referral、點擊來源等欄位；請標明不可取得或需另外查詢的欄位。
5. Webhook 驗證方式：簽署算法、header、timestamp、原始 body、重播防護、secret 輪換與來源驗證。由官方規格決定，唔預設係某種 HMAC。
6. timeout、重試間隔／次數、2xx 確認條件、事件亂序、補發／歷史匯出及重放機制。
7. 能否由 Marketing OS 更新指定聯絡人欄位或標籤，以及測試環境、權限範圍、IP 白名單要求。先做單向收集，寫回需獨立驗收。
8. 可否提供只讀測試帳戶或測試事件，完成真實首次查詢、再次聯絡、預約、改期及取消的驗收。

## 建議同事流程

- Omnichat 收到符合定義嘅首次查詢 → Marketing OS 登記或對返現有 Lead，保留渠道／優惠／廣告來源。
- 同事核實客人要求，在同一個工作流程選療程、分店、預約日期時間、跟進狀態；穩定身份由系統處理。
- 每個預約有獨立身份；重複事件、重試或改期唔會靠電話號碼重新建立另一筆相同預約。
- 已接納嘅到店／取消結果及同事備註唔會被較舊事件覆寫。Google Sheet 寫入失敗會保留待重試工作及狀態。
- 轉換報表口徑前，並行比較新流程同現有 Book／Show／來源規則，核對無誤先切換。

## 技術驗收要求

先驗證來源，再原子儲存事件與去重收據，成功保存後才回覆接納。依租戶／接駁帳戶／事件 ID 去重；外部 contact ID、電話正規化及歷史合併分開處理。亂序、重播、重試與未知寫入結果都有審計及安全恢復。敏感 payload 按客戶隔離及受控保存，不放入共用日誌。Lead 可見時間及 Sheet 追上時間分別量度，以實測決定 SLA。

此文件係洽談與驗收要求；未代用戶向 Omnichat 發訊息、購買方案或聲稱已完成接駁。

## 官方來源

- https://docs.omnichat.ai/features/kai-fa-zhe-zhong-xin
- https://docs.omnichat.ai/release-note/apr-24-2024
- https://docs.omnichat.ai/release-note/mar-13-2024
- https://www.omnichat.ai/tw/social-cdp/
