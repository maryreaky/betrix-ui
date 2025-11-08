const express = require('express');
const https = require('https');
const app = express();
app.use(express.json({ limit: '64kb' }));

app.post('/admin/webhook/set', async (req, res) => {
  try {
    const adminKey = String(req.headers['x-admin-key'] || '');
    if (!adminKey || adminKey !== String(process.env.ADMIN_KEY || '')) {
      return res.status(401).json({ ok: false, error: 'unauthorized' });
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN || false;
    const webhookUrl = process.env.WEBHOOK_URL || `${process.env.PROTOCOL || 'https'}://${process.env.HOST || process.env.RENDER_INTERNAL_HOSTNAME || ''}/webhook/telegram`;

    if (!botToken || !webhookUrl) {
      return res.status(200).json({ ok: true, status: 'no-bot' });
    }

    const payload = JSON.stringify({ url: webhookUrl });
    const options = {
      hostname: 'api.telegram.org',
      path: `/bot${botToken}/setWebhook`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000
    };

    const q = https.request(options);
    q.on('error', () => res.status(200));
    q.write(payload);
    q.end();
    return;
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error) });
  }
});

app.get('/health', (req, res) => res.status(200));
app.listen(10000, () => console.log('SERVER: listening on port 10000'));
