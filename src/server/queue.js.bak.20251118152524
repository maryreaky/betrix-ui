const Redis = require("ioredis");
const { Queue } = require("bullmq");

if (!process.env.REDIS_URL) {
  console.error("[queue] ERROR: REDIS_URL is not set. Aborting.");
  throw new Error("Missing REDIS_URL");
}

const connection = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
console.log('[queue] using REDIS_URL', process.env.REDIS_URL.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:****@'));

function createQueue(name = "betrix-jobs") {
  console.log("[queue] creating Queue with explicit connection:", name);
  return new Queue(name, { connection });
}

module.exports = { connection, createQueue };
