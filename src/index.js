const express = require("express");
const app = express();
app.use(express.json());

// Minimal guaranteed routes
app.get("/admin/health", (req, res) => {
  console.log("MINIMAL: HEALTH", req.method, req.originalUrl || req.url);
  return res.json({ ok: true, ts: Date.now(), envPort: process.env.PORT || null });
});

app.post("/webhook/telegram", (req, res) => {
  console.log("MINIMAL: WEBHOOK", req.method, req.originalUrl || req.url, "body:", JSON.stringify(req.body || {}));
  return res.json({ ok: true, received: true, ts: Date.now() });
});

// Fallback 404 handler for visibility
app.use((req, res) => {
  console.log("MINIMAL: FALLBACK 404", req.method, req.originalUrl || req.url);
  res.status(404).send("Not Found");
});

const port = Number(process.env.PORT) || 10000;
app.listen(port, "0.0.0.0", () => console.log("MINIMAL server listening", port));
module.exports = app;
