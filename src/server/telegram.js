const express = require("express");
const router = express.Router();

// Minimal POST /telegram route — expects X-Telegram-Bot-Api-Secret-Token header
router.post("/telegram", express.json(), (req, res) => {
  try{
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    const header = req.get("X-Telegram-Bot-Api-Secret-Token");
    if (secret && header !== secret) {
      console.log("WEBHOOK_SECRET_MISMATCH", { header, expected: !!secret });
      return res.status(401).send("Unauthorized");
    }
    // Attach resolved chat id if your helper exists
    let chatId;
    if (typeof logTelegramResolvedInfo === "function") {
      chatId = logTelegramResolvedInfo("INCOMING", req.body);
    } else if (req.body && req.body.message && req.body.message.chat) {
      chatId = req.body.message.chat.id;
      console.log("INCOMING TELEGRAM_RAW_UPDATE", JSON.stringify(req.body));
      console.log("INCOMING TELEGRAM_RESOLVED_CHAT_ID", chatId);
    } else {
      console.log("INCOMING TELEGRAM_RAW_UPDATE", JSON.stringify(req.body));
    }
    // enqueue job pattern your app expects — here we just acknowledge
    console.log("WEBHOOK_ACCEPTED", { chatId: chatId || null, hasBody: !!req.body });
    res.status(200).send("ok");
  }catch(e){
    console.log("WEBHOOK_HANDLER_ERROR", e && e.stack ? e.stack : String(e));
    res.status(500).send("error");
  }
});

module.exports = router;
