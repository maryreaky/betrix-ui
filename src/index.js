const express = require("express");
const app = express();
const PORT = process.env.PORT || (process.env.PORT || 10000);

app.use(express.json()); // ? Global JSON parser

// ? Log every request
app.use((req, res, next) => {
  console.log("?? Incoming:", req.method, req.url);
  next();
});

// ? Health check
app.get("/health", (req, res) => res.json({ ok: true, ts: Date.now() }));

// ? Root probe
app.get("/__probe", (req, res) => res.json({ ok: true, probe: "root", ts: Date.now() }));

// ? Mount webhook router (factory export)
try {
  const webhookRouterFactory = require("./server/routes/webhook");
  const webhookRouter = webhookRouterFactory({});
  app.use("/webhook", webhookRouter);
  console.log("? Mounted /webhook");
} catch (e) {
  console.error("? Failed to mount /webhook", e.message);
}

// ? Mount webhook-AI router (direct export)
try {
  const webhookAiRouter = require("./server/routes/webhook-ai");
  app.use("/webhook-ai", webhookAiRouter);
  console.log("? Mounted /webhook-ai");
} catch (e) {
  console.error("? Failed to mount /webhook-ai", e.message);
}

// ? Fallback error handler
app.use((err, req, res, next) => {
  console.error("? Express error:", err);
  res.status(500).json({ ok: false, error: err.message || "Internal error" });
});

app.listen(PORT, () => {
  console.log("? BETRIX server listening on", PORT);
});

