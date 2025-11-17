const { getQueue, createWorker } = require('./src/server/queue');

console.log('[worker] booting');
const queue = getQueue('betrix-jobs');
createWorker('betrix-jobs', async (job) => {
  console.log('[worker] processing job', { id: job.id, name: job.name, data: job.data });
  return { ok: true, received: job.data };
});
