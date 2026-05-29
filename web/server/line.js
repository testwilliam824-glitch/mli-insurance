const crypto = require('crypto');
const https = require('https');

const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || '';
const ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
const ADMIN_USER_ID = process.env.LINE_ADMIN_USER_ID || '';
const PUBLIC_URL = process.env.PUBLIC_URL || 'http://localhost:3000';
const LINK_SECRET = process.env.LINK_SECRET || CHANNEL_SECRET || 'change-me';

function isEnabled() {
  return Boolean(CHANNEL_SECRET && ACCESS_TOKEN);
}

function verifySignature(rawBody, signature) {
  if (!CHANNEL_SECRET) return false;
  const hash = crypto.createHmac('sha256', CHANNEL_SECRET).update(rawBody).digest('base64');
  try {
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature || ''));
  } catch {
    return false;
  }
}

function signUserId(userId) {
  const sig = crypto.createHmac('sha256', LINK_SECRET).update(userId).digest('hex').slice(0, 16);
  return `${userId}.${sig}`;
}

function verifySignedUserId(token) {
  if (!token || typeof token !== 'string') return null;
  const idx = token.lastIndexOf('.');
  if (idx < 0) return null;
  const userId = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expected = crypto.createHmac('sha256', LINK_SECRET).update(userId).digest('hex').slice(0, 16);
  try {
    if (crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return userId;
  } catch {}
  return null;
}

function surveyLink(userId) {
  const token = signUserId(userId);
  const sep = PUBLIC_URL.includes('?') ? '&' : '?';
  return `${PUBLIC_URL}/${sep}lid=${encodeURIComponent(token)}`;
}

function request(path, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const req = https.request(
      {
        hostname: 'api.line.me',
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + ACCESS_TOKEN,
          'Content-Length': Buffer.byteLength(data),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(body);
          else reject(new Error(`LINE API ${res.statusCode}: ${body}`));
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function reply(replyToken, messages) {
  if (!isEnabled()) return Promise.resolve();
  const arr = Array.isArray(messages) ? messages : [messages];
  return request('/v2/bot/message/reply', { replyToken, messages: arr });
}

function push(to, messages) {
  if (!isEnabled()) return Promise.resolve();
  if (!to) return Promise.reject(new Error('missing userId'));
  const arr = Array.isArray(messages) ? messages : [messages];
  return request('/v2/bot/message/push', { to, messages: arr });
}

function pushAdmin(messages) {
  if (!ADMIN_USER_ID) return Promise.resolve();
  return push(ADMIN_USER_ID, messages).catch((e) => console.error('LINE pushAdmin failed:', e.message));
}

function welcomeMessage(userId) {
  const link = surveyLink(userId);
  return [
    {
      type: 'text',
      text: '👋 歡迎使用三商美邦人壽智能服務平台！\n\n我是您的 AI 保險顧問，可以幫您：\n🏦 分析保險需求\n💰 推薦適合三商美邦保單\n📊 節稅規劃建議\n🔄 資產傳承規劃\n\n輸入「保單」開始為您量身推薦！',
    },
    surveyTemplate(link),
  ];
}

function surveyTemplate(link) {
  return {
    type: 'template',
    altText: '三商美邦保單智能推薦',
    template: {
      type: 'buttons',
      title: '🏦 三商美邦保單智能推薦',
      text: '點擊下方按鈕填寫問卷，為您量身推薦最適合的保單！',
      actions: [
        { type: 'uri', label: '📝 開始填寫問卷', uri: link },
        { type: 'message', label: '💰 節稅規劃', text: '節稅規劃' },
        { type: 'message', label: '📞 聯絡專員', text: '聯絡專員' },
      ],
    },
  };
}

function handleKeyword(text, userId) {
  const t = (text || '').trim().toLowerCase();
  const link = surveyLink(userId);

  if (/保單|推薦|諮詢|問卷|insurance/.test(t)) {
    return [surveyTemplate(link)];
  }
  if (/節稅|遺產|傳承|稅務/.test(t)) {
    return [
      {
        type: 'text',
        text:
          '💰 高資產節稅傳承規劃\n\n透過三商美邦保單，您可以：\n✅ 保險給付免計入遺產（遺贈稅法第16條）\n✅ 每人每年 333 萬免稅額度\n✅ 直接指定受益人，不經繼承程序\n✅ 債權隔離，保護家族資產\n\n推薦保單：\n• 新吉好利增額壽險\n• 珍吉利增額壽險\n• 加美利外幣增額壽險\n\n📝 點擊下方按鈕取得個人化推薦！',
      },
      surveyTemplate(link),
    ];
  }
  if (/聯絡|電話|專員|顧問/.test(t)) {
    return {
      type: 'text',
      text:
        '📞 聯絡我們\n\n專業顧問將為您提供一對一服務：\n\n🏦 三商美邦人壽\n☎️ 電話：02-1234-5678\n📧 Email：service@mli.com\n\n⏰ 服務時間：週一至週五 09:00-18:00\n\n📝 您也可以填寫問卷，我們會盡快與您聯繫！',
    };
  }
  if (/^(hi|hello|你好|您好|哈囉)/.test(t)) {
    return welcomeMessage(userId);
  }
  return {
    type: 'text',
    text:
      '抱歉，我不太明白您的意思 😅\n\n請輸入以下關鍵字：\n📝 「保單」/「推薦」- 開始問卷\n💰 「節稅」- 節稅規劃資訊\n📞 「聯絡」- 聯絡專員',
  };
}

module.exports = {
  isEnabled,
  verifySignature,
  reply,
  push,
  pushAdmin,
  welcomeMessage,
  handleKeyword,
  surveyLink,
  signUserId,
  verifySignedUserId,
};
