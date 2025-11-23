
// mount Telegram webhook router (auto-inserted)
// Auto-generated wrapper to export createServer correctly for bootstrap
try {
  const mod = require('./app');
  if (mod && typeof mod.createServer === 'function') {
      try { mod.use(require('./telegram-shim')); console.log('MOUNTED: ./server/telegram-shim (index)'); } catch(e) { console.error('MOUNT_FAILED_SHIM_INDEX', e && e.stack ? e.stack : String(e)); }
module.exports = { createServer: mod.createServer };
  } else if (typeof mod === 'function') {
      try { mod.use(require('./telegram-shim')); console.log('MOUNTED: ./server/telegram-shim (index)'); } catch(e) { console.error('MOUNT_FAILED_SHIM_INDEX', e && e.stack ? e.stack : String(e)); }
module.exports = { createServer: mod };
  } else if (mod && (mod.default && typeof mod.default === 'function')) {
      try { mod.use(require('./telegram-shim')); console.log('MOUNTED: ./server/telegram-shim (index)'); } catch(e) { console.error('MOUNT_FAILED_SHIM_INDEX', e && e.stack ? e.stack : String(e)); }
module.exports = { createServer: mod.default };
  } else {
    // fallback: no createServer found; export the module as-is for debugging
      try { mod.use(require('./telegram-shim')); console.log('MOUNTED: ./server/telegram-shim (index)'); } catch(e) { console.error('MOUNT_FAILED_SHIM_INDEX', e && e.stack ? e.stack : String(e)); }
module.exports = mod || {};
    console.error('WRAPPER-WARN: no createServer found in ./app; exported module as-is');
  }
} catch (e) {
  console.error('WRAPPER-ERR', e && (e.stack || e.message || String(e)));
    try { mod.use(require('./telegram-shim')); console.log('MOUNTED: ./server/telegram-shim (index)'); } catch(e) { console.error('MOUNT_FAILED_SHIM_INDEX', e && e.stack ? e.stack : String(e)); }
module.exports = {};
}




/* START AUTO-INSERTED TELEGRAM MOUNT - idempotent */
try {
  const mod = require('./app');

  if (mod && typeof mod.createServer === 'function') {
    const origFactory = mod.createServer;
    mod.createServer = function() {
      const app = origFactory.apply(this, arguments);
      try {
        const tgRouter = require('./telegram-webhook');
        app.use('/telegram', tgRouter);
        app.use('/webhook/telegram', tgRouter);
      } catch (err) {
        console.error('MOUNT_TELEGRAM_WEBHOOK_ERR', err && err.stack ? err.stack : String(err));
      }
      return app;
    };
      try { mod.use(require('./telegram-shim')); console.log('MOUNTED: ./server/telegram-shim (index)'); } catch(e) { console.error('MOUNT_FAILED_SHIM_INDEX', e && e.stack ? e.stack : String(e)); }
module.exports = { createServer: mod.createServer };
  } else if (mod && typeof mod.use === 'function') {
    try {
      const tgRouter = require('./telegram-webhook');
      mod.use('/telegram', tgRouter);
      mod.use('/webhook/telegram', tgRouter);
    } catch (err) {
      console.error('MOUNT_TELEGRAM_WEBHOOK_ERR', err && err.stack ? err.stack : String(err));
    }
      try { mod.use(require('./telegram-shim')); console.log('MOUNTED: ./server/telegram-shim (index)'); } catch(e) { console.error('MOUNT_FAILED_SHIM_INDEX', e && e.stack ? e.stack : String(e)); }
module.exports = mod;
  } else {
      try { mod.use(require('./telegram-shim')); console.log('MOUNTED: ./server/telegram-shim (index)'); } catch(e) { console.error('MOUNT_FAILED_SHIM_INDEX', e && e.stack ? e.stack : String(e)); }
module.exports = mod || {};
    console.error('WRAPPER-WARN: no createServer or app instance found in ./app; exported module as-is');
  }
} catch (e) {
  console.error('WRAPPER-ERR', e && (e.stack || e.message || String(e)));
    try { mod.use(require('./telegram-shim')); console.log('MOUNTED: ./server/telegram-shim (index)'); } catch(e) { console.error('MOUNT_FAILED_SHIM_INDEX', e && e.stack ? e.stack : String(e)); }
module.exports = {};
}
/* END AUTO-INSERTED TELEGRAM MOUNT */

/* DEBUG HELPERS AND EXPLICIT TELEGRAM MOUNTS ADDED BY DEBUG PATCH */
try {
  // debug probe endpoints to confirm requests reach Express
  if (typeof app !== "undefined" && app && typeof app.get === "function") {
    app.get('/__health/debug', (req, res) => {
      console.log('DEBUG_HEALTH_GET', { ts: new Date().toISOString(), method: req.method, url: req.url, headers: Object.keys(req.headers).slice(0,20) });
      res.status(200).json({ ok: true, ts: new Date().toISOString() });
    });
    app.post('/__health/debug', express.json({ limit: '50kb' }), (req, res) => {
      console.log('DEBUG_HEALTH_POST', { ts: new Date().toISOString(), bodyPreview: JSON.stringify(req.body).slice(0,200), headers: Object.keys(req.headers).slice(0,20) });
      res.status(200).json({ ok: true, received: true });
    });
  }
} catch(e) { console.error('DEBUG_PATCH_ERR', e && (e.stack||e.message)); }

// Ensure explicit mounting of telegram shims/webhook at the known paths
try {
  // permissive shim at /webhook/telegram
  try { app.use('/webhook/telegram', require('./telegram-shim')); console.log('MOUNTED: /webhook/telegram -> ./server/telegram-shim'); } catch(e) { console.error('MOUNT_FAILED: /webhook/telegram', e && (e.stack||e.message)); }
  // canonical telegram webhook mounts
  try { app.use('/telegram', require('./telegram-webhook')); console.log('MOUNTED: /telegram -> ./server/telegram-webhook'); } catch(e) { console.error('MOUNT_FAILED: /telegram', e && (e.stack||e.message)); }
} catch(e) { console.error('MOUNT_PATCH_ERR', e && (e.stack||e.message)); }
