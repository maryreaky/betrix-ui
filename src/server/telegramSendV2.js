/**
 * telegramSendV2.js
 * Instrumented Telegram sender with timeout, retries and clear logs.
 * Reads TELEGRAM_BOT_TOKEN from env.
 */
const fetch = require("node-fetch");

async function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

async function sendTelegramV2(method, payload, opts = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("Missing TELEGRAM_BOT_TOKEN in env");
  const url = `https://api.telegram.org/bot${token}/${method}`;
  const maxRetries = opts.retries || 2;
  const timeoutMs = opts.timeoutMs || 15000;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(()=>controller.abort(), timeoutMs);
    try {
      console.log("T-OUTGOING:", method, JSON.stringify(payload).slice(0,800));
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timer);
      const text = await res.text().catch(()=>"<body-read-error>");
      console.log("T-OUTGOING-RESP: status=", res.status, "body_preview=", (typeof text === "string" ? text.slice(0,1500) : String(text)));
      try { return JSON.parse(text); } catch(e) { return { ok: res.ok, raw: text, status: res.status }; }
    } catch (err) {
      clearTimeout(timer);
      console.error("T-OUTGOING-ERROR attempt", attempt, err && (err.stack||err.message) || err);
      if (attempt < maxRetries) { await sleep(500 * Math.pow(2, attempt)); continue; } else { throw err; }
    }
  }
}
module.exports = { sendTelegramV2 };
