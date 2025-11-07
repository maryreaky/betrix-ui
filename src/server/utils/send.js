// Adapter: force use of src/server/utils/telegramSend.js
try {
  const path = require('path');
  const realPath = path.join(__dirname, 'telegramSend.js');
  let real = null;
  try { real = require(realPath); } catch (e) {
    try { real = require('./telegramSend'); } catch (e2) { real = null; }
  }

  if (real && typeof real.sendText === 'function') {
    module.exports = {
      sendText: async function() {
        return real.sendText.apply(this, arguments);
      },
      toPlainText: real.toPlainText || (ai => (ai && ai.text) || String(ai || ''))
    };
    console.info('SEND-ADAPTER: using real telegramSend at', realPath);
  } else {
    console.error('SEND-ADAPTER: real telegramSend not found; falling back to shim. Check src/server/utils/telegramSend.js');
    module.exports = {
      sendText: async function(chatId, text) {
        console.info('SHIM Sending to Telegram (force-adapter fallback):', { chatId, text });
        return { chatId, text };
      },
      toPlainText: ai => (ai && ai.text) || String(ai || '')
    };
  }
} catch (ex) {
  console.error('SEND-ADAPTER-ERROR', ex && ex.stack ? ex.stack : ex);
  module.exports = {
    sendText: async function(chatId, text) { console.error('SEND-ADAPTER-CRASH-FALLBACK'); return { chatId, text }; },
    toPlainText: ai => (ai && ai.text) || String(ai || '')
  };
}
