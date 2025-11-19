/**
 * worker.logger.js — safe wrapper for worker process
 * - NEVER loads server app code (no require('./app'))
 * - imports the actual worker implementation (worker.js or src/worker.js)
 * - prints an ENV snapshot and guarded startup logs
 */

(function() {
  try {
    const envSnapshot = {
      NODE_ENV: process.env.NODE_ENV,
      REDIS_URL: !!process.env.REDIS_URL,
      TELEGRAM_TOKEN: !!process.env.TELEGRAM_TOKEN,
      SERVER_URL: process.env.SERVER_URL || null
    };
    console.log("ENV_SNAPSHOT", envSnapshot);
    console.log("WORKER_STARTING", { ts: new Date().toISOString() });

    // Prefer src/worker.js then worker.js at repo root
    let workerModule = null;
    try {
      workerModule = require('./src/worker.js');
    } catch (e) {
      try { workerModule = require('./worker.js'); } catch (e2) { /* ignore */ }
    }

    if (workerModule && typeof workerModule.start === 'function') {
      workerModule.start();
      console.log("WORKER_STARTUP", { ts: new Date().toISOString() });
    } else if (workerModule && typeof workerModule === 'function') {
      // fallback if worker.js exports a function (legacy)
      workerModule();
      console.log("WORKER_STARTUP_FN", { ts: new Date().toISOString() });
    } else {
      // If the real worker code uses top-level execution, require it for side-effects
      if (workerModule) {
        console.log("WORKER_MODULE_LOADED_SIDE_EFFECTS");
      } else {
        // Try requiring worker.js directly as a last resort (still safe — no server requires)
        try {
          require('./worker.js');
          console.log("WORKER_LOADED_FALLBACK", { ts: new Date().toISOString() });
        } catch (err) {
          console.error("WRAPPER_ERR_NO_WORKER", err && (err.stack || err.message || String(err)));
          // keep process alive for inspection; exit only if explicitly needed
        }
      }
    }

  } catch (err) {
    console.error("WRAPPER_FATAL", err && (err.stack || err.message || String(err)));
  }

  // keep process open in Render logs for human inspection
  process.on('unhandledRejection', r => { console.error('UNHANDLED REJECTION:', r && (r.stack || r)); });
  process.on('uncaughtException', e => { console.error('UNCAUGHT EXCEPTION:', e && (e.stack || e)); });

  // graceful shutdown logs
  process.on('SIGTERM', () => {
    console.log('WORKER_SIGTERM received - graceful shutdown start');
    setTimeout(() => {
      console.log('WORKER_SIGTERM exiting');
      process.exit(0);
    }, 2000);
  });
})();
