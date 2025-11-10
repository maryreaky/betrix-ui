const express = require("express");
const app = express();

// Use explicit numeric port only from env
console.info("RENDER_ENV_PORT_RAW:", process.env.PORT); console.info("RENDER_ENV_KEYS:", Object.keys(process.env).sort().join(",")); const PORT = parseInt(process.env.PORT, 10) || 10000;

// global middleware
app.use(express.json({ limit: "128kb" }));
app.use((req, res, next) => {
  try { console.info("INCOMING", req.method, req.url); } catch(e) {}
  next();
});

// health
app.get("/health", (req, res) => res.json({ ok: true, ts: Date.now() }));
app.get("/", (req, res) => res.json({ ok: true, ts: Date.now(), app: "BETRIX" }));

// Mount webhook router safely (factory pattern)
try {
  const webhookRouterFactory = require("./server/routes/webhook");
  const webhookRouter = typeof webhookRouterFactory === "function" ? webhookRouterFactory({}) : webhookRouterFactory;
  app.use("/webhook", webhookRouter);
  console.info("Mounted /webhook");
} catch (e) {
  console.error("Failed to mount /webhook", e && e.message ? e.message : e);
}

// Mount webhook-AI router
try {
  const webhookAiRouter = require("./server/routes/webhook-ai");
  app.use("/webhook-ai", webhookAiRouter);
  console.info("Mounted /webhook-ai");
} catch (e) {
  console.error("Failed to mount /webhook-ai", e && e.message ? e.message : e);
}

// Fallback error handler
app.use((err, req, res, next) => {
  console.error("Express error:", err && err.stack ? err.stack : err);
  res.status(500).json({ ok: false, error: err && err.message ? err.message : "Internal error" });
});

// Global process handlers
process.on("unhandledRejection", (err) => console.error("UnhandledRejection", err && err.stack ? err.stack : err));
process.on("uncaughtException", (err) => console.error("UncaughtException", err && err.stack ? err.stack : err));

// Export app for tests
module.exports = app;

// Only start server when explicitly executed (avoid double listeners)
if (require.main === module) {
  console.info("ENV PORT:", process.env.PORT, "computed PORT:", typeof PORT !== "undefined" ? PORT : "(undefined)"); app.listen(PORT, "0.0.0.0", () => { console.info("BETRIX server listening on", PORT); });
}


//
// Auto-inserted by one-shot shim: mount rateLimiter and admin route
const { rateLimiter, adminHandler } = require('./server/utils/openai');
const { sendText } = require('./server/utils/telegramSend');

// If you have a webhook route, ensure rateLimiter is applied when posting to /webhook/telegram
// Example: app.post('/webhook/telegram', rateLimiter, telegramHandler);
try {
  if (typeof app === 'object' && app.post) {
    if (!app._router || !app._router.stack || !app._router.stack.some(s => s.route && s.route.path === '/admin/ai-status')) {
      app.get('/admin/ai-status', adminHandler);
    }
  }
} catch(e) { /* non-fatal */ }




