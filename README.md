# 正修建築｜空間預約與設備借用管理平台（免費版）

網站：https://hofong159.github.io/csu-arch-order-gpt/

本版只用 Firebase Authentication（管理員 Email／密碼）和 Cloud Firestore；學生免登入，不使用 Cloud Functions、Secret Manager 或 Cloud Storage，不需要升級 Blaze 或綁信用卡。

## 先做一次：發布 Firestore 規則

Firebase Console 已確認你的資料庫存在，ID 為 `(default)`、位置為 `nam5`。不要重建資料庫，也不要升級計費。

1. 開啟 [Firestore Rules 編輯器](https://console.firebase.google.com/project/csu-order-system-af6bb/firestore/databases/-default-/rules)。
2. 在新分頁開啟 [此專案的 firestore.rules](https://raw.githubusercontent.com/hofong159/csu-arch-order-gpt/main/firestore.rules)，按 Ctrl+A、Ctrl+C。
3. 回 Rules 編輯器按 Ctrl+A、Ctrl+V，貼上全部內容，再按 **Publish／發布**。請不要保留舊的開放測試規則。

## 登入與設定

1. 在 [Firebase Authentication 登入方式](https://console.firebase.google.com/project/csu-order-system-af6bb/authentication/providers) 啟用 **電子郵件／密碼（Email/Password）**；不用啟用 Anonymous。
2. 確認 Authentication → Users 中有初始管理員 `hofong159@gmail.com`，並使用該 Firebase 帳號的密碼登入網站。
3. 進入管理員後台 →「公告／開放設定」，修改後按「儲存設定」。成功或失敗會顯示在按鈕下方；`permission-denied` 通常代表 Rules 未發布或登入帳號不是初始管理員。

## 一鍵寫入你提供的空間與課表

1. 以初始管理員登入網站。
2. 在管理員後台按「初始資料匯入」，或在「公告／開放設定」按「一鍵預載空間／課表」。
3. 按「一鍵匯入空間、課表與借用紀錄」，等待畫面顯示「匯入完成」。這一步才會真正把資料寫入你的 Firebase；我無法從此對話直接使用你登入中的 Firebase Session。

匯入項目：A–H 區和總評一區、總評二區共 10 個區域；你貼出的 2026-10-24 正課 17 筆；A 區小組借用（2026-10-23 23:30 至 2026-10-24 11:30）；H 區單人借用（2026-10-22 17:00 至 2026-10-27 17:00）。匯入採合併方式，不刪除其他設定；可重複執行，避免同一批紀錄重複新增。

注意：原網站輸出碼只包含前端呼叫 Apps Script `getBoard()` 的程式，沒有伺服器回傳的完整機具／空間清單。因此一鍵匯入只包含你明確提供的區域與課表，不會假造未提供的機器名稱。兩筆舊借用的電話和查詢碼原資料沒有提供，會標示「原站未提供」；它們是用來反映現有時段占用，不可用新系統的手機＋查詢碼查詢或簽退。

## 免費版功能與限制

- 管理空間預約、設備借還、微工坊、出圖室、我的申請／簽到簽退、課表、申請審核和管理員帳號。
- 預約寫入 Firestore 時段鎖並檢查已匯入的課表；同一區每半小時最多兩組。
- 簽退照片以壓縮 JPEG 存在 Firestore；逾七天照片於管理員下次開啟後台時清理，不是準時第七天的背景排程。
- 學生用 32 碼隨機查詢碼和手機號碼查詢紀錄。請保存查詢碼，不要分享。
- Firestore 免費額度有限。正式給多人使用前，請先測試送件、核准／拒絕、釋放時段、跨日紀錄、簽到簽退和照片。

## Windows 部署腳本

`DEPLOY-FIREBASE-WINDOWS.bat` 是唯讀檢查工具，會列出目前 Firebase CLI 帳號與資料庫，並開啟 Rules 編輯器及規則原文；它不會建立資料庫、不會部署 Cloud Functions，也不會要求計費。
