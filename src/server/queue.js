const { Queue } = require('bullmq');
const Redis = require('ioredis');

const connection = new Redis(process.env.REDIS_URL);

function createQueue(name = 'betrix-jobs') {
  console.log('[queue] initializing BullMQ queue:', name);
  return new Queue(name, { connection });
}

module.exports = { createQueue, connection };
