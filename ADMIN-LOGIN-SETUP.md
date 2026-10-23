# 管理員 Email／密碼登入設定

學生端完全免登入。管理員使用 Email 與密碼登入；管理員 Email 必須完成驗證才能操作後台。只有已驗證且有 `admin` 權限的管理員，才可在後台建立其他管理員。

## 一、設定 Email/Password 登入方式

1. 開啟 [Firebase Authentication](https://console.firebase.google.com/project/csu-order-system-af6bb/authentication/providers)。
2. 在「登入方式」點選「電子郵件／密碼」，啟用後儲存。不要啟用匿名登入，學生不用登入。
3. 到「使用者」頁籤，點「新增使用者」，先建立你自己的初始管理員 Email 與密碼。請使用你本人能收信的 Email。
4. 下載最新專案並解壓縮；在根目錄雙擊 `DEPLOY-FIREBASE-WINDOWS.bat`。
5. 腳本會要求輸入 `INITIAL_ADMIN_EMAIL`。此值必須與剛才在 Authentication 建立的初始管理員 Email 完全相同。
6. 腳本會部署 Firebase Functions、Firestore Rules 與 Storage Rules。若 Firebase 要求計費方案，請先完成專案帳務設定。

## 二、初始管理員第一次登入

1. 開啟 https://hofong159.github.io/csu-arch-order-gpt/ ，點「管理員後台」，使用上述 Email 與密碼登入。
2. 如果信箱尚未驗證，網站會寄出 Firebase 驗證信並登出。打開信件，點驗證連結。
3. 回到網站再登入一次。後端會檢查 Email 是否與 `INITIAL_ADMIN_EMAIL` 相同，然後授予初始管理員權限。

## 三、在後台新增其他管理員

1. 初始管理員登入後，打開「管理員帳號」。
2. 輸入新管理員的 Email、初始密碼（至少 12 個字元），再確認一次密碼。
3. 將帳號資訊安全地交給新管理員。新管理員第一次登入時，網站會自動寄出驗證信並拒絕未驗證的登入；完成驗證後再登入，即可使用後台。
4. 管理員權限透過 Firebase Admin SDK 在後端授予，不會由前端自行設定。

## 四、部署後仍需確認

- 在 Authentication → Settings → Authorized domains 確認包含 `hofong159.github.io`。
- 如果第一次部署後還看得到舊的 `adminLogin` 函式，這是舊版遺留函式；新版網站不再使用它。
- 登入 API 應有 `bootstrapAdmin` 與 `createAdminUser`；學生預約 API 為 `publicBookingApi`。
- 任何管理員被授權後都具有管理權限，請只新增可信任的人員。管理員移除／停權功能目前未加入本版。
- 不要把密碼寫進 GitHub、程式碼、截圖或聊天內容。
