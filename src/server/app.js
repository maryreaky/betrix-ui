// src/server/app.js (minimal factory with guaranteed inline webhook POST)
// NOTE: this file is intentionally small and safe to ensure /admin/webhook/set exists.
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

  // INLINE: guaranteed POST /admin/webhook/set route (self-contained)
  app.post('/admin/webhook/set', async (req, res) => {
    try {
      const adminKey = String(req.get('x-admin-key') || '');
      if (!adminKey || adminKey !== String(process.env.ADMIN_KEY || '')) {
        return res.status(401).json({ ok: false, error: 'unauthorized' });
      }

      const https = require('https');
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const webhookUrl = process.env.WEBHOOK_URL || `${process.env.PROTOCOL || 'https'}://${process.env.HOST || process.env.RENDER_INTERNAL_HOSTNAME || '}/webhook/telegram`; 

      if (!botToken || !webhookUrl) {
        return res.status(200).json({ ok: true, status: 'noop', botTokenPresent: !!botToken, webhookUrlPresent: !!webhookUrl });
      }

      const payload = JSON.stringify({ url: webhookUrl });
      const options = {
        hostname: 'api.telegram.org',
        path: \/bot\/setWebhook\,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
        timeout: 15000
      };

      const reqp = https.request(options, (resp) => {
        let data = '';
        resp.on('data', (c) => data += c);
        resp.on('end', () => {
          try { return res.status(200).json(JSON.parse(data)); } catch(e) { return res.status(200).send(data); }
        });
      });
      reqp.on('error', (err) => res.status(500).json({ ok: false, error: String(err) }));
      reqp.write(payload);
      reqp.end();
    } catch (err) {
      return res.status(500).json({ ok: false, error: String(err) });
    }
  });

  // safe requires — fallbacks if missing
  let webhookRouter = null;
  let admin = null;
  let adminWebhook = null;
  try { webhookRouter = require('./routes/webhook'); } catch(e) { webhookRouter = null; }
  try { admin = require('./routes/admin'); } catch(e) { admin = null; }
  try { adminWebhook = require('./routes/admin-webhook'); } catch(e) { adminWebhook = null; }

  app.use('/admin', ensureRouter(adminWebhook, cfg));
  app.use('/admin', ensureRouter(admin, cfg));
  app.use('/webhook', ensureRouter(webhookRouter, cfg));

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
