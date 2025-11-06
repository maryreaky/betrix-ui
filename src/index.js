const express = require("express");
const app = express();
app.use(express.json());
const { handleTelegram } = require("./server/handlers/telegram");
app.post("/webhook/telegram", async (req, res) => {
  try {
    await handleTelegram(req.body, { BOT_TOKEN: process.env.BOT_TOKEN });
    res.json({ ok: true, ts: Date.now() });
  } catch (e) {
    console.error("Webhook error:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});
app.get("/admin/health", (req, res) => {
  res.json({ ok: true, ts: Date.now() });
});
const port = process.env.PORT || 3000;
app.listen(port, () => console.log("BETRIX server listening", port));
console.log("Env check:", {
  hasBotToken: !!process.env.BOT_TOKEN,
  hasOpenAI: !!process.env.OPENAI_API_KEY
});
# Added: accept GET for webhook probes and HEAD for health probes
app.get("/webhook/telegram", (req, res) => res.json({ ok: true, probe: true, ts: Date.now() }));
app.head("/admin/health", (req, res) => res.status(200).end());
module.exports = app;

