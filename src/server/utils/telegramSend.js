/*
Safe telegramSend.js — env-driven, defensive
*/
const https = require("https");
const { URL } = require("url");

function postJson(url, body, timeoutMs = (process.env.PORT || (process.env.PORT || (process.env.PORT || process.env.PORT || 3000)))){
  return new Promise((resolve, reject) => {
    try {
      const u = new URL(url);
      const data = Buffer.from(JSON.stringify(body));
      const opts = { hostname: u.hostname, port: u.port || 443, path: u.pathname + (u.search || ""), method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": data.length }, timeout: timeoutMs };
      const req = https.request(opts, (res) => {
        let raw = "";
        res.setEncoding("utf8");
        res.on("data", (c) => raw += c);
        res.on("end", () => {
          try { resolve({ statusCode: res.statusCode, body: JSON.parse(raw || "{}") }); } catch(e) { resolve({ statusCode: res.statusCode, body: raw }); }
        });
      });
      req.on("error", (err) => reject(err));
      req.on("timeout", () => req.destroy(new Error("request-timeout")));
      req.write(data);
      req.end();
    } catch (err) { reject(err); }
  });
}

function prepareText(ai){
  if (!ai) return "";
  if (typeof ai === "string") return ai;
  if (typeof ai === "object") { if (ai.text) return String(ai.text); try { return JSON.stringify(ai).slice(0,4096); } catch(e){ return String(ai); } }
  return String(ai);
}

async function sendText(){
  const args = Array.from(arguments);
  let chatId = null; let payload = null;
  if (args.length === 1) { payload = args[0]; if (payload && payload.chat_id) chatId = payload.chat_id; }
  else if (args.length >= 2) { chatId = args[0]; payload = args[1]; }
  if (!chatId && payload && payload.chat && (payload.chat.id || payload.chat_id)) chatId = payload.chat.id || payload.chat_id;
  if (!chatId) throw new Error("missing-chatId");

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN missing");

  const text = prepareText(payload);
  if (!text || String(text).trim().length === 0) throw new Error("empty-text");

  const apiMethod = process.env.TELEGRAM_API_METHOD || "sendMessage";
  const url = `https://api.telegram.org/bot${token}/${apiMethod}`;
  const body = { chat_id: chatId, text: text.slice(0,4096) };

  try {
    console.info("EXTERNAL-SEND-TRACE",{when:Date.now(),chatId,textPreview: body.text.slice(0,200)});
    const res = await postJson(url, body, (process.env.PORT || (process.env.PORT || (process.env.PORT || process.env.PORT || 3000))));
    console.info("EXTERNAL-SEND-RESULT",{when:Date.now(),chatId,statusCode:res.statusCode,body:res.body});
    if (res && res.body && res.body.ok === false) { const apiErr = new Error("telegram-api-ok-false"); apiErr.response = res.body; throw apiErr; }
    return res.body;
  } catch (e) {
    console.error("EXTERNAL-SEND-ERROR",{when:Date.now(),chatId,error: e && (e.message || e.stack)});
    throw e;
  }
}

// idempotent webhook set on boot (best-effort)
(async function ensureWebhook(){
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const webhookUrl = process.env.WEBHOOK_URL || (process.env.RENDER_EXTERNAL_URL ? process.env.RENDER_EXTERNAL_URL + "/webhook/telegram" : null);
    if (token && webhookUrl) {
      const setUrl = `https://api.telegram.org/bot${token}/setWebhook`;
      await postJson(setUrl, { url: webhookUrl }, (process.env.PORT || (process.env.PORT || (process.env.PORT || process.env.PORT || 3000))));
      console.info("WEBHOOK-BOOT-SET", { when: Date.now(), webhook: webhookUrl });
    } else {
      console.info("WEBHOOK-BOOT-SKIP", { when: Date.now(), webhook: !!webhookUrl, token: !!token });
    }
  } catch (e) { console.error("WEBHOOK-BOOT-ERROR", e && (e.message || e.stack)); }
})();

module.exports = { sendText, prepareText };
