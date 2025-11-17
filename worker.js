const { createQueue, connection } = require("./src/server/queue");
const { Worker, QueueScheduler, QueueEvents } = require("bullmq");

console.log("[worker] booting");

// Ensure scheduler and events are created with explicit connection
const scheduler = new QueueScheduler("betrix-jobs", { connection });
const events = new QueueEvents("betrix-jobs", { connection });

const queue = createQueue("betrix-jobs");

const worker = new Worker("betrix-jobs", async (job) => {
  console.log("[worker] processing job", { id: job.id, name: job.name, data: job.data });
  // Job logic here
  return { ok: true, received: job.data };
}, { connection });

// keep logging for lifecycle
worker.on("completed", (job) => console.log("[worker] completed", job.id));
worker.on("failed", (job, err) => console.error("[worker] failed", job?.id, err?.message));
events.on("error", (err) => console.error("[queue-events] error", err));
scheduler.on("error", (err) => console.error("[queue-scheduler] error", err));
