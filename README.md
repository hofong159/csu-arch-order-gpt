# 正修建築｜空間預約與設備借用管理平台（免費方案版）

網站：https://hofong159.github.io/csu-arch-order-gpt/

此版本不使用 Cloud Functions、Secret Manager 或 Cloud Storage，不需要綁信用卡。它只使用 Firebase Authentication（管理員 Email／密碼）與 Cloud Firestore。學生免登入，提交申請時會取得 32 碼隨機查詢碼，查詢、簽到及簽退時使用「手機號碼＋查詢碼」。

## 功能

- 空間預約、設備借還登記、正修微工坊、出圖室、我的申請／簽到簽退。
- 管理員可編輯公告、規範、空間及設備、可用狀態、課表、申請審核；管理員可新增和撤銷其他管理員權限。
- 以 Firestore transaction 寫入時段鎖；同一項目每半小時最多兩組，並檢查已匯入課表。
- 簽退最多上傳 5 張壓縮照片。因為免費方案不使用 Firebase Storage，照片會存成 Firestore 文件；超過 7 天的照片會在管理員開啟後台時檢查並刪除。這不是伺服器背景排程：若管理員七天內都沒有開啟後台，刪除會延後到下次開啟。
- 原始輸出碼沒有包含 Apps Script 後端或動態產生的空間清單；請管理員依原網站實際資料建立項目，不要把範例資料當成原站清單。

## 一次性設定（不需計費）

1. 在 Firebase Authentication 登入方式（https://console.firebase.google.com/project/csu-order-system-af6bb/authentication/providers）啟用 **電子郵件／密碼（Email/Password）**。不用開啟 Anonymous。學生不需要登入。
2. 在 Authentication → Users 中，建立或確認初始管理員帳號 `hofong159@gmail.com`。這個 Email 已寫在 Firestore Rules 中作為初始管理員；請使用該帳號的 Firebase 密碼登入。這個版本不強制驗證信箱。
3. 確認 Firebase 專案已建立 Cloud Firestore Database。
4. 從最新版 Repository ZIP 解壓縮後，雙擊 `DEPLOY-FIREBASE-WINDOWS.bat`。腳本只會部署 Firestore Rules，不會啟用計費或部署 Functions。
5. 網站登入後，初始管理員可在「管理員帳號」新增其他 Email／密碼。新增帳號會建立 Firebase Authentication 使用者，並在 Firestore 登記管理員權限。

## 部署網站

GitHub Pages 的來源設定為 GitHub Actions。修改 `index.html`、`styles.css` 或 `app.js` 推送到 `main` 後，網站會自動重新部署。

## 免費方案的限制與安全說明

- Firestore 有免費用量上限；官方文件列出每個專案免費資料量 1 GiB、每日 50,000 次讀取、20,000 次寫入與 20,000 次刪除。超過額度時，Spark 方案可能會限制服務，而不是自動改成付費。請以 Firebase Console 的實際配額為準。
- 沒有後端函式時，公開預約由瀏覽器直接寫入 Firestore。查詢碼是高熵隨機代碼，請勿分享；任何取得查詢碼的人都可能讀取該筆申請。
- 公開預約可以被濫用或被同時送件；規則和 transaction 能降低重複預約，但不等同於具備伺服器防濫用的正式預約系統。
- 照片存 Firestore 會計入資料庫免費容量。逾期照片採用「管理員開啟後台時清理」，無法在完全不使用任何排程後端的情況下保證剛好第 7 天自動刪除。
- 如要正式給全系使用，請先用測試資料驗證送件、核准、拒絕並釋放時段鎖、課表衝突、簽到、簽退、照片與管理員授權。
