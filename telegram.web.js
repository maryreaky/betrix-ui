const express = require("express");
const bodyParser = require("body-parser");
const { createClient } = require("redis");

// Robust logger (timestamps)
function log(...args){ console.log(new Date().toISOString(), ...args); }

// Validate env quickly
const TOKEN = process.env.TELEGRAM_TOKEN || process.env.TELEGRAM_BOT_TOKEN || "";
log("ENV_SNAPSHOT", { NODE_ENV: process.env.NODE_ENV || null, TELEGRAM_TOKEN_present: !!process.env.TELEGRAM_TOKEN, TELEGRAM_BOT_TOKEN_present: !!process.env.TELEGRAM_BOT_TOKEN, REDIS_URL_present: !!process.env.REDIS_URL });

// Graceful global error handlers to capture crashes into logs
process.on("uncaughtException", (err) => { log("UNCAUGHT_EXCEPTION", err && err.stack || err); setTimeout(()=>process.exit(1),1000); });
process.on("unhandledRejection", (err) => { log("UNHANDLED_REJECTION", err && (err.stack || err)); });

function parseRedisOpts() {
  if (!process.env.REDIS_URL) return null;
  try {
    const url = new URL(process.env.REDIS_URL);
    return {
      socket: { host: url.hostname, port: Number(url.port || 6379), tls: url.protocol === "rediss:" },
      username: url.username || undefined,
      password: url.password ? url.password.replace(/^:/,'') : undefined
    };
  } catch (e) {
    log("REDIS_URL_PARSE_FAIL", e && e.message);
    return null;
  }
}

const redisOpts = parseRedisOpts();
let redis;
if (redisOpts) {
  redis = createClient(redisOpts);
  redis.on("error", e => log("REDIS_ERROR", e && e.message));
  redis.connect()
    .then(()=>log("REDIS_CONNECTED"))
    .catch(e => { log("REDIS_CONNECT_FAIL", e && e.message); /* do NOT exit immediately: keep web process live so health check can show degraded */ });
} else {
  log("REDIS_SKIPPED", "no REDIS_URL found");
}

// Express app
const app = express();
app.use(bodyParser.json({ limit: "256kb" }));

// Fast health endpoint (never blocks)
app.get("/health", (req,res) => {
  res.status(200).json({ ok: true, ts: new Date().toISOString() });
});

// Safe env endpoint
app.get("/env", (req,res) => {
  res.json({
    ok: true,
    env: {
      TELEGRAM_TOKEN: !!process.env.TELEGRAM_TOKEN,
      TELEGRAM_BOT_TOKEN: !!process.env.TELEGRAM_BOT_TOKEN,
      REDIS_URL: !!process.env.REDIS_URL
    },
    ts: new Date().toISOString()
  });
});

// Webhook handler — immediate ACK; enqueue if redis available
app.post("/telegram/:token", async (req,res) => {
  try {
    const incoming = req.params.token;
    const expected = TOKEN;
    if (!expected) {
      log("WEB_MISSING_TOKEN");
      res.status(500).json({ ok:false, error: "missing token" });
      return;
    }
    if (incoming !== expected) {
      res.status(403).json({ ok:false, error: "invalid token" });
      return;
    }

    // ACK immediately so Telegram doesn't retry
    res.json({ ok:true });

    // Enqueue non-blocking
    const job = { jobId: "wh-" + Date.now(), payload: req.body, ts: new Date().toISOString() };
    if (redis && redis.lPush) {
      try {
        await redis.lPush("betrix-jobs", JSON.stringify(job));
        log("ENQUEUED", job.jobId);
      } catch (e) {
        log("ENQUEUE_FAIL", e && e.message);
      }
    } else {
      log("ENQUEUE_SKIPPED", "redis not connected");
    }
  } catch (err) {
    log("WEB_HANDLER_ERROR", err && err.stack || err);
    try { res.status(500).json({ ok:false, error: "internal" }); } catch(e){}
  }
});

// Start server
const port = Number(process.env.PORT) || 3000;
app.listen(port, () => log("WEB_LISTENING", { port }));
