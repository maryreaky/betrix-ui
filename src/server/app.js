// Robust createServer factory for Express
const express = require('express');

function ensureRouter(factoryOrRouter, cfg){
  try {
    if (!factoryOrRouter) return (req,res,next)=> next();
    if (typeof factoryOrRouter === 'function') {
      // try factory(cfg)
      try { const maybe = factoryOrRouter(cfg); if (maybe && (typeof maybe === 'function' || maybe.stack)) return maybe; } catch(e){}
      // try no-arg factory
      try { const maybe2 = factoryOrRouter(); if (maybe2 && (typeof maybe2 === 'function' || maybe2.stack)) return maybe2; } catch(e){}
      // if the function itself is middleware/router, use it
      return factoryOrRouter;
    }
    // not a function/router: noop
    return (req,res,next)=> next();
  } catch(e){
    return (req,res,next)=> next();
  }
}

function createServer(cfg){
  const app = express();
// mount admin-webhook route\napp.use('/admin', adminWebhook);
  app.use(express.json({ limit: '64kb' }));

  // safe requires — may be missing during early patching; fallback to noop router
  let webhookRouter, adminRouter;
  try { webhookRouter = require('./routes/webhook'); } catch(e) { webhookRouter = null; }
  try { adminRouter = require('./routes/admin'); } catch(e) { adminRouter = null; }

  // mount primary admin if present (preserve existing admin variable if used elsewhere)
  try {
    const admin = require('./routes/admin');
    app.use('/admin', ensureRouter(admin, cfg));
  } catch(e) {
    // If admin route missing, skip
  }

  // mount admin-webhook route if created by patch scripts
  try {
    const adminWebhook = require('./routes/admin-webhook');
    app.use('/admin', ensureRouter(adminWebhook, cfg));
  } catch(e) {
    // skip if missing
  }

  // mount webhook route defensively
  try {
    app.use('/webhook', ensureRouter(webhookRouter, cfg));
  } catch(e) {
    // skip
  }

  // health and ready endpoints
  app.get('/health', (req, res) => res.status(200).json({ ok: true, ts: Date.now() }));
  app.get('/ready', (req, res) => {
    try {
      const useStub = String(process.env.USE_STUB_AI || '').toLowerCase() === 'true';
      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (!token && !useStub) return res.status(503).json({ ready: false, reason: 'missing TELEGRAM_BOT_TOKEN or USE_STUB_AI=true' });
      return res.status(200).json({ ready: true, webhook: process.env.WEBHOOK_URL || null });
    } catch (e) {
      return res.status(500).json({ ready: false, error: String(e && (e.message || e)) });
    }
  });

  return app;
}

module.exports = { createServer };

