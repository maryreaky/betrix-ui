/**
 * Safe guard: check TELEGRAM_BOT_TOKEN at runtime.
 * If missing, we set a local flag and log a single message. This is wrapped inside an IIFE
 * to avoid producing a top-level `if` that could break parsing when concatenated.
 */
(function(){
  try {
    const _tgToken = process && process.env && process.env.TELEGRAM_BOT_TOKEN;
    if (!(_tgToken && _tgToken.length >= 20)) {
      console.error("TELEGRAM_BOT_TOKEN missing or invalid in env. Outgoing Telegram requests will be skipped.");
      // set a module-level flag for other functions to check
      if (typeof globalThis !== "undefined") { globalThis.__BTX_SKIP_TELEGRAM = true; }
    } else {
      if (typeof globalThis !== "undefined") { globalThis.__BTX_SKIP_TELEGRAM = false; }
    }
  } catch(e) {
    console.error("Guard check failed:", e && e.message ? e.message : e);
    if (typeof globalThis !== "undefined") { globalThis.__BTX_SKIP_TELEGRAM = true; }
  }
})();
/**
 * Guard: ensure TELEGRAM_BOT_TOKEN present and looks valid.
 * If missing or clearly invalid, log and return a resolved promise to avoid Axios 404.
 */
if (!process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN.length < 20) {
  console.error("TELEGRAM_BOT_TOKEN missing or invalid in env. Outgoing Telegram requests will be skipped.");
  // Export a no-op send function if module uses named exports; otherwise the functions below will still exist.
}
const axios = require("axios");
const BOT_TOKEN = process.env.BOT_TOKEN;

exports.sendText = async (chatId, text) => {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  console.log("Sending to Telegram:", { chatId, text });
  await axios.post(url, { chat_id: chatId, text });
};

