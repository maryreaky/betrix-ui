const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const app = express();

app.use(bodyParser.json());

// safe timing-attack resistant compare
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

const expectedSecret = (process.env.WEBHOOK_SECRET || '').trim();

// Webhook route
app.post('/telegram/webhook', (req, res) => {
  const header = (req.headers['x-telegram-bot-api-secret-token'] || '').trim();
  const q = (req.query && req.query.secret) ? String(req.query.secret).trim() : '';
  const incoming = header || q;
  if (!safeEqual(incoming, expectedSecret)) {
    console.warn('Webhook secret mismatch or missing header');
    return res.status(401).send('invalid secret');
  }
  console.log('Received Telegram update');
  // TODO: replace with your real update processing
  res.send('OK');
});

// Deterministic health and root for probes
app.get('/_health', (req, res) => res.send('ok'));
app.get('/', (req, res) => res.send('ok'));

// Serve UI static files from dist if present, but AFTER API routes above
const staticDir = path.join(__dirname, 'dist');
const fs = require('fs');
if (fs.existsSync(staticDir)) {
  app.use(express.static(staticDir, { index: false }));
  // Fallback to index.html for client-side routing
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
  console.log('WEBHOOK_SECRET configured:', Boolean(process.env.WEBHOOK_SECRET));
});
