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

工作流程會將 app.js.gz.b64 解碼還原成瀏覽器執行的 app.js。若要在 Linux、macOS 或 Git Bash 編輯它，可先執行：

    base64 --decode app.js.gz.b64 | gunzip -c > app.js

修改完 app.js 後，重新產生部署包：

    gzip -9 -c app.js | base64 -w0 > app.js.gz.b64

## B. Firebase 設定（學生免登入）
前端 Firebase 設定已指向 `csu-order-system-af6bb`。`apiKey` 是 Firebase Web SDK 的前端識別設定，不是 Admin SDK 私鑰；仍建議在 Google Cloud Console 限制 API key 的 HTTP referrer，至少允許 `https://hofong159.github.io/*`，並只啟用必要 API。

1. 在 [Firebase Console](https://console.firebase.google.com/project/csu-order-system-af6bb) 確認專案可存取。
2. 建立 Firestore Database，並啟用 Storage。
3. 不需要在 Authentication → Sign-in method 啟用 Anonymous，也不需要建立學生帳號。學生直接填表，後端使用申請時發出的查詢碼保護個人申請。
4. 依照 [ADMIN-LOGIN-SETUP.md](ADMIN-LOGIN-SETUP.md) 設定管理員帳號與密碼 Secret，並部署 `adminLogin` 和 `publicBookingApi` Cloud Functions。
5. 部署本專案的 `firestore.rules` 和 `storage.rules`。管理員權限由後端簽發的自訂登入權杖授權，不需要建立 Email/Password 管理員帳號，也不應把管理員密碼放在公開程式碼。
6. 在 Authentication → Settings → Authorized domains 確認包含 `hofong159.github.io`。
7. 管理員登入後，在「管理員後台 → 空間／設備項目」依原站實際資料新增各空間、設備與機器，再匯入正式課表。

注意：GitHub Pages 部署成功不代表 Firebase Cloud Functions 已部署。請在完成 Functions 部署及 Rules 發布後，才開始實際測試預約、查詢、簽到簽退與管理功能。

## C. 部署照片七天自動清理
簽退時會記錄 photoDeleteAfter，但 GitHub Pages 本身不會定時刪檔。functions 內附 Firebase Cloud Function，每天台灣時間 03:20 刪除已超過保留期限的 Storage 照片並清空紀錄中的照片連結。

需要 Node.js 22 與 Firebase CLI。下載或 clone 此 Repository 後，在專案根目錄執行：

    npm install -g firebase-tools
    firebase login
    cd functions && npm install && cd ..
    firebase deploy --only functions

排程通常需要 Firebase 專案啟用 Blaze 計費方案。請先確認帳務、配額與部署結果，再用測試照片驗證。勿將服務帳戶金鑰或其他伺服器秘密放進 Repository。

## D. 正式使用前必測
- 原始匯出碼沒有動態空間清單與 Apps Script 後端，項目和正式課表需要管理員補齊。
- 「我的申請」以目前瀏覽器的匿名 Firebase UID 辨識；換瀏覽器／裝置或清除網站資料後可能找不回舊紀錄。正式使用建議改用學校帳號登入。
- 送件會先讀取課表，再以 Firestore 交易鎖定時段；正式使用前需測試跨日、同時送件、課表匯入、拒絕申請後釋放鎖定與使用者私有資料權限。
- 上線前實測：送件、核准、簽到、簽退、照片上傳、七天清理、關閉空間、課表衝突與資料權限。
