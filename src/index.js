/*
 * src/index.js - Render-compatible entry patched for BETRIX features
 */
const express = require("express");
const app = express();
// mount dedupe middleware (auto-inserted)
try { const dedupeMod = require('./server/middleware/dedupe');
app.use(dedupeMod(60));
if (typeof dedupeMod.init === 'function') dedupeMod.init().catch(err => console.warn('[dedupe] init error', err && err.message)); console.warn('[dedupe] middleware mounted (attempting Redis connect)'); } catch(e){ console.warn('[dedupe] mount failed:', e && e.message ? e.message : e); }
app.use(express.json({ limit: "200kb" }));

// structured logger and metrics
const logger = require("./lib/logger");
app.get("/metrics", logger.metricsHandler);

// attempt to mount dedupe middleware if available
try {
  const dedupe = require("./server/middleware/dedupe");
  app.use(dedupe(60));
} catch (e) { console.warn("dedupe not mounted", e && e.message) }

// mount commands router
try {
  const cmdRouter = require("./server/commands");
  cmdRouter(app);
} catch (e) { console.warn("commands router not mounted", e && e.message) }

// health
app.get("/health", (_req, res) => res.status(200).send("OK"));

// export for Render wrapper
const port = process.env.PORT ? Number(process.env.PORT) : 10000;
if (require.main === module) {
  app.listen(port, () => console.log(`SERVER: listening on port ${port}`));
} else {
  module.exports = { app, listen: (p = port) => app.listen(p, () => console.log(`SERVER: listening on port ${p}`)) };
}

/* Redis health endpoint (temporary client, safe to call) */
app.get("/redis-health", async (req, res) => {
  const url = process.env.REDIS_URL;
  if (!url) return res.status(503).send("REDIS_NOT_CONFIGURED");
  try {
    const { createClient } = require("redis");
    const c = createClient({ url });
    c.on("error", () => {}); // swallow client-level errors briefly
    await c.connect();
    const pong = await c.ping();
    await c.disconnect();
    if (pong && String(pong).toUpperCase().includes("PONG")) return res.status(200).send("OK");
  } catch (e) {
    console.error("[redis-health]", e && e.message ? e.message : e);
  }
  return res.status(503).send("REDIS_UNAVAILABLE");
});

