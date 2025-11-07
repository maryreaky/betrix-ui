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
  await if (!process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN.length < 20) { console.error("Skipping axios.post: TELEGRAM_BOT_TOKEN invalid"); return Promise.resolve({ ok: false, error: "missing-telegram-token" }); } axios.post(url, { chat_id: chatId, text });
};


