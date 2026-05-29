const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const line = require('./line');
const { generateRecommendations } = require('./recommender');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'mli2024';

app.use(cors());
app.use(express.json({
  limit: '1mb',
  verify: (req, _res, buf) => { req.rawBody = buf.toString('utf-8'); },
}));
app.use(express.static(path.join(__dirname, '..', 'public')));

function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.replace(/^Basic\s+/i, '');
  if (!token) return res.status(401).json({ error: 'unauthorized' });
  let decoded = '';
  try { decoded = Buffer.from(token, 'base64').toString('utf-8'); }
  catch { return res.status(401).json({ error: 'unauthorized' }); }
  const [user, pass] = decoded.split(':');
  if (user !== ADMIN_USER || pass !== ADMIN_PASS) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// ---- 公開 API ----
app.post('/api/recommendations', (req, res) => {
  res.json(generateRecommendations(req.body || {}));
});

app.post('/api/submissions', asyncHandler(async (req, res) => {
  const body = req.body || {};
  if (!body.name || !body.phone) {
    return res.status(400).json({ error: 'name and phone are required' });
  }

  let lineUserId = null;
  if (body.lid) lineUserId = line.verifySignedUserId(body.lid);

  const result = generateRecommendations(body);
  const { lid, ...clean } = body;
  const customer = await db.createCustomer({
    ...clean,
    line_user_id: lineUserId,
    recommendations: result.recommendations,
    allocation: result.allocation,
    budget: result.budget,
  });

  const topRec = result.recommendations[0]?.title || '無';
  line.pushAdmin({
    type: 'text',
    text: `🔔 新客戶諮詢\n\n姓名：${customer.name}\n電話：${customer.phone || '-'}\nLINE ID：${customer.line_id || '-'}\nEmail：${customer.email || '-'}\n年齡：${customer.age || '-'}\n年收入：${customer.income || '-'}\n推薦：${topRec}\n編號：SM${String(customer.id).padStart(6, '0')}`,
  }).catch(() => {});

  if (lineUserId) {
    line.push(lineUserId, {
      type: 'text',
      text: `✅ 已收到您的諮詢，編號 SM${String(customer.id).padStart(6, '0')}。\n為您推薦：${topRec}\n專員將盡快與您聯繫！`,
    }).catch(() => {});
  }

  res.status(201).json({ id: customer.id, recommendations: result.recommendations });
}));

// ---- LINE Webhook ----
app.post('/api/line/webhook', asyncHandler(async (req, res) => {
  const signature = req.headers['x-line-signature'];
  if (line.isEnabled() && !line.verifySignature(req.rawBody || '', signature)) {
    return res.status(401).send('invalid signature');
  }
  res.status(200).end();

  const events = (req.body && req.body.events) || [];
  for (const ev of events) {
    try {
      if (ev.source && ev.source.userId) {
        await db.upsertFollower(ev.source.userId);
      }
      if (ev.type === 'follow' && ev.source?.userId) {
        await line.reply(ev.replyToken, line.welcomeMessage(ev.source.userId));
      } else if (ev.type === 'unfollow' && ev.source?.userId) {
        await db.removeFollower(ev.source.userId);
      } else if (ev.type === 'message' && ev.message?.type === 'text') {
        await line.reply(ev.replyToken, line.handleKeyword(ev.message.text, ev.source.userId));
      }
    } catch (e) {
      console.error('LINE event error:', e.message);
    }
  }
}));

// ---- Admin API ----
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    return res.json({ token: Buffer.from(`${username}:${password}`).toString('base64') });
  }
  res.status(401).json({ error: '帳號或密碼錯誤' });
});

app.get('/api/admin/customers', requireAdmin, asyncHandler(async (_req, res) => {
  res.json({ customers: await db.listCustomers() });
}));

app.get('/api/admin/customers/:id', requireAdmin, asyncHandler(async (req, res) => {
  const customer = await db.getCustomer(req.params.id);
  if (!customer) return res.status(404).json({ error: 'not found' });
  res.json({ customer });
}));

app.patch('/api/admin/customers/:id', requireAdmin, asyncHandler(async (req, res) => {
  const updated = await db.updateCustomer(req.params.id, req.body || {});
  if (!updated) return res.status(404).json({ error: 'not found' });
  res.json({ customer: updated });
}));

app.delete('/api/admin/customers/:id', requireAdmin, asyncHandler(async (req, res) => {
  const ok = await db.deleteCustomer(req.params.id);
  if (!ok) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true });
}));

app.get('/api/admin/line/status', requireAdmin, asyncHandler(async (_req, res) => {
  const followers = await db.listFollowers();
  res.json({ enabled: line.isEnabled(), followers: followers.length });
}));

app.get('/api/admin/line/followers', requireAdmin, asyncHandler(async (_req, res) => {
  res.json({ followers: await db.listFollowers() });
}));

app.post('/api/admin/customers/:id/push', requireAdmin, asyncHandler(async (req, res) => {
  const customer = await db.getCustomer(req.params.id);
  if (!customer) return res.status(404).json({ error: 'not found' });
  if (!customer.line_user_id) return res.status(400).json({ error: '此客戶未綁定 LINE' });
  const text = (req.body && req.body.text) || '';
  if (!text.trim()) return res.status(400).json({ error: '訊息內容不可為空' });
  await line.push(customer.line_user_id, { type: 'text', text });
  res.json({ ok: true });
}));

app.post('/api/admin/line/push', requireAdmin, asyncHandler(async (req, res) => {
  const { userId, text } = req.body || {};
  if (!userId || !text) return res.status(400).json({ error: 'userId and text required' });
  await line.push(userId, { type: 'text', text });
  res.json({ ok: true });
}));

// JSON parse error 處理（必須在通用 error handler 前）
app.use((err, _req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'invalid JSON' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'payload too large' });
  }
  next(err);
});

app.use((err, _req, res, _next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: err.message || 'internal error' });
});

async function start() {
  await db.init();
  app.listen(PORT, () => {
    console.log(`🏦 三商美邦人壽智能服務平台 (PORT ${PORT})`);
    console.log(`   問卷頁:       http://localhost:${PORT}/`);
    console.log(`   後台:         http://localhost:${PORT}/admin.html`);
    console.log(`   LINE Webhook: ${line.isEnabled() ? '✅ 已啟用' : '⚠️ 未設定'}`);
  });
}

start().catch((e) => {
  console.error('啟動失敗:', e);
  process.exit(1);
});
