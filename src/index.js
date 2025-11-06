const express = require("express");
const app = express();
app.use(express.json());

// Log every request
app.use((req, res, next) => {
  console.log("REQ", req.method, req.originalUrl, { host: req.headers.host, "content-type": req.headers["content-type"], "content-length": req.headers["content-length"] });
  next();
});

// Import your Telegram handler
const { handleTelegram } = require("./server/handlers/telegram");

// Telegram webhook route
app.post("/webhook/telegram", async (req, res) => {
  try {
    await handleTelegram(req.body || {}, { BOT_TOKEN: process.env.BOT_TOKEN });
    return res.json({ ok: true, ts: Date.now() });
  } catch (e) {
    console.error("Webhook error:", e);
    return res.status(500).json({ ok: false, error: String(e) });
  }
});

// Health endpoints
app.get("/admin/health", (req, res) => res.json({ ok: true, ts: Date.now() }));
app.head("/admin/health", (req, res) => res.status(200).end());
app.get("/health", (req, res) => res.json({ ok: true, ts: Date.now(), alt: true }));

// Fallback
app.use((req, res) => {
  console.log("404", req.method, req.originalUrl);
  res.status(404).send("Not Found");
});

const port = Number(process.env.PORT) || 10000;
app.listen(port, "0.0.0.0", () => console.log("BETRIX server listening", port));

console.log("Env check:", {
  hasBotToken: !!process.env.BOT_TOKEN,
  hasOpenAI: !!process.env.OPENAI_API_KEY
});

module.exports = app;
