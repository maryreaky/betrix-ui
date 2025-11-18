/*
 Emergency recovery menu-handler shim
 Replaces previous file with a minimal, safe implementation that exports handleCommand.
 This is temporary — restore your full implementation after stability is confirmed.
*/
let _fetch;
try {
  const nf = require('node-fetch');
  _fetch = (nf && nf.default) ? nf.default : nf;
} catch (e) {
  // fallback to global fetch if available
  if (typeof fetch !== 'undefined') _fetch = fetch;
  else throw e;
}

async function handleCommand(env, jobOrUpdate) {
  try {
    const payload = jobOrUpdate && (jobOrUpdate.payload || jobOrUpdate);
    const chatId = payload && payload.message && payload.message.chat && payload.message.chat.id;
    const text = (payload && payload.message && payload.message.text) || (payload && payload.text) || '';
    const reply = `BETRIX (temporary handler): received: ${text || \"<no-text>\"}`;
    if (chatId && env && env.TELEGRAM_TOKEN) {
      try {
        await _fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: reply })
        });
      } catch (err) {
        console.error(new Date().toISOString(), 'RECOVERY_SHIM_SEND_ERR', err && (err.stack || err.message));
      }
    } else {
      console.error(new Date().toISOString(), 'RECOVERY_SHIM_NO_CHAT_OR_TOKEN', { chatId, hasToken: !!(env && env.TELEGRAM_TOKEN) });
    }
    return { ok: true, chatId, shim: true };
  } catch (err) {
    console.error(new Date().toISOString(), 'RECOVERY_SHIM_ERR', err && (err.stack || err.message));
    return { ok: false, error: err && err.message };
  }
}

module.exports = { handleCommand };


