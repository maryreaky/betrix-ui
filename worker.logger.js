const { createClient: createRedisClient } = require("redis");
async function checkExposure(redisUrl, marketId, additionalLiability=0) {
  try {
    const r = createRedisClient({ url: redisUrl });
    await r.connect();
    const key = `exposure:market:${marketId}`;
    const curr = Number(await r.get(key) || 0);
    const limit = Number(process.env.EXPOSURE_LIMIT_PER_MARKET || 1000000);
    await r.quit();
    return { ok: (curr + additionalLiability) <= limit, curr, limit };
  } catch(e){ console.error('EXPOSURE_CHECK_ERR', e && (e.message||e.stack)); return { ok:true, curr:0, limit: Number(process.env.EXPOSURE_LIMIT_PER_MARKET || 1000000) }; }
}
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
// START: enforce serverPresent from __SERVER_DETECTED (appended by diagnostic)
try {
  const detected = !!globalThis.__SERVER_DETECTED;
  if (detected) {
    console.error(new Date().toISOString(), "FORCE_SERVER_PRESENT enabled from probe");
    // ensure any existing code that reads process.env or internal flags can see this
    process.env.__SERVER_PRESENT = "true";
    globalThis.__SERVER_PRESENT = true;
  } else {
    console.error(new Date().toISOString(), "FORCE_SERVER_PRESENT not set (probe false)");
  }
} catch (e) {
  console.error(new Date().toISOString(), "FORCE_SERVER_PRESENT_ERROR", e && (e.stack || e.message));
}
// END: enforce serverPresent
// START: wait-for-startup-probe and enforce serverPresent (diagnostic fix)
(async function __wait_for_probe_and_force(){
  try {
    const maxWait = Number(process.env.STARTUP_PROBE_WAIT_MS || 5000);
    const pollInterval = 100;
    const start = Date.now();
    console.error(new Date().toISOString(), "WAIT_PROBE_START", { maxWait });
    while (typeof globalThis.__SERVER_DETECTED === "undefined" && (Date.now() - start) < maxWait) {
      await new Promise(r => setTimeout(r, pollInterval));
    }
    const detected = !!globalThis.__SERVER_DETECTED;
    if (detected) {
      console.error(new Date().toISOString(), "WAIT_PROBE_DETECTED", { elapsed: Date.now() - start });
      process.env.__SERVER_PRESENT = "true";
      globalThis.__SERVER_PRESENT = true;
      console.error(new Date().toISOString(), "FORCE_SERVER_PRESENT enabled from probe");
    } else {
      console.error(new Date().toISOString(), "WAIT_PROBE_TIMEOUT_OR_FALSE", { elapsed: Date.now() - start, detected: !!globalThis.__SERVER_DETECTED });
    }
  } catch(e){
    console.error(new Date().toISOString(), "WAIT_PROBE_ERROR", e && (e.stack||e.message));
  }
})();
 // END: wait-for-startup-probe and enforce serverPresent
// START: fallback unconditional BRPOP consumer appended to ensure jobs are processed
(async function fallbackConsumer(){
  try {
    console.error(new Date().toISOString(), "CONSUMER_START", { queue: "betrix-jobs" });
    const { createClient } = require("redis");
    const fetch = (...a) => import("node-fetch").then(m => m.default(...a));
    const REDIS_URL = process.env.REDIS_URL;
    const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || process.env.TOKEN;
    if (!REDIS_URL) { console.error(new Date().toISOString(), "CONSUMER_ERR_NO_REDIS_URL"); return; }
    if (!TELEGRAM_TOKEN) { console.error(new Date().toISOString(), "CONSUMER_WARN_NO_TELEGRAM_TOKEN"); }
    const r = createClient({ url: REDIS_URL });
    r.on("error", e => console.error(new Date().toISOString(), "CONSUMER_REDIS_ERROR", e && (e.stack||e.message)));
    await r.connect();
    while(true){
      try {
        const res = await r.brPop("betrix-jobs", 5); // 5s block
        if(!res){ continue; }
        console.error(new Date().toISOString(), "BRPOP", JSON.stringify(res).substring(0,1000));
        const raw = res.element || (Array.isArray(res) ? res[1] : null) || res;
        let job;
        try { job = JSON.parse(raw); } catch(e){ console.error(new Date().toISOString(), "JOB_PARSE_ERROR", e && e.message); continue; }
        console.error(new Date().toISOString(), "JOB_FORWARD", { jobId: job.jobId, type: job.type });
        // derive chat id and text conservatively
        const chatId = job.payload?.message?.chat?.id || job.payload?.chat_id || job.payload?.to || null;
        const text = job.payload?.text || job.payload?.message?.text || ("[betrix] forwarded job " + (job.jobId||"[unknown]"));
        if(!chatId || !TELEGRAM_TOKEN){
          console.error(new Date().toISOString(), "SKIP_SEND_MISSING", { chatId: !!chatId, hasToken: !!TELEGRAM_TOKEN });
          continue;
        }
        try {
          const resp = (async () => {
  try {
    const handler = require('./src/commands/menu-handler.js').handleCommand.handleCommand;
    const result = await (async ()=>{ try { if(typeof handler !== 'function'){ console.error(new Date().toISOString(), 'HANDLER_TYPE_ERROR', { type: typeof handler }); return { ok:false, error:'handler_not_function' }; } return await handler(process.env, job); } catch(e){ console.error(new Date().toISOString(), 'HANDLER_CALL_EXCEPTION', e && (e.stack||e.message)); return { ok:false, error: e && e.message }; } })();
    if (result && result.ok) {
      console.error(new Date().toISOString(), "HANDLER_OK", { jobId: job.jobId, chatId: result.chatId });
    } else {
      console.error(new Date().toISOString(), "HANDLER_FAIL", { jobId: job.jobId, err: result && result.error });
    }
  } catch (e) {
    console.error(new Date().toISOString(), "HANDLER_EXCEPTION", e && (e.stack || e.message));
  }
})();} catch(sendErr){
          console.error(new Date().toISOString(), "SEND_ERROR", sendErr && (sendErr.stack||sendErr.message));
        }
      } catch(loopErr){
        console.error(new Date().toISOString(), "CONSUMER_LOOP_ERROR", loopErr && (loopErr.stack||loopErr.message));
        await new Promise(r=>setTimeout(r,2000));
      }
    }
  } catch(e){
    console.error(new Date().toISOString(), "CONSUMER_FATAL", e && (e.stack||e.message));
  }
})();
 // END: fallback unconditional BRPOP consumer



