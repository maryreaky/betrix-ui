const { createQueue, connection } = require('./src/server/queue');
const { Worker } = require('bullmq');

console.log('[worker] booting…');
const queue = createQueue('betrix-jobs');

const worker = new Worker('betrix-jobs', async (job) => {
  console.log('[worker] processing job', { id: job.id, name: job.name, data: job.data });
  // Simulate work
  return { ok: true, received: job.data };
}, { connection });

worker.on('completed', (job) => console.log('[worker] completed', job.id));
worker.on('failed', (job, err) => console.error('[worker] failed', job?.id, err));

process.on('SIGINT', async () => { console.log('[worker] shutting down'); await worker.close(); process.exit(0); });
