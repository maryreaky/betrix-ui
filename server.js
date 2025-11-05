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

const expectedSecret = (process.env.WEBHOOK_SECRET || '').trim();

app.post('/telegram/webhook', (req, res) => {
  const header = (req.headers['x-telegram-bot-api-secret-token'] || '').trim();
  const q = (req.query && req.query.secret) ? String(req.query.secret).trim() : '';
  const incoming = header || q;

  if (!safeEqual(incoming, expectedSecret)) {
    return res.status(401).send('invalid secret');
  }

  const update = req.body;
  // Replace the line below with your existing update processing logic if needed
  console.log('Received Telegram update');
  res.send('OK');
});

app.get('/_health', (req, res) => res.send('ok'));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log('Server listening on port ' + PORT);
});

// ensure root responds for external probes
app.get('/', (req,res) => res.send('ok'))

