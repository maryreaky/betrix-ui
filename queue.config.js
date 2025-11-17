/**
 * Queue defaults and connection config
 * Enforces retry attempts and exponential backoff for all jobs.
 */
const { URL } = require('url');

const REDIS_URL = process.env.REDIS_URL || "redis://default:k5hVSqo106q0tTX9wbulgJPK4SiRc9UR@redis-14261.c282.east-us-mz.azure.cloud.redislabs.com:14261";
const u = new URL(REDIS_URL);

module.exports = {
  queueName: process.env.BETRIX_QUEUE_NAME || "betrix-jobs",
  connection: {
    host: u.hostname,
    port: Number(u.port || 6379),
    password: u.password,
    tls: undefined // set to {} if your plan requires TLS
  },
  defaultJobOptions: {
    attempts: Number(process.env.JOB_ATTEMPTS || 3),
    backoff: { type: "exponential", delay: Number(process.env.JOB_BACKOFF_DELAY || 2000) },
    removeOnComplete: true,
    removeOnFail: false
  },
  concurrency: Number(process.env.WORKER_CONCURRENCY || 5)
};
