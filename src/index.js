const express = require("express");
const app = express();
app.use(express.json());

// Import handler (must exist in src/server/handlers/telegram.js)
const { handleTelegram } = require("./server/handlers/telegram");

// POST webhook route (Telegram)
app.post("/webhook/telegram", async (req, res) => {
  try {
    await handleTelegram(req.body || {}, { BOT_TOKEN: process.env.BOT_TOKEN });
    return res.json({ ok: true, ts: Date.now() });
  } catch (e) {
    console.error("Webhook error:", e);
    return res.status(500).json({ ok: false, error: String(e) });
  }
});

// Provide GET for probes and HEAD for health probes
app.get("/webhook/telegram", (req, res) => res.json({ ok: true, probe: true, ts: Date.now() }));
app.get("/admin/health", (req, res) => res.json({ ok: true, ts: Date.now() }));
app.head("/admin/health", (req, res) => res.status(200).end());

const port = Number(process.env.PORT) || 10000;
app.listen(port, "0.0.0.0", () => console.log("BETRIX server listening", port));

console.log("Env check:", {
  hasBotToken: !!process.env.BOT_TOKEN,
  hasOpenAI: !!process.env.OPENAI_API_KEY
});

module.exports = app;


