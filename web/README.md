# 三商美邦人壽智能服務平台（Web 版）

Node.js + Express 後端 + 純前端（HTML/CSS/JS 分離）的完整版本。
取代原本的 Google Form，提供自有資料庫（JSON 檔）與後台管理。

## 專案結構

```
web/
├── server/
│   ├── server.js        # Express 入口
│   ├── recommender.js   # 保單推薦邏輯
│   ├── db.js            # 儲存層 dispatcher（依 DATABASE_URL 切換）
│   ├── db-json.js       # JSON 檔實作（本機開發）
│   ├── db-pg.js         # PostgreSQL 實作（生產環境）
│   ├── line.js          # LINE Bot 整合
│   └── package.json
├── public/
│   ├── index.html       # 客戶問卷頁
│   ├── admin.html       # 後台管理頁
│   ├── css/
│   │   ├── common.css
│   │   ├── questionnaire.css
│   │   └── admin.css
│   └── js/
│       ├── questionnaire.js
│       └── admin.js
└── data/
    └── customers.json   # 自動建立，儲存客戶資料
```

## 安裝與啟動

```bash
cd web/server
npm install
npm start
```

啟動後：
- 問卷頁：http://localhost:3000/
- 後台：http://localhost:3000/admin.html
- 預設帳號：`admin` / `mli2024`

## 環境變數

| 變數 | 預設 | 說明 |
|------|------|------|
| `PORT` | `3000` | 伺服器埠號 |
| `ADMIN_USER` | `admin` | 後台帳號 |
| `ADMIN_PASS` | `mli2024` | 後台密碼 |
| `LINE_CHANNEL_SECRET` | – | LINE Messaging API 的 Channel Secret |
| `LINE_CHANNEL_ACCESS_TOKEN` | – | LINE Messaging API 的 Access Token |
| `LINE_ADMIN_USER_ID` | – | 業務員 LINE userId（接收新客戶通知） |
| `PUBLIC_URL` | `http://localhost:3000` | 對外網址（用於產生問卷連結） |
| `LINK_SECRET` | 同 channel secret | 簽署 lid 用，建議獨立設定 |
| `DATABASE_URL` | – | 設定後自動切換到 PostgreSQL；本機開發不設則用 JSON 檔 |

未設定 LINE 環境變數時，LINE 相關功能會自動停用，網站照常運作。

範例：

```bash
PORT=8080 ADMIN_PASS=mySecret npm start
```

## API 端點

| Method | Path | 說明 |
|--------|------|------|
| `POST` | `/api/recommendations` | 即時計算推薦（不存資料） |
| `POST` | `/api/submissions` | 客戶送出問卷，儲存資料 |
| `POST` | `/api/admin/login` | 登入取得 token |
| `GET` | `/api/admin/customers` | 取得所有客戶（需驗證） |
| `GET` | `/api/admin/customers/:id` | 取得單筆 |
| `PATCH` | `/api/admin/customers/:id` | 更新狀態等欄位 |
| `DELETE` | `/api/admin/customers/:id` | 刪除 |
| `POST` | `/api/line/webhook` | LINE Bot Webhook 入口（驗簽） |
| `GET` | `/api/admin/line/status` | 查 LINE 啟用狀態與追蹤人數 |
| `GET` | `/api/admin/line/followers` | 所有 LINE 追蹤者 |
| `POST` | `/api/admin/customers/:id/push` | 對客戶（已綁定 LINE）發訊息 |
| `POST` | `/api/admin/line/push` | 對任意 userId 推播 |

## LINE 整合設定步驟

1. 到 [LINE Developers](https://developers.line.biz/console/) 建立 Provider → Messaging API channel
2. 取得 **Channel secret** 與 **Channel access token (long-lived)**
3. 取得自己的 **LINE userId**（要用來收新客戶通知）：可暫時在 webhook log 印出，或用官方工具查
4. 設定環境變數後啟動：
   ```bash
   LINE_CHANNEL_SECRET=xxx \
   LINE_CHANNEL_ACCESS_TOKEN=xxx \
   LINE_ADMIN_USER_ID=Uxxxxxxxxxxxxxxxx \
   PUBLIC_URL=https://your-domain.com \
   npm start
   ```
5. 在 LINE Developers 設定 Webhook URL：`https://your-domain.com/api/line/webhook` → Verify
6. 關閉「自動回覆訊息」、開啟「Webhook」
7. 加機器人為好友，輸入「保單」測試 → 應收到問卷連結（帶 signed `lid` token）

### 流程
```
客戶加 LINE → 收到歡迎訊息＋問卷按鈕（帶簽章 lid）
   ↓
點擊連結填問卷 → 提交時自動關聯 LINE userId
   ↓
後端：1) 存 JSON  2) Push 通知業務員  3) Push 確認訊息給客戶
   ↓
後台：客戶名稱旁顯示 LINE 標記 → 可點「💬 送 LINE 訊息」主動跟進
```

## 部署建議

- **Render / Railway / Fly.io**：直接部署 Node 服務即可
- **資料庫升級**：將 `db.js` 替換為 PostgreSQL/SQLite 即可，介面不變
- **Production 安全**：請務必修改 `ADMIN_PASS`，並考慮加上 HTTPS、Rate limit

