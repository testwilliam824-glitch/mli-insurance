# Render 部署教學

## 前置作業

1. GitHub 帳號（[github.com](https://github.com)）
2. Render 帳號（[render.com](https://render.com)，可用 GitHub 帳號登入）

## Step 1：把專案推上 GitHub

在 `三商美邦人壽智能服務平台` 目錄底下：

```bash
cd /Users/william/Desktop/三商美邦人壽智能服務平台
git init
git add .
git commit -m "Initial commit: 三商美邦人壽智能服務平台"
```

然後到 GitHub 建立新 repo（例如 `mli-insurance`），再執行：

```bash
git remote add origin https://github.com/<你的帳號>/mli-insurance.git
git branch -M main
git push -u origin main
```

## Step 2：在 Render 建立服務

### 方法 A：用 Blueprint（一鍵套用，推薦）

1. 登入 Render → 上方點「**New +**」→「**Blueprint**」
2. 連結你剛才的 GitHub repo
3. Render 會自動讀 `web/render.yaml`，按「**Apply**」
4. 進入服務頁面 → 「**Environment**」分頁，補上：
   - `ADMIN_PASS`（後台密碼，自訂）
   - `LINE_CHANNEL_SECRET`（先空著沒關係）
   - `LINE_CHANNEL_ACCESS_TOKEN`（先空著沒關係）
   - `LINE_ADMIN_USER_ID`（先空著沒關係）
   - `PUBLIC_URL`（**部署完成後**填回你的 Render 網址，例如 `https://mli-insurance.onrender.com`）

### 方法 B：手動建立 Web Service

1. 「**New +**」→「**Web Service**」→ 連結 GitHub repo
2. 設定：
   - **Name**：`mli-insurance`
   - **Region**：Singapore（最近）
   - **Branch**：`main`
   - **Root Directory**：`web/server`
   - **Runtime**：Node
   - **Build Command**：`npm install`
   - **Start Command**：`npm start`
   - **Plan**：Free
3. 「**Environment Variables**」加入：

| Key | Value |
|---|---|
| `ADMIN_USER` | `admin` |
| `ADMIN_PASS` | 自訂的強密碼 |
| `LINK_SECRET` | 任意長字串（用於簽署 LINE token） |
| `LINE_CHANNEL_SECRET` | （之後填）|
| `LINE_CHANNEL_ACCESS_TOKEN` | （之後填）|
| `LINE_ADMIN_USER_ID` | （之後填）|
| `PUBLIC_URL` | （部署後填回 Render 網址）|

4. 點「Create Web Service」，等 build & deploy 完成（約 2–3 分鐘）

## Step 3：取得網址

部署完成後，Render 會給你類似：
```
https://mli-insurance.onrender.com
```

打開應該看到問卷頁。後台在 `/admin.html`。

**記得回 Environment 把 `PUBLIC_URL` 設成這個網址**，重新部署一次（Manual Deploy → Deploy latest commit）。

## Step 4：設定 LINE Webhook

1. 到 [LINE Developers](https://developers.line.biz/console/) 建立 Messaging API channel
2. 取得 **Channel secret**、**Channel access token**
3. 填回 Render Environment：
   - `LINE_CHANNEL_SECRET`
   - `LINE_CHANNEL_ACCESS_TOKEN`
4. 到 LINE Developers → Messaging API → Webhook URL：
   ```
   https://mli-insurance.onrender.com/api/line/webhook
   ```
   按「**Verify**」應該變綠勾，然後開啟「**Use webhook**」、關閉「**Auto-reply messages**」
5. 加機器人為好友，發訊息「保單」測試
6. 第一次發訊息後，到 Render Logs 看到自己的 userId（會出現在 follower 紀錄），複製到 `LINE_ADMIN_USER_ID` 環境變數，重新部署 → 之後就能收新客戶通知

## ⚠️ 免費方案注意事項

| 項目 | 說明 |
|---|---|
| **冷啟動** | 閒置 15 分鐘後服務會休眠，下一次請求要等 30 秒喚醒。LINE webhook 偶爾會 timeout，建議升級或用 [cron-job.org](https://cron-job.org) 每 10 分鐘 ping 一次首頁 |
| **資料持久性** | **本專案已自動使用 PostgreSQL**（`render.yaml` 已配置免費 DB），資料完整保留 ✅ |
| **Postgres 免費限制** | Render 免費 PostgreSQL 保留 **90 天**，到期會被刪除。實際上線請升級資料庫到 Starter（$7/月） |

## 儲存層說明

專案會根據環境變數**自動切換**：

| 環境 | 條件 | 儲存層 |
|---|---|---|
| 本機開發 | 沒設定 `DATABASE_URL` | JSON 檔 (`data/customers.json`) |
| Render 部署 | `render.yaml` 自動注入 `DATABASE_URL` | PostgreSQL |

第一次啟動時，會自動建立 schema（`customers` 與 `followers` 兩張表），不用手動執行 migration。

## Step 5：日後更新

改完程式碼後：
```bash
git add .
git commit -m "update"
git push
```
Render 偵測到推送會自動重新部署。

## 疑難排解

- **Build 失敗 "Cannot find module"** → 確認 `Root Directory` 設為 `web/server`
- **網站打開 502** → 看 Logs；通常是還在啟動，等一下重新整理
- **LINE Verify 失敗** → 確認 `LINE_CHANNEL_SECRET` 正確、`PUBLIC_URL` 已設定、Webhook URL 結尾是 `/api/line/webhook`
- **後台登入不進去** → 確認 `ADMIN_PASS` 環境變數的值，瀏覽器 DevTools Network 看 `/api/admin/login` 回傳
