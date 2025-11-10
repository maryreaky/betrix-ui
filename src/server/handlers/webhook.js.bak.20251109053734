module.exports = async function telegramWebhookHandler(req, res) {
  const update = req.body || {};
  try {
    console.log("INCOMING-UPDATE", {
      update_id: update.update_id,
      message_text: update.message?.text || update.callback_query?.data,
      chat_id: update.message?.chat?.id || update.callback_query?.message?.chat?.id
    });
    res.status(200).send("OK");
    (async () => {
      try {
        const chatId = update.message?.chat?.id || update.callback_query?.message?.chat?.id;
        if (!chatId) { console.log("WEBHOOK-IGNORE No chat id found in update"); return; }
        const replyText = `Echo: ${String(update.message?.text || update.callback_query?.data || "").slice(0,300)}`;
        const token = process.env.TELEGRAM_BOT_TOKEN;
        const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: replyText })
        }).then(r => r.json());
        console.log("OUTGOING-RESPONSE", { ok: resp.ok ?? resp.success, result: resp.result ? true : false, error: resp.description || null });
      } catch (err) { console.error("WEBHOOK-PROCESS-ERR", err && (err.stack || err.message)); }
    })();
  } catch (err) {
    console.error("WEBHOOK-HANDLER-ERR", err && (err.stack || err.message));
    try { res.status(200).send("OK"); } catch (e) {}
  }
};
