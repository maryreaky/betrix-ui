/* BEGIN HOTFIX: env diagnostics, coercion, robust redis connect */
console.info('ENV_SNAPSHOT', {
  NODE_ENV: process.env.NODE_ENV || null,
  REDIS_URL: !!process.env.REDIS_URL,
  REDIS_HOST: process.env.REDIS_HOST || null,
  REDIS_PORT: process.env.REDIS_PORT || null,
  REDIS_USERNAME: !!process.env.REDIS_USERNAME,
  REDIS_PASSWORD: !!process.env.REDIS_PASSWORD,
  HEALTH_TIMEOUT: process.env.HEALTH_TIMEOUT || null,
  SERVER_TIMEOUT: process.env.SERVER_TIMEOUT || null,
  TELEGRAM_TOKEN: !!process.env.TELEGRAM_TOKEN
});

function coerceMs(val, fallback = 10000) {
  const n = Number(val);
  if (!Number.isFinite(n) || n <= 0) {
    console.warn('WARN_COERCE_TIMEOUT_INVALID', { raw: val, fallback });
    return fallback;
  }
  return n;
}
const HEALTH_TIMEOUT_MS = coerceMs(process.env.HEALTH_TIMEOUT, 10000);
const SERVER_TIMEOUT_MS = coerceMs(process.env.SERVER_TIMEOUT, 120000);

// Parse redis connection options from REDIS_URL or explicit envs
function parseRedisOptsFromEnv() {
  if (process.env.REDIS_URL) {
    try {
      const url = new URL(process.env.REDIS_URL);
      const opts = {
        socket: { host: url.hostname, port: Number(url.port) || 6379, tls: url.protocol === 'rediss:' }
      };
      if (url.username) opts.username = decodeURIComponent(url.username);
      if (url.password) opts.password = decodeURIComponent(url.password.replace(/^:/, ''));
      return opts;
    } catch (err) {
      console.warn('WARN_BAD_REDIS_URL', err && err.message);
    }
  }

  const opts = {
    socket: { host: process.env.REDIS_HOST || '127.0.0.1', port: Number(process.env.REDIS_PORT) || 6379, tls: (process.env.REDIS_TLS === 'true') }
  };
  if (process.env.REDIS_USERNAME) opts.username = process.env.REDIS_USERNAME;
  if (process.env.REDIS_PASSWORD) opts.password = process.env.REDIS_PASSWORD;
  return opts;
}

const redisOpts = parseRedisOptsFromEnv();
console.info('REDIS_OPTS', { host: redisOpts.socket.host, port: redisOpts.socket.port, tls: !!redisOpts.socket.tls, username: !!redisOpts.username, hasPassword: !!redisOpts.password });

// Use node-redis v4 createClient
let redisClient;
try {
  const { createClient } = require('redis');
  redisClient = createClient(redisOpts);
} catch (e) {
  console.error('ERR_REDIS_CLIENT_LOAD', e && e.message);
  throw e;
}

redisClient.on('error', (err) => {
  console.error('REDIS_ERROR', err && err.message);
});

(async () => {
  try {
    await redisClient.connect();
    console.info('REDIS_CONNECTED');
  } catch (err) {
    console.error('REDIS_CONNECT_FAILED', err && err.message);
    process.exit(1); // crash early so Render surfaces logs
  }

  // ensure server variable exists where you call setTimeout; apply numeric timeouts
  try {
    if (typeof server !== 'undefined' && server && typeof server.setTimeout === 'function') {
      server.setTimeout(SERVER_TIMEOUT_MS);
      console.info('INFO_TIMEOUT_APPLIED', { serverTimeout: SERVER_TIMEOUT_MS, healthTimeout: HEALTH_TIMEOUT_MS });
    } else {
      console.info('INFO_NO_SERVER_TIMEOUT_APPLIED', { serverPresent: typeof server !== 'undefined' });
    }
  } catch (err) {
    console.error('ERR_APPLY_TIMEOUT', err && err.message);
  }

  // Export or assign redisClient to existing code paths that expect it
  global.__REDIS_CLIENT = redisClient;
  // Continue with the rest of the worker bootstrap below this IIFE or call existing bootstrap
})().catch(err => {
  console.error('FATAL_BOOT_ERROR', err && err.message);
  process.exit(1);
});
/* END HOTFIX */
process.on("SIGTERM", () => {
  console.error(new Date().toISOString(), "WORKER_SIGTERM received - graceful shutdown start");
  try {
    if (typeof globalThis.shutdown === "function") {
      Promise.resolve(globalThis.shutdown()).catch(e => console.error("shutdown.error", e && e.stack || e));
    }
  } catch(e){ console.error("shutdown.try.error", e && e.stack || e); }
  setTimeout(()=>{ console.error(new Date().toISOString(), "WORKER_SIGTERM exiting"); process.exit(0); }, 3000);
});
process.on("SIGINT", () => {
  console.error(new Date().toISOString(), "WORKER_SIGINT received - exiting"); process.exit(0);
});
process.on("uncaughtException", (err) => {
  console.error(new Date().toISOString(), "WORKER_UNCAUGHT_EXCEPTION", err && err.stack || err);
});
process.on("unhandledRejection", (reason) => {
  console.error(new Date().toISOString(), "WORKER_UNHANDLED_REJECTION", reason && (reason.stack || reason));
});

// Friendly startup heartbeat for Render logs
console.error(new Date().toISOString(), "WORKER_STARTUP", { ts: new Date().toISOString() });
// START: startup server-detect probe (appended by diagnostic)
const _startup_probe = (async ()=>{
  try {
    const serverUrl = process.env.SERVER_URL || "https://betrix-ui.onrender.com/health";
    const healthTimeout = Number(process.env.HEALTH_TIMEOUT || 5000);
    console.error(new Date().toISOString(), "STARTUP_PROBE", { serverUrl, healthTimeout });
    // lightweight fetch with timeout
    const fetch = (...a) => import("node-fetch").then(m=>m.default(...a));
    const controller = new AbortController();
    const to = setTimeout(()=>controller.abort(), healthTimeout);
    try {
      const resp = await (await fetch(serverUrl, { signal: controller.signal, method: "GET" })).text();
      clearTimeout(to);
      console.error(new Date().toISOString(), "INFO_SERVER_DETECTED", { serverUrl });
      // expose a runtime flag other code can read
      globalThis.__SERVER_DETECTED = true;
    } catch(e) {
      clearTimeout(to);
      console.error(new Date().toISOString(), "STARTUP_PROBE_FAIL", e && (e.stack || e.message));
      globalThis.__SERVER_DETECTED = false;
    }
  } catch(e) {
    console.error(new Date().toISOString(), "STARTUP_PROBE_FATAL", e && (e.stack || e.message));
    globalThis.__SERVER_DETECTED = false;
  }
})();
 // END: startup server-detect probe
