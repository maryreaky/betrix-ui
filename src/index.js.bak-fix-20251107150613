// Injected startup validations and global error handlers (hotfix)
const fs = require('fs');
const path = require('path');

function ensureEnv() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const webhook = process.env.WEBHOOK_URL || process.env.RENDER_EXTERNAL_URL && process.env.RENDER_EXTERNAL_URL + '/webhook/telegram' || null;
  const useStub = String(process.env.USE_STUB_AI || '').toLowerCase() === 'true';
  if (!token && !useStub) {
    console.error('STARTUP-FAIL: TELEGRAM_BOT_TOKEN is required unless USE_STUB_AI=true');
    process.exit(1);
  }
  if (!webhook && !useStub) {
    console.error('STARTUP-FAIL: WEBHOOK_URL (or RENDER_EXTERNAL_URL) required unless USE_STUB_AI=true');
    process.exit(1);
  }
  // expose for other modules
  process.env.WEBHOOK_URL = webhook || process.env.WEBHOOK_URL;
  console.info('STARTUP: env validated; useStub=' + useStub);
}

function installGlobalHandlers() {
  process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT-EXCEPTION', err && (err.stack || err.message || err));
  });
  process.on('unhandledRejection', (reason) => {
    console.error('UNHANDLED-REJECTION', reason && (reason.stack || reason.message || reason));
  });
  // optional: graceful shutdown on SIGTERM
  process.on('SIGTERM', () => {
    console.info('SIGTERM received, exiting gracefully');
    process.exit(0);
  });
}

ensureEnv();
installGlobalHandlers();

// Continue with original bootstrap if present
try {
  const main = require('./src/server/app') || require('./src/server') ;
  if (typeof main === 'function') {
    main();
  } else {
    // fall back to original index behavior
    require('./src/index-original') ;
  }
} catch (e) {
  // If original index.js layout is different, log and continue
  console.info('INDEX-BOOT: could not auto-defer to original entrypoint; continuing with existing index.js contents if any.');
}
