
// Diagnostic: safe parse guard for webhook payloads
function safeJson(req) { try { return req.body } catch(e) { try { return JSON.parse(req.rawBody || req.bodyRaw || '{}') } catch(_) { console.error('WEBHOOK_RAW_PAYLOAD', req.rawBody || req.bodyRaw || req.body); return null } } }
const express = require('express');
const router = express.Router();
const { handleTelegram } = require('../handlers/telegram');
module.exports = (cfg) => {
  router.post('/telegram', async (req, res) => { console.info("WEBHOOK RAW BODY:", JSON.stringify(req.body).slice(0,1000));
    try {
      res.status(200).send('ok'); // ack quickly
      await handleTelegram(req.body, cfg);
    } catch (e) {
      // keep ack done; log error
      console.error('webhook top error', e && e.stack ? e.stack : e);
    }
  });
    // ? Test route
  router.post('/test-webhook', (req, res) => {
    console.log('?? WEBHOOK HIT test-webhook');
    res.json({ ok: true, received: true });
  });
return router;
};




