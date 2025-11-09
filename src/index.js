/*
 * src/index.js - Render-compatible entry patched for BETRIX features
 */
const express = require("express");
const app = express();
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
