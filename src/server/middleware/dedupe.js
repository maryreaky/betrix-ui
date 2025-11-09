/*
 * src/server/middleware/dedupe.js
 * Redis-backed idempotency guard for incoming updates
 * Requires REDIS_URL environment variable (redis://...)
 */
const { createClient } = require("redis");
const redisUrl = process.env.REDIS_URL || null;
let client;
if (redisUrl) {
  client = createClient({ url: redisUrl });
  client.connect().catch(err => console.error("REDIS-CONNECT-ERR", err && err.message));
} else {
  console.warn("DEDPUPE-MW: REDIS_URL not set; dedupe disabled");
}

module.exports = function dedupeMiddleware(ttlSeconds = 60) {
  return async (req, res, next) => {
    const updateId = req.body?.update_id;
    if (!updateId || !client) return next();
    try {
      const key = `upd:${updateId}`;
      const added = await client.set(key, "1", { NX: true, EX: ttlSeconds });
      if (added) return next();
      // duplicate - ack and do nothing
      console.log("DEDUPED update_id", updateId);
      return res.status(200).send("OK");
    } catch (err) {
      console.error("DEDPUPE-ERR", err && err.message);
      return next();
    }
  };
};
