const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const fs = require('fs');

const app = express();
app.use(bodyParser.json());

// safe compare
function safeEqual(a, b) {
  try {
    if (!a || !b) return false;
    const A = Buffer.from(String(a));
    const B = Buffer.from(String(b));
    if (A.length !== B.length) return false;
    return crypto.timingSafeEqual(A, B);
  } catch (e) {
    return false;
  }
}

const WEBHOOK_SECRET = (process.env.WEBHOOK_SECRET || '').trim();

// Webhook route (explicit, deterministic)
app.post('/telegram/webhook', (req, res) => {
  const header = (req.headers['x-telegram-bot-api-secret-token'] || '').trim();
  const qsecret = (req.query && req.query.secret) ? String(req.query.secret).trim() : '';
  const incoming = header || qsecret;
  if (!safeEqual(incoming, WEBHOOK_SECRET)) {
    console.warn('Webhook secret mismatch or missing header');
    return res.status(401).send('invalid secret');
  }
  console.log('Received Telegram update');
  // minimal ack
  return res.status(200).send('ok');
});

// Deterministic health and root endpoints
app.get('/_health', (req, res) => res.status(200).send('ok'));
app.get('/', (req, res) => res.status(200).send('ok'));

// Serve static UI from dist after API routes
const staticDir = path.join(__dirname, 'dist');
if (fs.existsSync(staticDir)) {
  app.use(express.static(staticDir, { index: false }));
  app.get('*', (req, res, next) => {
    const accept = req.headers.accept || '';
    if (accept.includes('text/html')) {
      const index = path.join(staticDir, 'index.html');
      if (fs.existsSync(index)) return res.sendFile(index);
    }
    next();
  });
}

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log('Server listening on port ' + PORT);
  console.log('WEBHOOK_SECRET set:', Boolean(process.env.WEBHOOK_SECRET));
});
