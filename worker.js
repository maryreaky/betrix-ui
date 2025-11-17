const { createQueue, connection } = require("./src/server/queue");
const bullmq = require("bullmq");

const Worker = bullmq.Worker;
const QueueScheduler = bullmq.QueueScheduler;
const QueueEvents = bullmq.QueueEvents;

console.log("[worker] booting");

// Create scheduler and events only if the installed bullmq exports them
let scheduler, events;
try {
  if (typeof QueueScheduler === "function") {
    scheduler = new QueueScheduler("betrix-jobs", { connection });
    console.log("[queue-scheduler] started");
  } else {
    console.warn("[queue-scheduler] not available in installed bullmq; skipping");
  }
} catch (err) {
  console.error("[queue-scheduler] failed to start", err?.message || err);
}

try {
  if (typeof QueueEvents === "function") {
    events = new QueueEvents("betrix-jobs", { connection });
    console.log("[queue-events] started");
  } else {
    console.warn("[queue-events] not available in installed bullmq; skipping");
  }
} catch (err) {
  console.error("[queue-events] failed to start", err?.message || err);
}

const queue = createQueue("betrix-jobs");

const worker = new Worker("betrix-jobs", async (job) => {
  console.log("[worker] processing job", { id: job.id, name: job.name, data: job.data });
  // place job logic here
  return { ok: true, received: job.data };
}, { connection });

worker.on("completed", (job) => console.log("[worker] completed", job.id));
worker.on("failed", (job, err) => console.error("[worker] failed", job?.id, err?.message));

if (events) events.on("error", (err) => console.error("[queue-events] error", err));
if (scheduler) scheduler.on("error", (err) => console.error("[queue-scheduler] error", err));
