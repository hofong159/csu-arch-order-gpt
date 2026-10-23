# 免費方案設定：Firebase Email／密碼管理員

學生完全免登入。此版本只使用 Firebase Authentication 與 Cloud Firestore，不使用 Cloud Functions、Secret Manager 或 Cloud Storage，也不需要升級 Blaze。

## 第一次設定

1. 開啟 Firebase Authentication → 登入方式：https://console.firebase.google.com/project/csu-order-system-af6bb/authentication/providers
2. 啟用「電子郵件／密碼（Email/Password）」。不要啟用 Anonymous。
3. 在 Authentication → Users 確認初始管理員 `hofong159@gmail.com` 已建立。Firestore Rules 將此 Email 設為初始管理員。
4. 確認 Cloud Firestore Database 已建立。
5. 下載最新 Repository ZIP 並解壓縮；在根目錄雙擊 `DEPLOY-FIREBASE-WINDOWS.bat`。此腳本只部署 Firestore Rules，不會要求信用卡，不會部署 Cloud Functions。
6. 打開 https://hofong159.github.io/csu-arch-order-gpt/ ，點管理員後台，用初始管理員 Email 和 Firebase 密碼登入。

## 新增其他管理員

初始管理員登入後，選「管理員帳號」，填入新管理員 Email、初始密碼和再次確認密碼，再按新增。此版本不要求驗證信箱；新管理員可直接使用 Email／密碼登入。只有已授權的管理員可以新增或移除管理員權限。

## 不需也不要設定的項目

- 不需要升級 Firebase Blaze、不需要信用卡。
- 不需要設定 `ADMIN_USERNAME`、`ADMIN_PASSWORD` 或 `INITIAL_ADMIN_EMAIL` Secret。
- 不需要部署 Cloud Functions、Cloud Storage Rules 或 Storage CORS。
- 不需要啟用匿名登入。

## 照片和免費方案的限制

簽退時最多上傳 5 張壓縮照片。照片以 Firestore 子文件儲存，以避開 Firebase Cloud Storage 的 Blaze 要求。照片最多 700 KB／張；超過 7 天的照片會在管理員開啟後台時清除。沒有後端排程服務的免費版本，不能保證無論管理員是否上線都會在第 7 天準時刪除。

## 注意

公開預約使用 32 碼隨機查詢碼作為存取憑證。請妥善保存，不要分享；取得查詢碼的人可能查看該筆申請。Firestore 規則已限制公開查詢只能透過指定代碼讀取，不能列出所有申請。
