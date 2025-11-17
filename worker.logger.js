/**
 * Production worker with structured logging and resilience.
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

// Ensure producer defaults exist by instantiating Queue with defaultJobOptions.
// This does not consume jobs; it sets defaults for any adds from this process if used.
const q = new Queue(cfg.queueName, { connection: cfg.connection, defaultJobOptions: cfg.defaultJobOptions });

const events = new QueueEvents(cfg.queueName, { connection: cfg.connection });
events.on("completed", ({ jobId }) => log("info", "job completed (event)", { jobId }));
events.on("failed", ({ jobId, failedReason }) => log("error", "job failed (event)", { jobId, failedReason }));
events.on("stalled", ({ jobId }) => log("warn", "job stalled (event)", { jobId }));

log("info", "worker booting", { queue: cfg.queueName, connection: cfg.connection });

const worker = new Worker(
  cfg.queueName,
  async (job) => {
    const start = Date.now();
    log("info", "job started", { id: job.id, name: job.name, attemptsMade: job.attemptsMade });
    // Your actual job handler goes here:
    // Example no-op handler to simulate work:
    // await someWork(job.data);
    // For now, just echo payload:
    const result = { ok: true, echo: job.data };
    const dur = Date.now() - start;
    log("info", "job completed", { id: job.id, durationMs: dur });
    return result;
  },
  {
    connection: cfg.connection,
    concurrency: cfg.concurrency,
    // Automatic retries are driven by job.attempts/defaultJobOptions; no worker-level attempts setting.
    // Enable lockRenewTime if you process long tasks; defaults are fine for now.
  }
);

worker.on("failed", (job, err) => {
  log("error", "job failed", {
    id: job?.id, name: job?.name, attemptsMade: job?.attemptsMade, err: String(err?.message || err)
  });
});
worker.on("error", (err) => log("error", "worker error", { err: String(err.message || err) }));
worker.on("active", (job) => log("info", "job active", { id: job.id, name: job.name }));
worker.on("completed", (job) => log("info", "job completed (worker)", { id: job.id, name: job.name }));

process.on("uncaughtException", (err) => log("fatal", "uncaughtException", { err: String(err.stack || err) }));
process.on("unhandledRejection", (err) => log("fatal", "unhandledRejection", { err: String(err) }));
