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
try { if ((job.chatId == null) && (job.data || job.payload || job.payloads || job)) { job.chatId = Number(job.chatId ?? job.data?.chatId ?? job.data?.payload?.message?.chat?.id ?? job.data?.payload?.update?.message?.chat?.id ?? job.data?.payload?.message?.chat?.id ?? job.data?.payload?.chat?.id ?? job.payload?.message?.chat?.id ?? job.payload?.chat?.id ?? job.payload?.update?.message?.chat?.id) || undefined; } } catch(e) {}
