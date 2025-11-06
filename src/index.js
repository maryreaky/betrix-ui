const express = require("express");
const app = express();
app.use(express.json());

app.use((req, res, next) => {
  console.log("REQ", req.method, req.originalUrl, {
    host: req.headers.host,
    "content-type": req.headers["content-type"],
    "content-length": req.headers["content-length"]
  });
  next();
});

const { handleTelegram } = require("./server/handlers/telegram");

app.post("/webhook/telegram", async (req, res) => {
  try {
    console.log("Webhook payload:", req.body);
    await handleTelegram(req.body || {}, { BOT_TOKEN: process.env.BOT_TOKEN });
    return res.json({ ok: true, ts: Date.now() });
  } catch (e) {
    console.error("Webhook error:", e);
    return res.status(500).json({ ok: false, error: String(e) });
  }
});

app.get("/admin/health", (req, res) => res.json({ ok: true, ts: Date.now() }));
app.get("/health", (req, res) => res.json({ ok: true, ts: Date.now() }));
app.use((req, res) => res.status(404).send("Not Found"));

const port = Number(process.env.PORT) || 10000;
app.listen(port, "0.0.0.0", () => console.log("BETRIX server listening", port));
module.exports = app;
