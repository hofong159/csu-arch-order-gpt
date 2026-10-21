# 管理員帳號登入設定

學生端完全免登入，不需要 Firebase Anonymous 或 Email/Password provider。學生送出申請時會取得一次性查詢碼，之後以「手機號碼＋查詢碼」查詢、簽到與簽退。管理員才需要帳號與密碼。

## 1. 設定管理員帳號與密碼

在本機 clone 或下載此 Repository，安裝 Firebase CLI 並登入：

    npm install -g firebase-tools
    firebase login
    firebase use csu-order-system-af6bb

執行以下兩個命令，CLI 會提示輸入原本指定的管理員帳號與密碼。請在提示中輸入實際值，不要將密碼寫入 GitHub 或任何程式檔：

    firebase functions:secrets:set ADMIN_USERNAME
    firebase functions:secrets:set ADMIN_PASSWORD

部署管理員登入、免登入預約 API 與資料權限規則：

    firebase deploy --only functions,firestore:rules,storage

等部署成功後，開啟 https://hofong159.github.io/csu-arch-order-gpt/ ，點「管理員後台」，使用原本的帳號與密碼登入。

## 2. 簽退照片上傳跨網域設定

學生不登入 Firebase，因此簽退照片使用伺服器產生的短效簽名上傳網址。請先安裝並設定 Google Cloud CLI，接著在此 Repository 根目錄執行：

    gcloud storage buckets update gs://csu-order-system-af6bb.firebasestorage.app --cors-file=storage-cors.json

如果 Firebase Console 顯示實際 Storage bucket 名稱不同，請以 Console 中的 bucket 名稱取代指令內的名稱。

## 3. 必要說明

- GitHub Pages 的部署成功不代表 Firebase Functions 已部署；預約與管理員登入 API 必須在 Firebase 部署成功後才會可用。
- Cloud Functions 的 HTTP endpoints 僅允許本網站來源呼叫。若要改自訂網域，需同步調整 functions/index.js 的 ORIGIN。
- 定時刪除照片的 Cloud Function 使用排程，可能需要 Firebase 專案啟用計費方案。
- 管理員密碼只存在 Firebase Secret Manager，不會放進公開前端。
