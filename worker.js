const { getQueue, createWorker } = require('./src/server/queue');
const https = require('https');

function notifyFailure(payload) {
  const webhook = process.env.SLACK_WEBHOOK;
  if (!webhook) return;
  try {
    const data = JSON.stringify({ text: '*Job failed*\\n' + JSON.stringify(payload) });
    const u = new URL(webhook);
    const opts = { hostname: u.hostname, path: u.pathname + u.search, method: 'POST', headers: { 'Content-Type':'application/json', 'Content-Length': Buffer.byteLength(data) } };
    const req = https.request(opts, (res) => { res.on('data', () => {}); });
    req.on('error', () => {});
    req.write(data); req.end();
  } catch (e) {}
}

console.log('[worker] booting');
const queue = getQueue('betrix-jobs');
createWorker('betrix-jobs', async (job) => {
  console.log('[worker] processing job', { id: job.id, name: job.name, data: job.data });
  return { ok: true, received: job.data };
});

const { Worker } = require('bullmq');
const w = new Worker('betrix-jobs', async () => {});
w.on('failed', (job, err) => {
  console.error('[worker] failed', job?.id, err?.message);
  notifyFailure({ id: job?.id, name: job?.name, data: job?.data, error: err?.message });
});
