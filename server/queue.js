/* src/server/queue.js - uses canonical redis factory */
const { connection, createQueue } = require('../../lib/redis');

let jobsQueue = null;
let connectionRef = connection;

if (!connectionRef) {
  console.warn('[queue] REDIS_URL missing or Upstash detected; using disabled queue stub for local/testing.');
  class DisabledQueue {
    constructor(name){ this.name = name; }
    add(...args){ console.warn('[queue] add called but queue is disabled', args); return Promise.resolve(null); }
    close(){ return Promise.resolve(); }
  }
  jobsQueue = new DisabledQueue('jobs');
  connectionRef = null;
} else {
  jobsQueue = createQueue('jobs');
}

module.exports = { jobsQueue, connection: connectionRef };
