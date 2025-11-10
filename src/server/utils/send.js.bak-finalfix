// Adapter: always forward to telegramSend.js
try {
  const path = require('path');
  const realPath = path.join(__dirname, 'telegramSend.js');
  let real = null;
  try { real = require(realPath); } catch(e) { real = null; }

  if (real && typeof real.sendText === 'function') {
    module.exports = {
      sendText: async function() { return real.sendText.apply(this, arguments); },
      toPlainText: real.toPlainText || (ai => (ai && ai.text) || String(ai || ''))
    };
    console.info('SEND-ADAPTER: forwarding to real telegramSend');
  } else {
    console.error('SEND-ADAPTER: real telegramSend not loaded; shim fallback active');
    module.exports = {
      sendText: async function(chatId, text) { console.info('SHIM Sending to Telegram (adapter fallback):', { chatId, text }); return { chatId, text }; },
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
