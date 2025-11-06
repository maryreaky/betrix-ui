const express = require("express");
const axios = require("axios");
const router = express.Router();
console.log("✅ Webhook-AI router loaded");

router.post("/ai-reply", async (req, res) => {
  console.log("🔔 WEBHOOK HIT ai-reply");
  res.json({ ok: true, reply: "Hello from BETRIX AI" });
});

module.exports = router;
