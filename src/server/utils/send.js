// Forwarding adapter to telegramSend.js (persistent)
try {
  const path = require('path');
  const real = require(path.join(__dirname,'telegramSend.js'));
  if (real && typeof real.sendText === 'function') {
    module.exports = { sendText: async function(){ return real.sendText.apply(this,arguments); }, toPlainText: real.toPlainText || (ai => (ai && ai.text) || String(ai || '')) };
    console.info('SEND-ADAPTER: forwarding to real telegramSend');
  } else {
    console.error('SEND-ADAPTER: real telegramSend not available; shim fallback active');
    module.exports = { sendText: async function(chatId,text){ console.info('SHIM Sending to Telegram (adapter fallback):',{chatId,text}); return { chatId, text }; }, toPlainText: ai => (ai && ai.text) || String(ai || '') };
  }
} catch (ex) {
  console.error('SEND-ADAPTER-CRASH', ex && (ex.stack || ex.message || ex));
  module.exports = { sendText: async function(chatId,text){ console.error('SEND-ADAPTER-CRASH-FALLBACK'); return { chatId, text }; }, toPlainText: ai => (ai && ai.text) || String(ai || '') };
}
