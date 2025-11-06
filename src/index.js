const express = require("express");
const app = express();
app.use(express.json());

// Log every request
app.use((req, res, next) => {
  console.log("REQ", req.method, req.originalUrl, { host: req.headers.host, "content-type": req.headers["content-type"], "content-length": req.headers["content-length"] });
  next();
});

// Accept all health variants
app.all("/admin/health", (req, res) => res.json({ ok: true, ts: Date.now(), path: req.path }));
app.all("/health", (req, res) => res.json({ ok: true, ts: Date.now(), path: req.path }));

// Accept webhook POST
app.post("/webhook/telegram", (req, res) => {
  console.log("WEBHOOK", req.body);
  res.json({ ok: true, received: true, ts: Date.now() });
});

// Fallback
app.use((req, res) => {
  console.log("404", req.method, req.originalUrl);
  res.status(404).send("Not Found");
});

const port = Number(process.env.PORT) || 10000;
app.listen(port, "0.0.0.0", () => console.log("HARDENED server listening", port));
module.exports = app;
