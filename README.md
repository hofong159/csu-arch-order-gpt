# 正修建築｜空間預約與設備借用管理平台（免費方案版）

網站：https://hofong159.github.io/csu-arch-order-gpt/

本版本不使用 Cloud Functions、Secret Manager 或 Cloud Storage，不需要升級 Blaze 或綁信用卡。使用 Firebase Authentication（管理員 Email／密碼）及 Cloud Firestore。學生免登入；送出申請時會取得 32 碼隨機查詢碼，後續以手機號碼＋查詢碼查詢、簽到及簽退。

## 先初始化 Firestore（重要；只需一次）

你先前執行部署腳本時，出現「Creating the new Firestore database (default)」及 HTTP 403。這是因為專案尚未建立 Firestore 資料庫，CLI 嘗試透過建立資料庫 API 自動建立而收到 billing 錯誤；不要升級付費。

1. 開啟 [Firebase Console → Firestore](https://console.firebase.google.com/project/csu-order-system-af6bb/firestore)。
2. 在「資料庫和儲存空間」→「Firestore Database」點「建立資料庫／Create database」。
3. 選 **Standard edition**。
4. Database ID 選 **(default)**（不要建立 named database）。
5. 地區建議選 `asia-east1`（台灣；建立後地區不能更改）。
6. 起始安全規則選 **Production mode／正式模式**，再按建立。不要選 Test mode。
7. 官方說明 Firestore 每個 Firebase 專案有一個免費資料庫配額；若你在主控台這一步仍被要求開啟計費，請先停止，不要升級，截圖錯誤給我再改走既有 Realtime Database。參考：[Firestore 免費配額與計費](https://firebase.google.com/docs/firestore/pricing)、[在 Firebase Console 建立資料庫](https://firebase.google.com/docs/firestore/manage-databases)。

## 部署安全規則（資料庫建立後）

資料庫建立完成後，從此 Repository 下載最新版 ZIP、解壓縮，再雙擊 `DEPLOY-FIREBASE-WINDOWS.bat`。這一步只部署 Firestore Rules，不會部署 Functions、Storage，也不會啟用計費。如果看到 `Creating the new Firestore database`，代表資料庫仍沒建好，先回 Console 檢查 Database ID 是否為 `(default)`。

## 管理員設定

1. 在 [Authentication 登入方式](https://console.firebase.google.com/project/csu-order-system-af6bb/authentication/providers) 啟用 Email/Password；不用啟用 Anonymous。
2. 在 Authentication → Users 建立／確認初始管理員 `hofong159@gmail.com`。
3. 回網站用該 Email 及 Firebase 使用者密碼登入。這個免費版不強制 Email 驗證。
4. 初始管理員登入後，到「管理員帳號」新增其他管理員 Email／密碼。

## 功能和免費方案限制

- 空間預約、設備借還、微工坊、出圖室、我的申請、簽到簽退。
- 管理員管理公告、開放狀態、空間／設備、課表、申請審核及管理員權限。
- 以 Firestore transaction 寫時段鎖，檢查課表；同一項目每半小時最多兩組。
- 簽退最多五張壓縮照片，存在 Firestore；超過七天的照片會在管理員下次開啟後台時清理。沒有付費背景排程時，不能保證整整第七天自動刪除。
- 原始 HTML 輸出碼沒有動態空間清單或 Apps Script 後端；請在管理員後台按原站真實資料建立清單。
- Firestore Spark 免費額度有限。若管理員登入／新增資料出現 `permission-denied`，檢查 Firestore Rules 是否已部署成功。
- 學生公開查詢依靠 32 碼隨機查詢碼；請妥善保存，不要分享。
