/**
 * worker.logger.js - robust loader for background worker
 * - Attempts candidate paths and logs resolve/require failures with stack
 * - Exits nonzero if no worker module loads so deploy logs surface the root cause
 */
(async function(){
  try {
    const candidates = ['src/worker.js','worker.impl.js','worker.js'];
    console.info("WRAPPER_START", { ts: new Date().toISOString(), candidates });

    let loaded = false;
    for (const candidate of candidates) {
      try {
        let resolved;
        try {
          resolved = require.resolve('./' + candidate);
          console.info('WRAPPER_RESOLVE_OK', { candidate, resolved });
        } catch (resErr) {
          console.warn('WRAPPER_RESOLVE_FAIL', { candidate, err: (resErr && (resErr.message || String(resErr))) });
          continue;
        }

        try {
          const mod = require('./' + candidate);
          console.info('WRAPPER_REQUIRE_OK', { candidate });
          if (mod && typeof mod.start === 'function') {
            mod.start();
            console.info('WORKER_STARTED', { via: candidate });
            loaded = true;
            break;
          } else if (typeof mod === 'function') {
            mod();
            console.info('WORKER_STARTED_FN', { via: candidate });
            loaded = true;
            break;
          } else {
            console.info('WORKER_MODULE_LOADED_SIDE_EFFECTS', { via: candidate });
            loaded = true;
            break;
          }
        } catch (requireErr) {
          console.error('WRAPPER_REQUIRE_THROW', { candidate, err: (requireErr && (requireErr.stack || requireErr.message || String(requireErr))) });
        }
      } catch (e) {
        console.error('WRAPPER_LOOP_ERR', e && (e.stack || e.message || String(e)));
      }
    }

    if (!loaded) {
      console.error('WRAPPER_ERR_NO_WORKER_MODULE', { candidates });
      // exit non-zero so Render surfaces failure and logs remain visible
      process.exit(2);
    }
  } catch (e) {
    console.error('WRAPPER_FATAL', e && (e.stack || e.message || String(e)));
    process.exit(3);
  }
})();
