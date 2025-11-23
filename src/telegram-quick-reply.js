const express = require("express");
const router = express.Router();
router.post("/telegram", async (req, res) => {
  try {
    // quick immediate reply: echo back text or send a fixed confirmation
    const body = req.body || {};
    const chatId = (body.message && body.message.chat && body.message.chat.id) || (body.callback_query && body.callback_query.message && body.callback_query.message.chat && body.callback_query.message.chat.id);
    const text = (body.message && body.message.text) ? ("Auto-reply: " + body.message.text) : "Auto-reply: received";
    if (chatId && process.env.TELEGRAM_BOT_TOKEN) {
      const payload = { chat_id: chatId, text };
      await fetch("https://api.telegram.org/bot" + process.env.TELEGRAM_BOT_TOKEN + "/sendMessage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    res.status(200).send("ok");
  } catch (err) {
    console.error("quick-reply error", err);
    res.status(200).send("ok");
  }
});
module.exports = router;
