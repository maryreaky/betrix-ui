const fetch = globalThis.fetch || require('node-fetch');
module.exports = async function telegramWebhookHandler(req, res) {
  const update = req.body || {};
  try {
    console.log("INCOMING-UPDATE", JSON.stringify({
      update_id: update.update_id,
      type: update.message ? "message" : (update.callback_query ? "callback" : "other"),
      text: update.message?.text,
      chat_id: update.message?.chat?.id,
      from: update.message?.from?.username || update.from?.username || null
    }));
    res.status(200).send("OK");

    (async () => {
      try {
        const chatId = update.message?.chat?.id || update.callback_query?.message?.chat?.id;
        if (!chatId) return console.log("WEBHOOK-IGNORE No chat id");

        const text = (update.message?.text || "").trim();
        let reply = "I am live. Try /PING";
        if (text && text.toUpperCase() === "/PING") reply = "PONG";
        if (text && text.toUpperCase() === "/HELP") reply = "BETRIX bot ready. Commands: /PING";

        const token = process.env.TELEGRAM_BOT_TOKEN;
        const body = { chat_id: chatId, text: reply, parse_mode: "HTML" };
        const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
        const data = await resp.json();
        console.log("OUTGOING-RESPONSE", JSON.stringify({ ok: data.ok, description: data.description || null, payload: body }));
      } catch (err) {
        console.error("WEBHOOK-PROCESS-ERR", err && (err.stack || err.message));
      }
    })();
  } catch (err) {
    console.error("WEBHOOK-HANDLER-ERR", err && (err.stack || err.message));
    try { res.status(200).send("OK"); } catch (e) {}
  }
};
