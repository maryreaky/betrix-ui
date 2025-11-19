/**
 * worker.js — safe worker loader
 * - Delegates to src/worker.js or legacy worker implementation
 * - Does not require server app code
 * - Prints ENV snapshot and clear startup logs
 */

(function () {
  try {
    const envSnapshot = {
      NODE_ENV: process.env.NODE_ENV,
      REDIS_URL: !!process.env.REDIS_URL,
      TELEGRAM_TOKEN: !!process.env.TELEGRAM_TOKEN,
      SERVER_URL: process.env.SERVER_URL || null
    };
    console.log("ENV_SNAPSHOT", envSnapshot);
    console.log("WORKER_STARTING", { ts: new Date().toISOString() });

    // Prefer src/worker.js then legacy worker.js entrypoints
    let loaded = false;
    try {
      const mod = require('./src/worker.js');
      if (mod && typeof mod.start === 'function') {
        mod.start();
        console.log("WORKER_STARTUP", { ts: new Date().toISOString(), via: "src/worker.start" });
        loaded = true;
      } else if (typeof mod === 'function') {
        mod();
        console.log("WORKER_STARTUP", { ts: new Date().toISOString(), via: "src/worker.fn" });
        loaded = true;
      } else if (mod) {
        console.log("WORKER_MODULE_LOADED_SIDE_EFFECTS", { ts: new Date().toISOString() });
        loaded = true;
      }
    } catch (e) {
      // ignore, will try fallback
    }

    if (!loaded) {
      try {
        require('./worker.impl.js'); // optional local impl
        console.log("WORKER_LOADED_FALLBACK_IMPL", { ts: new Date().toISOString() });
        loaded = true;
      } catch (e) {
        // ignore
      }
    }

    if (!loaded) {
      console.error("WRAPPER_ERR_NO_WORKER_MODULE", "Could not load src/worker.js or fallback worker.impl.js");
    }

  } catch (err) {
    console.error("WRAPPER_FATAL", err && (err.stack || err.message || String(err)));
  }

  process.on('unhandledRejection', r => { console.error('UNHANDLED REJECTION:', r && (r.stack || r)); });
  process.on('uncaughtException', e => { console.error('UNCAUGHT EXCEPTION:', e && (e.stack || e)); });

  process.on('SIGTERM', () => {
    console.log('WORKER_SIGTERM received - graceful shutdown start');
    setTimeout(() => {
      console.log('WORKER_SIGTERM exiting');
      process.exit(0);
    }, 2000);
  });
})();
