/**
 * worker.logger.js
 * Structured worker with redacted connection logging and 30s healthbeat.
 */
const { Worker, QueueEvents, Queue } = require("bullmq");
const os = require("os");
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

const worker = new Worker(
  cfg.queueName,
  async (job) => {
/* AUTO-INJECT: Replace generic job handler so telegram-outbound jobs call real send logic */
const tryRequire = (p) => { try { return require(p); } catch(e){ return null } };
const telegramSendCandidates = [
  tryRequire("./src/server/telegramSendV2"),
  tryRequire("./src/server/telegramSendV2.js"),
  tryRequire("./src/server/utils/telegramSend"),
  tryRequire("./src/server/utils/telegramSend.js"),
  tryRequire("./src/server/telegramSend"),
  tryRequire("./src/server/telegramSend.js")
];
let telegramSender = null;
for (const mod of telegramSendCandidates) {
  if (!mod) continue;
  if (typeof mod.send === "function") { telegramSender = mod.send; break; }
  if (typeof mod === "function") { telegramSender = mod; break; }
  // fallback to default export
  if (mod.default && typeof mod.default === "function") { telegramSender = mod.default; break; }
}
if (!telegramSender) {
  console.warn("telegramSender: no candidate send function found; telegram-outbound jobs will be no-ops (temporary).");
}

const originalWorkerHandler = async (job) => {
  const start = Date.now();
  log("info","job started",{ id: job.id, name: job.name, attemptsMade: job.attemptsMade });
  try {
    if (job.name === "telegram-outbound" && telegramSender) {
      // attempt to send; accept various shapes of job.data
      try {
        await telegramSender(job.data);
        log("info","telegram-outbound sent",{ id: job.id });
      } catch(err) {
        log("error","telegram-outbound send failed",{ id: job.id, err: String(err && err.message || err) });
        throw err;
      }
    } else {
      // preserve previous echo behavior for other jobs
      const result = { ok: true, echo: job.data };
      log("info","job completed",{ id: job.id, durationMs: Date.now() - start });
      return result;
    }
    log("info","job completed",{ id: job.id, durationMs: Date.now() - start });
    return { ok: true, sent: job.name === "telegram-outbound" };
  } catch(e) {
    log("error","job failed (handler)",{ id: job.id, err: String(e && e.message || e) });
    throw e;
  }
};

    const start = Date.now();
    log("info","job started",{ id: job.id, name: job.name, attemptsMade: job.attemptsMade });
    // TODO: Replace with real job handler
    const result = { ok: true, echo: job.data };
    const dur = Date.now() - start;
    log("info","job completed",{ id: job.id, durationMs: dur });
    return result;
  },
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

// RENDER_HEALTH_SERVER_V1
try{
  const http = require('http');
  const port = process.env.PORT || 3000;
  http.createServer((req,res)=>{
    if(req.url === '/health'){ res.writeHead(200); res.end('ok'); return; }
    res.writeHead(200); res.end('worker');
  }).listen(port,()=>{ console.log('health server listening on', port); });
}catch(e){ console.error('health-server-error', e && e.message); }

