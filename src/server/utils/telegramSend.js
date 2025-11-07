/**
 * src/server/utils/telegramSend.js
 * Robust helper: converts aiResp -> plain text then forwards to telegram client or directly to Telegram API
 */
function toPlainText(aiResp) {
  if (typeof aiResp === 'string') return aiResp;
  if (aiResp && typeof aiResp === 'object' && aiResp.text) return aiResp.text;
  try { return JSON.stringify(aiResp); } catch(e) { return String(aiResp); }
}

async function _postToTelegramApi(token, chatId, text) {
  try {
    if (!token) throw new Error('TELEGRAM_BOT_TOKEN not provided');
    const url = 'https://api.telegram.org/bot' + token + '/sendMessage';
    const body = { chat_id: chatId, text: String(text) };
    // Node 18+ has global fetch
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const parsed = await res.text();
    let json;
    try { json = JSON.parse(parsed); } catch (e) { json = { raw: parsed }; }
    console.info('EXTERNAL-SEND-RESULT', { ok: res.ok, status: res.status, chatId, response: json });
    return json;
  } catch (err) {
    console.error('EXTERNAL-SEND-ERROR', { err: err && (err.stack||err.message||err) });
    throw err;
  }
}

async function sendText(telegramClient, chatId, aiResp) {
  const text = toPlainText(aiResp);
  // If a client is provided, use it
  try {
    if (telegramClient && typeof telegramClient.send === 'function') {
      const r = await telegramClient.send({ chatId, text });
      console.info('CLIENT-SEND-RESULT', { chatId, result: r });
      return r;
    }
    if (telegramClient && typeof telegramClient.sendMessage === 'function') {
      const r = await telegramClient.sendMessage(chatId, text);
      console.info('CLIENT-SEND-RESULT', { chatId, result: r });
      return r;
    }
  } catch (e) {
    console.error('CLIENT-SEND-ERROR', { err: e && (e.stack||e.message||e) });
    // fall through to try token-based send
  }

  // If no client or client failed, try direct HTTP call using TELEGRAM_BOT_TOKEN
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (token) {
    try {
      return await _postToTelegramApi(token, chatId, text);
    } catch (err) {
      // already logged in _postToTelegramApi
      return { ok: false, chatId, text, error: String(err) };
    }
  }

  // Last-resort: log and return shim object
  console.warn('NO-TELEGRAM-CLIENT-OR-TOKEN', { chatId, textPreview: String(text).slice(0,200) });
  return { chatId, text };
}

module.exports = { sendText, toPlainText };
