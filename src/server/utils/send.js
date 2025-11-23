// Deterministic send adapter - forwards to telegramSend.sendText
try {
  const path = require("path");
  const real = require(path.join(__dirname, "telegramSend.js"));
  if (real && typeof real.sendText === "function") {
    module.exports = {
      sendText: async function() { return real.sendText.apply(real, arguments); },
      prepareText: real.prepareText || (a => (a && a.text) || String(a || ""))
    };
    console.info("SEND-ADAPTER: forwarding to telegramSend");
  } else {
    console.error("SEND-ADAPTER: telegramSend missing sendText; providing safe fallback");
    module.exports = { sendText: async function(chatId, text) { console.error("SEND-ADAPTER-FALLBACK", {chatId}); return { ok:false, reason:"no-telegram-send" }; } };
  }
} catch (e) {
  console.error("SEND-ADAPTER-CRASH", e && (e.stack || e.message || e));
  module.exports = { sendText: async function(chatId, text){ return { ok:false, reason:"adapter-crash" }; } };
}
