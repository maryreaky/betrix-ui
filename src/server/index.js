
// mount Telegram webhook router (auto-inserted)
// Auto-generated wrapper to export createServer correctly for bootstrap
try {
  const mod = require('./app');
  if (mod && typeof mod.createServer === 'function') {
    module.exports = { createServer: mod.createServer };
  } else if (typeof mod === 'function') {
    module.exports = { createServer: mod };
  } else if (mod && (mod.default && typeof mod.default === 'function')) {
    module.exports = { createServer: mod.default };
  } else {
    // fallback: no createServer found; export the module as-is for debugging
    module.exports = mod || {};
    console.error('WRAPPER-WARN: no createServer found in ./app; exported module as-is');
  }
} catch (e) {
  console.error('WRAPPER-ERR', e && (e.stack || e.message || String(e)));
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
    module.exports = { createServer: mod.createServer };
  } else if (mod && typeof mod.use === 'function') {
    try {
      const tgRouter = require('./telegram-webhook');
      mod.use('/telegram', tgRouter);
      mod.use('/webhook/telegram', tgRouter);
    } catch (err) {
      console.error('MOUNT_TELEGRAM_WEBHOOK_ERR', err && err.stack ? err.stack : String(err));
    }
    module.exports = mod;
  } else {
    module.exports = mod || {};
    console.error('WRAPPER-WARN: no createServer or app instance found in ./app; exported module as-is');
  }
} catch (e) {
  console.error('WRAPPER-ERR', e && (e.stack || e.message || String(e)));
  module.exports = {};
}
/* END AUTO-INSERTED TELEGRAM MOUNT */
