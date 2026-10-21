# 管理員帳號登入設定

管理員介面使用「帳號＋密碼」，不是電子郵件。驗證由 Firebase Cloud Function 執行，公開網頁不保存管理員密碼。

## 部署步驟

在本機 clone 或下載此 Repository，安裝 Firebase CLI 並登入：

    npm install -g firebase-tools
    firebase login
    firebase use csu-order-system-af6bb

在專案根目錄執行下列兩個指令。Firebase CLI 會互動式要求你輸入原本設定的管理員帳號與密碼；請直接在提示中輸入，不要把實際值寫在任何程式或公開文件中。

    firebase functions:secrets:set ADMIN_USERNAME
    firebase functions:secrets:set ADMIN_PASSWORD

部署登入 API 與資料存取規則：

    firebase deploy --only functions,firestore:rules,storage

確認部署成功後，開啟 https://hofong159.github.io/csu-arch-order-gpt/ ，點「管理員後台」，使用該帳號與密碼登入。

注意：GitHub Pages 部署成功不代表 Firebase Functions 已部署。若尚未部署 adminLogin 函式，登入介面會顯示後端尚未完成設定。部署排程函式可能需要在 Firebase 專案啟用計費方案。
