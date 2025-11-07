// src/server/routes/webhook-ai.js - cost-free stub responder
const express = require("express");
const router = express.Router();
const { isStub } = require("../lib/ai-config");
router.post("/ai-reply", express.json({ limit: "64kb" }), async (req, res) => {
  try {
    const body = req.body || {};
    const text = (body.message && body.message.text) || body.text || "";
    const reply = simpleReply(text);
    return res.json({ ok: true, reply, ts: Date.now() });
  } catch (err) {
    console.error("AI fallback error", err && err.stack ? err.stack : err);
    return res.status(500).json({ ok: false, error: "ai-fallback-error" });
  }
});
function simpleReply(text) {
  if (!text) return "I didn't get that. Ask me about fixtures, odds, or say hello.";
  const t = text.toLowerCase();
  if (/\b(hello|hi|hey)\b/.test(t)) return "Hello! This is BETRIX AI (stub). How can I help you with sports today?";
  if (/\b(odds|fixture|match|score|next match)\b/.test(t)) return "Stubbed matches: Team A vs Team B; Team C vs Team D. Ask 'subscribe' to get updates.";
  if (/\b(recommend|tip|prediction)\b/.test(t)) return "Tip (stub): check recent form and head-to-head. Always gamble responsibly.";
  return `You said: "${text}". I am running in stub mode.`;
}
module.exports = router;
