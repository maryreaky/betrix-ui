/**
 * worker.logger.js
 * Worker with safe telegram-outbound fallback and numeric env coercion for health server
 */
const { Worker, QueueEvents, Queue } = require("bullmq");
const os = require("os");
const fetch = global.fetch || require("node-fetch");
const cfg = require("./queue.config");

const service = process.env.RENDER_SERVICE_ID || "render-worker";
const host = os.hostname();

function log(level, msg, extra = {}) {
  const base = { ts: new Date().toISOString(), level, service, host };
  console.log(JSON.stringify({ ...base, msg, ...extra }));
}

log("info","worker booting",{queue: cfg.queueName, connection: cfg.safeLogConnection(cfg.connection)});

// healthbeat
setInterval(()=>log("info","healthbeat",{queue:cfg.queueName}),30000);

// instantiate queue to ensure defaults
const q = new Queue(cfg.queueName, { connection: cfg.connection, defaultJobOptions: cfg.defaultJobOptions });

const events = new QueueEvents(cfg.queueName, { connection: cfg.connection });
events.on("completed", ({ jobId }) => log("info","job completed (event)",{ jobId }));
events.on("failed", ({ jobId, failedReason }) => log("error","job failed (event)",{ jobId, failedReason }));
events.on("stalled", ({ jobId }) => log("warn","job stalled (event)",{ jobId }));

/* --- telegram send helper discovery and fallback --- */
const tryRequire = (p) => { try { return require(p); } catch(e){ return null } };
const telegramCandidates = [
  tryRequire("./src/server/telegramSendV2"),
  tryRequire("./src/server/telegramSendV2.js"),
  tryRequire("./src/server/utils/telegramSend"),
  tryRequire("./src/server/utils/telegramSend.js"),
  tryRequire("./src/server/telegramSend"),
  tryRequire("./src/server/telegramSend.js")
];
let telegramSend = null;
for (const mod of telegramCandidates) {
  if (!mod) continue;
  if (typeof mod.send === "function") { telegramSend = mod.send; break; }
  if (typeof mod === "function") { telegramSend = mod; break; }
  if (mod.default && typeof mod.default === "function") { telegramSend = mod.default; break; }
}
if (!telegramSend) {
  log("warn","telegramSend: no candidate send function found; will use direct Telegram API fallback for outgoing messages");
}

/* direct fallback sender: accepts either an update object or { chat_id, text } */
async function directTelegramSend(payload){
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) throw new Error("TELEGRAM_BOT_TOKEN missing in env");
    let body = {};
    if (payload && payload.message && payload.message.chat && payload.message.text) {
      body = { chat_id: payload.message.chat.id, text: payload.message.text };
    } else if (payload && payload.chat_id && payload.text) {
      body = { chat_id: payload.chat_id, text: payload.text };
    } else {
      // best-effort: stringify payload
      body = { chat_id: (payload && payload.chat_id) || (payload && payload.message && payload.message.chat && payload.message.chat.id), text: JSON.stringify(payload).slice(0,4000) };
    }
    if (!body.chat_id) throw new Error("cannot determine chat_id from payload");
    const res = await fetch("https://api.telegram.org/bot" + token + "/sendMessage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json();
    if (!json || !json.ok) throw new Error("telegram API error: " + (JSON.stringify(json) || res.status));
    return json;
  } catch(e) {
    throw e;
  }
}

/* handler used by the Worker for jobs */
async function handleJob(job){
  const start = Date.now();
  log("info","job started",{ id: job.id, name: job.name, attemptsMade: job.attemptsMade });
  try {
    if (job.name === "telegram-outbound") {
      const payload = job.data;
      if (telegramSend) {
        await telegramSend(payload);
        log("info","telegram-outbound sent (helper)",{ id: job.id });
      } else {
        await directTelegramSend(payload);
        log("info","telegram-outbound sent (direct)",{ id: job.id });
      }
      log("info","job completed",{ id: job.id, durationMs: Date.now()-start });
      return { ok: true, sent: true };
    }
    if (job.name === "telegram-update") {
      // default behavior: if a worker-level send helper exists, call it with the update (common pattern)
      const payload = job.data && (job.data.update || job.data);
      if (!payload) { log("warn","telegram-update missing payload",{ id: job.id }); return { ok: false }; }
      // If a domain-specific handler exists in codebase, prefer it
      if (telegramSend) {
        await telegramSend(payload);
        log("info","telegram-update sent (helper)",{ id: job.id });
      } else {
        // fallback: send an ack or echo to user so we can validate deploy quickly
        const echo = { chat_id: (payload.message && payload.message.chat && payload.message.chat.id) || payload.chat_id, text: (payload.message && payload.message.text) ? ("Echo: " + payload.message.text) : "Auto-reply: update received" };
        await directTelegramSend(echo);
        log("info","telegram-update sent (direct-echo)",{ id: job.id });
      }
      log("info","job completed",{ id: job.id, durationMs: Date.now()-start });
      return { ok: true, sent: true };
    }
    // default fallback for unknown jobs: echo data
    log("info","job completed",{ id: job.id, durationMs: Date.now()-start });
    return { ok: true, echo: job.data };
  } catch(err) {
    log("error","job failed (handler)",{ id: job.id, err: String(err && err.message || err) });
    throw err;
  }
}

/* start worker */
const worker = new Worker(
  cfg.queueName,
  handleJob,
  {
    connection: cfg.connection,
    concurrency: cfg.concurrency
  }
);

worker.on("failed", (job, err) => log("error","job failed",{ id: job?.id, name: job?.name, attemptsMade: job?.attemptsMade, err: String(err?.message || err) }));
worker.on("error", (err) => log("error","worker error",{ err: String(err.message || err) }));
worker.on("active", (job) => log("info","job active",{ id: job.id, name: job.name }));
worker.on("completed", (job) => log("info","job completed (worker)",{ id: job.id, name: job.name }));

process.on("uncaughtException", (err) => log("fatal","uncaughtException",{ err: String(err.stack || err) }));
process.on("unhandledRejection", (err) => log("fatal","unhandledRejection",{ err: String(err) }));

/* RENDER_HEALTH_SERVER_V1 - coerce numeric envs to numbers to avoid type errors */
try{
  const http = require('http');
  const port = Number(process.env.PORT) || 3000;
  // optional server timeout env (in ms) — coerce safely
  const serverTimeout = process.env.SERVER_TIMEOUT ? Number(process.env.SERVER_TIMEOUT) : undefined;
  const server = http.createServer((req,res)=>{
    if(req.url === '/health'){ res.writeHead(200); res.end('ok'); return; }
    res.writeHead(200); res.end('worker');
  }).listen(port,()=>{ console.log('health server listening on', port); });
  if (serverTimeout && !Number.isNaN(serverTimeout)) {
    try { server.setTimeout(Number(serverTimeout)); }
    catch(e){ console.error("WEBHOOK-BOOT-ERROR setting server timeout", String(e && e.message || e)); }
  }
}catch(e){ console.error('health-server-error', e && e.message); }

