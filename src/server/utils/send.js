// Normalizing send adapter
// Accepts multiple call shapes and forwards a clean (chatId, aiResp) to src/server/utils/telegramSend.js
try {
  const path = require('path');
  const realPath = path.join(__dirname, 'telegramSend.js');
  let real = null;
  try { real = require(realPath); } catch (e) { try { real = require('./telegramSend'); } catch (e2) { real = null; } }

  function toPlainText(ai) {
    if (!ai) return '';
    if (typeof ai === 'string') return ai;
    if (typeof ai === 'object') {
      if (typeof ai.text === 'string' && ai.text.length) return ai.text;
      if (typeof ai.toString === 'function') return String(ai).trim();
    }
    return '';
  }

  function normalizeArgs() {
    // Normalize flexible arguments into { chatId, aiResp }
    const args = Array.from(arguments);
    // Pattern: sendText(chatId, text)
    if (args.length === 2 && (typeof args[0] === 'number' || typeof args[0] === 'string')) {
      return { chatId: args[0], aiResp: args[1] };
    }
    // Pattern: sendText({ chatId, text })
    if (args.length === 1 && typeof args[0] === 'object' && (args[0].chatId || args[0].chat_id || args[0].id)) {
      const obj = args[0];
      return { chatId: obj.chatId || obj.chat_id || obj.id, aiResp: obj.text || obj.message || obj };
    }
    // Pattern: sendText(telegramClient, chatId, aiResp)
    if (args.length >= 3 && (typeof args[1] === 'number' || typeof args[1] === 'string')) {
      return { chatId: args[1], aiResp: args[2] };
    }
    // Last-resort: if first arg looks like a telegram response object (stub), try to extract chatId and/or text
    if (args.length === 1 && typeof args[0] === 'object') {
      const possible = args[0];
      // If object has chatId/text shape return it
      if (possible.chatId || possible.text) {
        return { chatId: possible.chatId || possible.chat_id || possible.id, aiResp: possible.text || possible };
      }
    }
    // Fallback: return as-is (will error later)
    return { chatId: args[0], aiResp: args[1] };
  }

  if (real && typeof real.sendText === 'function') {
    module.exports = {
      sendText: async function() {
        const { chatId, aiResp } = normalizeArgs.apply(null, arguments);
        const plainText = toPlainText(aiResp);

        // Defensive logging and early failure if text empty
        if (!plainText || String(plainText).trim().length === 0) {
          console.error('SEND-ADAPTER: abort send - empty text after normalization', { chatId, aiResp });
          // Keep fallback behavior minimal: return an informative object but do NOT call Telegram.
          return { ok: false, error: 'empty_text' };
        }

        // Build normalized aiResp to forward (prefer object with text)
        const forwardResp = (typeof aiResp === 'object') ? Object.assign({}, aiResp, { text: plainText }) : plainText;

        try {
          console.info('SEND-ADAPTER: forwarding to real.sendText', { chatId, preview: String(plainText).slice(0,200) });
          return await real.sendText(null, chatId, forwardResp);
        } catch (err) {
          console.error('SEND-ADAPTER: real.sendText threw', err && (err.stack || err.message || err));
          throw err;
        }
      },
      toPlainText: function(ai) {
        return toPlainText(ai);
      }
    };
    console.info('SEND-ADAPTER: installed (normalizing adapter)');
  } else {
    console.error('SEND-ADAPTER: real telegramSend not found; adapter cannot forward');
    module.exports = {
      sendText: async function(chatId, text) {
        console.info('SHIM Sending to Telegram (adapter fallback):', { chatId, text });
        return { chatId, text };
      },
      toPlainText: ai => (ai && ai.text) || String(ai || '')
    };
  }
} catch (ex) {
  console.error('SEND-ADAPTER-CRASH', ex && (ex.stack || ex.message || ex));
  module.exports = {
    sendText: async function(chatId, text) { console.error('SEND-ADAPTER-CRASH-FALLBACK'); return { chatId, text }; },
    toPlainText: ai => (ai && ai.text) || String(ai || '')
  };
}
