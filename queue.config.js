/**
 * queue.config.js (patched)
 * Read REDIS_URL from env; enable TLS automatically if REDIS_URL scheme is rediss or REDIS_TLS_FORCE=1
 */
const { URL } = require("url");
const REDIS_URL = process.env.REDIS_URL || "redis://default:REDACTED@redis-14261.c282.east-us-mz.azure.cloud.redislabs.com:14261";
const u = new URL(REDIS_URL);

function safeConnection() {
  const useTls = u.protocol === "rediss:" || process.env.REDIS_TLS_FORCE === "1";
  return {
    host: u.hostname,
    port: Number(u.port || 6379),
    password: u.password,
    tls: useTls ? {} : undefined
  };
}

function safeLogConnection(conn) {
  return { host: conn.host, port: conn.port, password: "***REDACTED***", tls: conn.tls ? true : false };
}

module.exports = {
  queueName: process.env.BETRIX_QUEUE_NAME || "betrix-jobs",
  connection: safeConnection(),
  safeLogConnection,
  defaultJobOptions: {
    attempts: Number(process.env.JOB_ATTEMPTS || 3),
    backoff: { type: "exponential", delay: Number(process.env.JOB_BACKOFF_DELAY || 2000) },
    removeOnComplete: true,
    removeOnFail: false
  },
  concurrency: Number(process.env.WORKER_CONCURRENCY || 5)
};
