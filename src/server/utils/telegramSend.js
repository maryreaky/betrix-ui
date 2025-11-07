/**
 * src/server/utils/telegramSend.js
 * Safe helper: converts aiResp -> plain text then forwards to telegram client
 */
function toPlainText(aiResp) {
  if (typeof aiResp === "string") return aiResp;
  if (aiResp && typeof aiResp === "object" && aiResp.text) return aiResp.text;
  try { return JSON.stringify(aiResp); } catch(e) { return String(aiResp); }
}
async function sendText(telegramClient, chatId, aiResp) {
  const text = toPlainText(aiResp);
  if (telegramClient && typeof telegramClient.send === "function") return telegramClient.send({ chatId, text });
  if (telegramClient && typeof telegramClient.sendMessage === "function") return telegramClient.sendMessage(chatId, text);
  return { chatId, text };
}
module.exports = { sendText, toPlainText };
  
// EXTERNAL-SEND-RESULT/EXTERNAL-SEND-ERROR instrumentation added temporarily for debugging.
// Remove after you capture the Telegram API response.
const __orig_send_impl_marker = Symbol.for('__orig_send_impl_marker');
try {
  (function instrument() {
    const util = require('util');
    const mod = module.exports || exports;
    // If module exports an async sendText(telegramClient, chatId, aiResp)
    if (mod && typeof mod.sendText === 'function') {
      const orig = mod.sendText;
      mod.sendText = async function debugSendText() {
        const args = Array.from(arguments);
        const chatId = args[1];
        let preview = '<no-preview>';
        try { preview = typeof args[2] === 'string' ? args[2] : (args[2] && args[2].text) || JSON.stringify(args[2]).slice(0,200); } catch (e) {}
        console.info('EXTERNAL-SEND-TRACE', { when: Date.now(), chatId, preview });
        try {
          const res = await orig.apply(this, args);
          try {
            // Log returned response; if axios-style, res.data; otherwise full res (trimmed)
            const resultForLog = (res && res.data) ? res.data : res;
            console.info('EXTERNAL-SEND-RESULT', { when: Date.now(), chatId, result: resultForLog });
          } catch (e) {
            console.error('EXTERNAL-SEND-RESULT-LOG-ERR', e && e.stack ? e.stack : e);
          }
          return res;
        } catch (err) {
          try {
            // If error.response exists (axios), include response.data
            const errBody = err && err.response ? (err.response.data || err.response) : (err && (err.stack || err.message) ) ;
            console.error('EXTERNAL-SEND-ERROR', { when: Date.now(), chatId, error: errBody });
          } catch (e) {
            console.error('EXTERNAL-SEND-ERROR-LOG-ERR', e && e.stack ? e.stack : e);
          }
          throw err;
        }
      };
      console.info('EXTERNAL-SEND-INSTRUMENTATION: installed on telegramSend.sendText');
    } else {
      console.warn('EXTERNAL-SEND-INSTRUMENTATION: sendText not found to instrument in telegramSend');
    }
  })();
} catch (outer) {
  console.error('EXTERNAL-SEND-INSTRUMENTATION-FAILED', outer && outer.stack ? outer.stack : outer);
}
  
