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
  // Load server factory from src/server/app (correct relative path) and start listening
  const serverModule = require('./server/app');
  if (serverModule && typeof serverModule.createServer === 'function') {
    const app = serverModule.createServer({});
    const port = process.env.PORT || 10000;
    if (app && typeof app.listen === 'function') {
      app.listen(port, () => console.info('SERVER: listening on port', port));
    } else if (app && app.callback && typeof app.callback === 'function') {
      app.callback().listen(port, () => console.info('SERVER(KOA): listening on port', port));
    } else {
      console.error('BOOT-FAIL: createServer returned non-listenable object');
      process.exit(1);
    }
  } else {
    console.error('BOOT-FAIL: src/server/app did not export createServer');
    process.exit(1);
  }
} catch (e) {
  console.error('INDEX-BOOT-ERROR', e && (e.stack || e.message || e));
  process.exit(1);
}

