const Redis = require('ioredis');
const { Queue, Worker } = require('bullmq');

let connection;
let queue;

function getConnection() {
  if (!connection) {
    connection = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
    console.log('[queue] redis connection initialized');
  }
  return connection;
}

function getQueue(name = 'betrix-jobs') {
  if (!queue) {
    queue = new Queue(name, { connection: getConnection() });
    console.log('[queue] BullMQ queue initialized:', name);
  }
  return queue;
}

function createWorker(name = 'betrix-jobs', processor = async (job) => ({ ok: true, data: job.data })) {
  const worker = new Worker(name, processor, { connection: getConnection() });
  worker.on('completed', (job) => console.log('[worker] completed', job.id));
  worker.on('failed', (job, err) => console.error('[worker] failed', job?.id, err));
  return worker;
}

module.exports = { getConnection, getQueue, createWorker };
