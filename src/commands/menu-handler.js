/*
Recovery shim (safe, escape-free)
Exports handleCommand; sends a simple Telegram reply using an absolute URL.
Replace with your full implementation after service is stable.
*/
let _fetch;
try {
  const nf = require('node-fetch');
  _fetch = (nf && nf.default) ? nf.default : nf;
} catch (e) {
  if (typeof fetch !== 'undefined') _fetch = fetch;
  else throw e;
}

async function handleCommand(env, jobOrUpdate) {
  try {
    const payload = jobOrUpdate && (jobOrUpdate.payload || jobOrUpdate);
    const chatId = payload && payload.message && payload.message.chat && payload.message.chat.id;
    const text = (payload && payload.message && payload.message.text) || (payload && payload.text) || '';
    const reply = "BETRIX (temporary handler): received: " + (text || "<no-text>");
    if (chatId && env && env.TELEGRAM_TOKEN) {
      try {
        const url = "https://api.telegram.org/bot" + env.TELEGRAM_TOKEN + "/sendMessage";
        await _fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: reply })
        });
      } catch (err) {
        console.error(new Date().toISOString(), "RECOVERY_SHIM_SEND_ERR", err && (err.stack || err.message));
      }
    } else {
      console.error(new Date().toISOString(), "RECOVERY_SHIM_NO_CHAT_OR_TOKEN", { chatId, hasToken: !!(env && env.TELEGRAM_TOKEN) });
    }
    return { ok: true, chatId, shim: true };
  } catch (err) {
    console.error(new Date().toISOString(), "RECOVERY_SHIM_ERR", err && (err.stack || err.message));
    return { ok: false, error: err && err.message };
  }
}

module.exports = { handleCommand };
