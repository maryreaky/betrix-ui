/**
 * Compatibility shim: src/server/utils/send.js
 *
 * Many existing handlers call:
 *   const { sendText } = require("../utils/send");
 *   await sendText(chatId, "message text");
 *
 * This shim forwards to the modern telegramSend helper when available,
 * or to a discovered telegram client, or logs the payload as a safe fallback.
 *
 * It intentionally avoids throwing so handlers remain non-fatal.
 */

let telegramSendHelper = null;

// Try to load the new helper if present
try {
  telegramSendHelper = require('../utils/telegramSend'); // relative to this file: src/server/utils/telegramSend.js
} catch (e) {
  try {
    // alternative path if code expects src path
    telegramSendHelper = require('../../server/utils/telegramSend');
  } catch (e2) {
    telegramSendHelper = null;
  }
}

// Try to locate an already-initialized telegram client module (best-effort)
let telegramClient = null;
try {
  telegramClient = require('../telegram'); // common place people put a telegram client module
} catch (e) {
  telegramClient = global.__TELEGRAM_CLIENT__ || null;
}

/**
 * sendText compatibility wrapper
 * Supports:
 *  - sendText(chatId, text)
 *  - sendText(chatId, text, opts)
 *  - sendText({ chatId, text })
 *
 * If telegramSendHelper.sendText exists and expects (telegramClient, chatId, aiResp)
 * we call it with discovered telegramClient; otherwise we try simple client methods.
 */
async function sendText(a, b, c) {
  try {
    // Normalized call: sendText(chatId, text)
    if (typeof a === 'object' && a !== null && a.chatId !== undefined) {
      const chatId = a.chatId;
      const text = a.text;
      return await _doSend(chatId, text);
    }

    if ((typeof a === 'number' || typeof a === 'string') && (typeof b === 'string' || typeof b === 'number' || typeof b === 'object')) {
      const chatId = a;
      const text = b;
      return await _doSend(chatId, text);
    }

    // If a is text only (legacy), log and return
    if (typeof a === 'string' && b === undefined) {
      return await _doSend(null, a);
    }

    // Unknown shape: stringify and send/log
    return await _doSend(null, JSON.stringify(a));
  } catch (err) {
    console.error("send.js shim error:", err && err.stack ? err.stack : err);
    return { ok: false, error: String(err) };
  }
}

async function _doSend(chatId, aiResp) {
  // If we have the modern helper with signature sendText(telegramClient, chatId, aiResp)
  if (telegramSendHelper && typeof telegramSendHelper.sendText === 'function') {
    try {
      return await telegramSendHelper.sendText(telegramClient, chatId, aiResp);
    } catch (e) {
      console.error("telegramSend helper failed, falling back:", e && e.message ? e.message : e);
    }
  }

  // If we have a telegramClient with .send or .sendMessage, try those
  if (telegramClient) {
    try {
      const text = (typeof aiResp === 'string') ? aiResp : (aiResp && aiResp.text) ? aiResp.text : JSON.stringify(aiResp);
      if (typeof telegramClient.send === 'function') {
        return await telegramClient.send({ chatId, text });
      }
      if (typeof telegramClient.sendMessage === 'function') {
        return await telegramClient.sendMessage(chatId, text);
      }
      // Some clients expect (chatId, text)
      if (typeof telegramClient.sendText === 'function') {
        return await telegramClient.sendText(chatId, text);
      }
    } catch (e) {
      console.error("telegramClient send failed:", e && e.message ? e.message : e);
    }
  }

  // Last-resort: print to logs and return a stub
  const text = (typeof aiResp === 'string') ? aiResp : (aiResp && aiResp.text) ? aiResp.text : JSON.stringify(aiResp);
  console.info("SHIM Sending to Telegram (shim fallback):", { chatId, text });
  return { ok: true, chatId, text, shimFallback: true };
}

module.exports = { sendText };
