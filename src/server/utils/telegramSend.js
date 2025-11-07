/*
 Defensive telegramSend
 - Normalizes many call shapes and ensures Telegram never receives an empty text
 - Uses TELEGRAM_BOT_TOKEN from env and posts to Telegram via https
 - Logs EXTERNAL-SEND-TRACE / EXTERNAL-SEND-RESULT / EXTERNAL-SEND-ERROR
*/
const https = require('https');

function extractChatId(arg) {
  if (arg === null || arg === undefined) return null;
  if (typeof arg === 'number' || typeof arg === 'string') return arg;
  if (typeof arg === 'object') {
    if (arg.chat && (arg.chat.id || arg.chat_id)) return arg.chat.id || arg.chat_id;
    if (arg.chat_id) return arg.chat_id;
    if (arg.id) return arg.id;
    if (arg.chatId) return arg.chatId;
  }
  return null;
}

function extractText(arg) {
  if (!arg) return '';
  if (typeof arg === 'string') return arg;
  if (typeof arg === 'object') {
    if (typeof arg.text === 'string' && arg.text.length) return arg.text;
    if (typeof arg.message === 'string' && arg.message.length) return arg.message;
    // If the object looks like a stub { ok:true, text: '...' } handle it
    if (arg.text && typeof arg.text === 'string') return arg.text;
  }
  return '';
}

function toPayload(aiResp) {
  if (!aiResp) return { text: '' };
  if (typeof aiResp === 'string') return { text: aiResp };
  if (typeof aiResp === 'object') {
    if (aiResp.text) return Object.assign({}, aiResp, { text: String(aiResp.text) });
    // fallback stringify small objects
    try { return { text: JSON.stringify(aiResp).slice(0,4096) }; } catch(e) { return { text: String(aiResp) }; }
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
        headers: { 'Content-Type': 'application/json', 'Content-Length': data.length },
        timeout: timeoutMs
      };
      const req = https.request(opts, (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (c) => raw += c);
        res.on('end', () => {
          try { resolve({ statusCode: res.statusCode, body: JSON.parse(raw || '{}') }); } catch(e) { resolve({ statusCode: res.statusCode, body: raw }); }
        });
      });
      req.on('error', (err) => reject(err));
      req.on('timeout', () => req.destroy(new Error('request-timeout')));
      req.write(data);
      req.end();
    } catch (err) { reject(err); }
  });
}

async function sendText() {
  // Flexible signature support:
  // sendText(chatId, text)
  // sendText(telegramClient, chatId, aiResp)
  // sendText({ chatId, text })
  const args = Array.from(arguments);

  let chatId = null;
  let aiResp = null;

  if (args.length === 1) {
    // single object might be { chatId, text } or telegram message object
    const obj = args[0];
    chatId = extractChatId(obj);
    aiResp = (typeof obj === 'object' && obj.text) ? obj.text : obj;
  } else if (args.length === 2) {
    // (chatId, text) or (telegramClient, chatId)
    if (typeof args[0] === 'number' || typeof args[0] === 'string' || extractChatId(args[0])) {
      chatId = extractChatId(args[0]);
      aiResp = args[1];
    } else {
      // fallback
      chatId = extractChatId(args[1]);
      aiResp = args[0];
    }
  } else if (args.length >= 3) {
    // (telegramClient, chatId, aiResp)
    chatId = extractChatId(args[1]);
    aiResp = args[2];
  }

  // Last-resort attempts
  if (!chatId) {
    // try to find in any arg
    for (const a of args) { const c = extractChatId(a); if (c) { chatId = c; break; } }
  }
  if (!aiResp) {
    for (const a of args) { const t = extractText(a); if (t && t.length) { aiResp = t; break; } }
  }

  const token = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || process.env.TELEGRAM_TOKEN;
  if (!token) {
    const err = new Error('TELEGRAM_BOT_TOKEN not set');
    console.error('EXTERNAL-SEND-ERROR', { when: Date.now(), chatId, error: err.message });
    throw err;
  }

  const payload = toPayload(aiResp);
  const text = payload.text || '';
  if (!text || String(text).trim().length === 0) {
    console.error('EXTERNAL-SEND-ABORT-EMPTY-TEXT', { when: Date.now(), chatId, preview: payload && payload.text });
    // Return a structured error object but do not call Telegram
    const e = new Error('empty-message');
    e.code = 'empty-message';
    throw e;
  }

  const apiMethod = 'sendMessage';
  const url = https://api.telegram.org/bot8291858258:AAFB5ihmJLfTLyva1WpHEw-lReBidFoa-uc/;
  const body = Object.assign({}, payload, { chat_id: chatId });
  if (body.text && body.text.length > 4096) body.text = body.text.slice(0,4096);

  try {
    console.info('EXTERNAL-SEND-TRACE', { when: Date.now(), chatId, textPreview: String(body.text).slice(0,200) });
  } catch(e){}

  try {
    const res = await postJson(url, body, 10000);
    try { console.info('EXTERNAL-SEND-RESULT', { when: Date.now(), chatId, statusCode: res.statusCode, body: res.body }); } catch(e){}
    if (res && res.body && res.body.ok === false) {
      const apiErr = new Error('telegram-api-ok-false');
      apiErr.response = res.body;
      throw apiErr;
    }
    return res.body;
  } catch (err) {
    try { console.error('EXTERNAL-SEND-ERROR', { when: Date.now(), chatId, error: err && (err.response || err.message || err.stack) }); } catch(e){}
    throw err;
  }
}

module.exports = { sendText, toPlainText: (ai) => (ai && ai.text) || (typeof ai === 'string' ? ai : '') };
