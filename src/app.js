/* AUTO-GENERATED src/app.js — mounts ./server/telegram router */
const express = require('express');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// mount existing telegram router (safe require)

/* tolerant webhook: accept either path-secret or header-secret */
try {
  // middleware accepts either the TELEGRAM_WEBHOOK_SECRET as a path segment or X-Telegram-Bot-Api-Secret-Token header
  app.use('/telegram', express.json({ limit: '128kb' }), (req, res, next) => {
    try {
      const expected = process.env.TELEGRAM_WEBHOOK_SECRET || '';
      const header = req.get('X-Telegram-Bot-Api-Secret-Token');
      // allow if no expected secret configured, or header matches, or path ends with the secret
      if (!expected || header === expected || req.path.endsWith('/' + expected)) return next();
    } catch(e) { /* ignore and fallthrough */ }
    return res.status(403).json({ ok:false, error:'invalid token' });
  });
  // mount the actual telegram handler after the tolerant middleware
  try { app.use('/telegram', require('./server/telegram-webhook')); console.log('MOUNTED: /telegram -> ./server/telegram-webhook'); } catch(e) { console.error('MOUNT_FAILED_TELEGRAM_HANDLER', e && e.stack ? e.stack : String(e)); }
} catch(e) {
  console.error('TOLERANT_MIDDLEWARE_INSERT_FAIL', e && e.stack ? e.stack : String(e));
}
  try { app.use(require('./server/telegram-shim')); console.log('MOUNTED: ./server/telegram-shim'); } catch(e) { console.error('MOUNT_FAILED_SHIM', e && e.stack ? e.stack : String(e)); }

