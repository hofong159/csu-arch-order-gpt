# 正修建築｜空間預約與設備借用管理平台

Repository: https://github.com/hofong159/csu-arch-order-gpt

本專案以你提供的 Google Apps Script 輸出頁面為參考，使用 Firebase 與 GitHub Pages 重建前端。原始附件是瀏覽器端輸出 HTML，不包含 Apps Script 後端程式或動態產生的實際空間清單；因此不會把未提供的空間名稱、機器名單或資料假裝成已匯入，需由管理員依原站實際內容建立項目。

## 目前功能
- 空間預約、雙向借用、正修微工坊、出圖室、我的申請與簽到／簽退分頁。
- 管理員登入、公告、使用規範、設備／空間清單與可用狀態、課表、申請審核、照片刪除。
- 起始時間以 30 分鐘為一格，借用時間以 3 小時為倍數，每項目每半小時最多兩組。
- Firestore 交易建立時段鎖並檢查已匯入課表，降低重複送件。
- 簽退上傳 1–5 張照片，單張上限 8 MB；附每日清除逾期照片的 Cloud Functions 排程程式。

## A. 啟用 GitHub Pages
1. 開啟 Repository 的 Settings → Pages。
2. 在 Build and deployment → Source 選 GitHub Actions。
3. 到 Actions 查看 Deploy static site to GitHub Pages 工作流程，確認最新一輪成功。
4. 部署成功後網址通常是 https://hofong159.github.io/csu-arch-order-gpt/ 。未成功部署前，不能視為網站已上線。

目前網站直接使用根目錄的 `app.js`；修改後推送至 `main` 即會自動部署。舊的壓縮檔為早期原型，正式部署不再使用。

## B. Firebase 設定（學生免登入、管理員 Email/Password）
前端 Firebase 設定已指向 `csu-order-system-af6bb`。`apiKey` 是 Firebase Web SDK 的前端識別設定，不是 Admin SDK 私鑰；仍建議在 Google Cloud Console 限制 API key 的 HTTP referrer，至少允許 `https://hofong159.github.io/*`，並只啟用必要 API。

1. 在 [Firebase Console 的 Authentication 登入方式](https://console.firebase.google.com/project/csu-order-system-af6bb/authentication/providers) 啟用 **電子郵件／密碼（Email/Password）**。不需要啟用 Anonymous，學生完全免登入。
2. 在 Authentication → Users 新增你自己的初始管理員 Email 與密碼。使用你本人能收信的 Email，因為系統會要求驗證信箱。
3. 在專案根目錄執行 `DEPLOY-FIREBASE-WINDOWS.bat`；當腳本詢問 `INITIAL_ADMIN_EMAIL` 時，輸入剛才建立的同一個 Email。腳本會部署 `bootstrapAdmin`、`createAdminUser`、`publicBookingApi` 等 Cloud Functions，以及 Firestore／Storage Rules。
4. 初始管理員第一次登入會自動寄出驗證信。先點信件中的驗證連結，再回到網站登入一次；後端會將此 Email 設為初始管理員。
5. 初始管理員登入後，可在管理員後台的「管理員帳號」新增其他 Email／密碼。新管理員第一次登入時也會收到驗證信；完成驗證後才可使用管理功能。
6. 在 Authentication → Settings → Authorized domains 確認包含 `hofong159.github.io`。

注意：GitHub Pages 部署成功不代表 Firebase Cloud Functions 已部署。請等 Firebase 部署成功後，再測試管理員登入、建立管理員、預約及資料管理。管理員權限由伺服器端 Firebase Admin SDK 設定，前端不能自行提升權限。

## C. 部署照片七天自動清理
簽退時會記錄 photoDeleteAfter，但 GitHub Pages 本身不會定時刪檔。functions 內附 Firebase Cloud Function，每天台灣時間 03:20 刪除已超過保留期限的 Storage 照片並清空紀錄中的照片連結。

需要 Node.js 22 與 Firebase CLI。請依照 [管理員登入設定](ADMIN-LOGIN-SETUP.md) 啟用 Email/Password、建立初始管理員使用者，並設定 `INITIAL_ADMIN_EMAIL` Secret，再部署 Functions、Firestore Rules 與 Storage Rules。學生照片使用短效簽名網址上傳；請依 `storage-cors.json` 設定 Storage bucket 的 CORS：

    gcloud storage buckets update gs://csu-order-system-af6bb.firebasestorage.app --cors-file=storage-cors.json

排程及第二代 Cloud Functions 可能需要 Firebase 專案啟用 Blaze 計費方案。請先確認帳務、配額與部署結果，再用測試照片驗證。勿將服務帳戶金鑰或其他伺服器秘密放進 Repository。

## D. 正式使用前必測
- 原始匯出碼沒有動態空間清單與 Apps Script 後端，項目和正式課表需要管理員補齊。
- 學生端免登入，使用申請時取得的隨機查詢碼加上手機號碼保護紀錄。查詢碼只顯示一次，遺失後無法由公開畫面取回。
- 管理員使用 Firebase Email/Password 登入，並必須先驗證 Email；初始管理員透過 `INITIAL_ADMIN_EMAIL` 一次性設定，登入後可在管理員後台建立其他管理員。
- 預約、課表檢查及時段鎖由 Cloud Functions 使用 Admin SDK 執行；正式使用前需測試跨日、同時送件、課表匯入與拒絕申請後釋放鎖定。
- 上線前實測：送件、核准、簽到、簽退、照片上傳、七天清理、關閉空間、課表衝突與資料權限。

## 如果你使用 Windows（最簡單的部署方式）

1. 下載 Repository 的 ZIP 並解壓縮。
2. 安裝 [Node.js 22 LTS](https://nodejs.org/)（如果尚未安裝）。
3. 在 Firebase Authentication → Users 新增你自己的 Email 與密碼；再到專案根目錄雙擊 `DEPLOY-FIREBASE-WINDOWS.bat`。
4. 瀏覽器登入 Firebase 後，依命令提示輸入 `INITIAL_ADMIN_EMAIL`，必須和剛新增的 Email 完全相同。Email/Password 登入方式必須先啟用。
5. 等待部署結果。成功後，確認終端機有列出 `bootstrapAdmin`、`createAdminUser` 和 `publicBookingApi` 的 Function URL。初次登入時會寄出 Email 驗證信。

若腳本最後顯示 `[FAILED]`，把紅色錯誤訊息截圖傳回來即可；請遮住密碼及任何秘密值。

