/* src/lib/redis.js - canonical Redis factory for BETRIX */
const IORedis = require('ioredis');
const { Queue } = require('bullmq');

const redisUrl = process.env.REDIS_URL || process.env.REDIS_URI || process.env.REDIS || '';
const isUpstash = typeof redisUrl === 'string' && (redisUrl.includes('upstash') || (redisUrl.startsWith('rediss://') && redisUrl.includes('upstash')));
const isProduction = (process.env.NODE_ENV === 'production');

let connection = null;

function createDisabledQueue(name) {
  class DisabledQueue {
    constructor(n){ this.name = n; }
    add(...args){ console.warn('[queue] add called but queue is disabled', args); return Promise.resolve(null); }
    close(){ return Promise.resolve(); }
  }
  return new DisabledQueue(name);
}

if (!redisUrl) {
  if (isProduction) {
    throw new Error('REDIS_URL is required in production for BullMQ. Set REDIS_URL in Render environment.');
  }
  console.warn('[redis] REDIS_URL missing; creating disabled queue/connection for local/dev');
  connection = null;
} else if (isUpstash) {
  if (isProduction) {
    if(!/still-oarfish-19117\.upstash\.io/.test(process.env.REDIS_URL||'')) { throw new Error('Upstash detected in production. Use a BullMQ-compatible Redis provider and set REDIS_URL accordingly.'); } else { console.warn('Upstash host allowed (temporary): still-oarfish-19117.upstash.io'); }
  }
  console.warn('[redis] Upstash detected; using disabled queue stub for local/dev');
  connection = null;
} else {
  connection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false
  });
  connection.on('error', (err) => {
    console.error('[redis] connection error', err && err.message || err);
  });
  connection.on('connect', () => {
    console.info('[redis] connected to', redisUrl);
  });
}

function createQueue(name, opts = {}) {
  if (!connection) return createDisabledQueue(name);
  return new Queue(name, Object.assign({}, opts, { connection }));
}

module.exports = { connection, createQueue };


