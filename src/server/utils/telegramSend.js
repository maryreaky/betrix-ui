/*
  Minimal, production-safe Telegram sender
  - Uses TELEGRAM_BOT_TOKEN from process.env (Render must have it)
  - Exports async sendText(telegramClient, chatId, aiResp)
  - Logs EXTERNAL-SEND-TRACE / EXTERNAL-SEND-RESULT / EXTERNAL-SEND-ERROR
*/
const https = require('https');

function normalize(aiResp) {
  if (!aiResp) return { text: '' };
  if (typeof aiResp === 'string') return { text: aiResp };
  if (typeof aiResp === 'object') {
    if (aiResp.text) return aiResp;
    return { text: String(aiResp) };
  }
  return { text: String(aiResp) };
}

function postJson(url, body, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    try {
      const u = new URL(url);
      const data = Buffer.from(JSON.stringify(body));
      const opts = {
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname + (u.search || ''),
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length
        },
        timeout: timeoutMs
      };
      const req = https.request(opts, (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => raw += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(raw || '{}');
            resolve({ statusCode: res.statusCode, body: parsed });
          } catch (e) {
            resolve({ statusCode: res.statusCode, body: raw });
          }
        });
      });
      req.on('error', (err) => reject(err));
      req.on('timeout', () => req.destroy(new Error('request-timeout')));
      req.write(data);
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

async function sendText(telegramClient, chatId, aiResp) {
  const token = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || process.env.TELEGRAM_TOKEN;
  if (!token) {
    const err = new Error('TELEGRAM_BOT_TOKEN not set in environment');
    console.error('EXTERNAL-SEND-ERROR', { when: Date.now(), chatId, error: err.message });
    throw err;
  }

  const payload = normalize(aiResp);
  const apiMethod = 'sendMessage';
  const url = `https://api.telegram.org/bot${token}/${apiMethod}`;
  const body = Object.assign({}, payload, { chat_id: chatId });
  if (body.text && body.text.length > 4096) body.text = body.text.slice(0, 4096);

  console.info('EXTERNAL-SEND-TRACE', { when: Date.now(), chatId, preview: body.text && body.text.slice(0,200) });

  try {
    const res = await postJson(url, body, 10000);
    try {
      console.info('EXTERNAL-SEND-RESULT', { when: Date.now(), chatId, statusCode: res.statusCode, body: res.body });
    } catch (e) {}
    if (res && res.body && res.body.ok === false) {
      const apiErr = new Error('telegram-api-ok-false');
      apiErr.response = res.body;
      throw apiErr;
    }
    return res.body;
  } catch (err) {
    try {
      const errBody = err && err.response ? err.response : (err && (err.stack || err.message));
      console.error('EXTERNAL-SEND-ERROR', { when: Date.now(), chatId, error: errBody });
    } catch (e) {}
    throw err;
  }
}

module.exports = { sendText, toPlainText: (aiResp) => normalize(aiResp).text };

