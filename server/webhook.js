/* server/webhook.js
   Minimal Express webhook server for BETRIX
   - GET /health -> 200
   - POST /telegram/webhook -> validates secret and returns 200 fast
   - Logs incoming update.id for debugging
*/
const express = require('express');
const bodyParser = require('body-parser');

const PORT = process.env.PORT ? Number(process.env.PORT) : 10000;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || null;

const app = express();
app.use(bodyParser.json({ limit: '1mb' }));

app.get('/health', (req, res) => {
  res.status(200).send('ok');
});

app.post('/telegram/webhook', (req, res) => {
  try {
    if (WEBHOOK_SECRET) {
      const incoming = (req.header('x-telegram-bot-api-secret-token') || '').toString();
      if (!incoming || incoming !== WEBHOOK_SECRET) {
        console.warn('Webhook secret mismatch or missing header');
        return res.status(401).send('invalid secret');
      }
    }

    const update = req.body;
    if (!update || typeof update !== 'object') {
      console.warn('Webhook received invalid body');
      return res.status(400).send('bad request');
    }

    const updateId = update.update_id !== undefined ? update.update_id : '(no id)';
    console.log(`[webhook] recv update_id=${updateId} time=${new Date().toISOString()}`);

    // Acknowledge fast
    res.status(200).send('ok');

    // Asynchronous processing
    setImmediate(() => {
      try {
        if (update.message && update.message.text) {
          console.log(`[webhook] msg from=${update.message.from?.id || 'unknown'} text="${String(update.message.text).slice(0,120)}"`);
        }
      } catch (err) {
        console.error('[webhook] async handler error', err);
      }
    });
  } catch (err) {
    console.error('[webhook] error processing request', err);
    try { res.status(500).send('internal error'); } catch (e) {}
  }
});

app.use((req, res) => {
  res.status(404).send('Not Found');
});

app.listen(PORT, () => {
  console.log(`HTTP health server listening on port ${PORT}`);
  console.log(`WEBHOOK_SECRET ${WEBHOOK_SECRET ? 'configured' : 'not configured'}`);
});
