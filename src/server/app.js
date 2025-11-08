// Robust createServer factory for Express
const express = require('express');

function ensureRouter(factoryOrRouter, cfg){
  try {
    if (!factoryOrRouter) return (req,res,next)=> next();
    if (typeof factoryOrRouter === 'function') {
      try { const maybe = factoryOrRouter(cfg); if (maybe && (typeof maybe === 'function' || maybe.stack)) return maybe; } catch(e){}
      try { const maybe2 = factoryOrRouter(); if (maybe2 && (typeof maybe2 === 'function' || maybe2.stack)) return maybe2; } catch(e){}
      return factoryOrRouter;
    }
    return (req,res,next)=> next();
  } catch(e){
    return (req,res,next)=> next();
  }
}

function createServer(cfg){
  const app = express();
  app.use(express.json({ limit: '64kb' }));

  // safe requires — may be missing during early patching; fallback to noop router
  let webhookRouter = null;
  let admin = null;
  let adminWebhook = null;
  try { webhookRouter = require('./routes/webhook'); } catch(e) { webhookRouter = null; }
  try { admin = require('./routes/admin'); } catch(e) { admin = null; }
  try { adminWebhook = require('./routes/admin-webhook'); } catch(e) { adminWebhook = null; }

  // mount admin-webhook before admin to avoid main admin swallowing subroutes
  app.use('/admin', ensureRouter(adminWebhook, cfg));
  app.use('/admin', ensureRouter(admin, cfg));

  // mount webhook route defensively
  app.use('/webhook', ensureRouter(webhookRouter, cfg));

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
