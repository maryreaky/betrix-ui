const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const app = express();
app.use(bodyParser.json());

function safeEqual(a, b) {
  try {
    if (!a || !b) return false;
    const ab = Buffer.from(String(a));
    const bb = Buffer.from(String(b));
    if (ab.length !== bb.length) return false;
    return crypto.timingSafeEqual(ab, bb);
  } catch (e) {
    return false;
  }
}

function mask(s) {
  if (!s) return '<unset>';
  const str = String(s);
  if (str.length <= 12) return str;
  return str.slice(0,6) + '...' + str.slice(-6);
}

const expectedSecret = (process.env.WEBHOOK_SECRET || '').trim();

app.post('/telegram/webhook', (req, res) => {
  // Accept header or query param as temporary fallback
  const header = (req.headers['x-telegram-bot-api-secret-token'] || '').trim();
  const q = (req.query && req.query.secret) ? String(req.query.secret).trim() : '';
  const incoming = header || q;

  // Log masked values for verification (non-sensitive)
  console.log('DEBUG: header_seen:', header ? '[present]' : '[missing]', 'query_secret:', q ? '[present]' : '[missing]');
  console.log('DEBUG: process.env.WEBHOOK_SECRET masked:', mask(expectedSecret));

  if (!safeEqual(incoming, expectedSecret)) {
    console.warn('❌ Invalid secret. header_present:', !!header, 'query_present:', !!q);
    return res.status(401).send('invalid secret');
  }

  const update = req.body;
  console.log('✅ Received Telegram update:', JSON.stringify(update, null, 2));
  res.send('OK');
});

// small health and debug routes
app.get('/_health', (req, res) => res.send('ok'));
app.get('/_debug/webhook-check', (req, res) => {
  const header = (req.headers['x-telegram-bot-api-secret-token'] || '').trim();
  const env = (process.env.WEBHOOK_SECRET || '').trim();
  const masked = mask(env);
  res.json({ header_seen: header || null, webhook_secret_masked: masked });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log('Server listening on port ' + PORT);
});
