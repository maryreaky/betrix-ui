/*
 * src/server/commands/index.js
 * Simple command router: /PING, /help, /bet (placeholder)
 */
module.exports = function commandRouter(app) {
  // register commands for Telegram (optional server-side)
  app.post("/webhook/telegram", async (req, res) => {
    // the actual webhook handler mounts this router; this file provides command dispatch
    const update = req.body || {};
    const text = (update.message && update.message.text) ? update.message.text.trim() : "";
    // quick ack
    res.status(200).send("OK");

    // background processing
    (async () => {
      try {
        const chatId = update.message?.chat?.id;
        if (!chatId) return;
        const token = process.env.TELEGRAM_BOT_TOKEN;
        const reply = { chat_id: chatId, text: "I am live. Try /PING", parse_mode: "HTML" };

        if (/^\/PING\b/i.test(text)) {
          reply.text = "PONG";
        } else if (/^\/HELP\b/i.test(text)) {
          reply.text = "BETRIX commands: /PING, /HELP, /BET <stake> <selection>";
        } else if (/^\/BET\b/i.test(text)) {
          // placeholder: send back structured acknowledgement and enqueue to retry worker if needed
          reply.text = "Received bet request. Processing... (this is a placeholder)";
        }

        const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(reply)
        });
        const data = await resp.json();
        console.log("OUTGOING-RESPONSE", JSON.stringify({ ok: data.ok, description: data.description || null, payload: reply }));
      } catch (err) {
        console.error("COMMAND-PROCESS-ERR", err && (err.stack || err.message));
      }
    })();
  });
};
