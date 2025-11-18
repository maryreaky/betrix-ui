const express = require('express');
const bodyParser = require('body-parser');
const { createClient } = require('redis');

function parseRedisOpts() {
  if (!process.env.REDIS_URL) throw new Error('MISSING REDIS_URL');
  const url = new URL(process.env.REDIS_URL);
  return {
    socket: { host: url.hostname, port: Number(url.port || 6379), tls: url.protocol === 'rediss:' },
    username: url.username || undefined,
    password: url.password ? url.password.replace(/^:/,'') : undefined
  };
}

const redis = createClient(parseRedisOpts());
redis.on('error', e => console.error('REDIS_ERROR', e && e.message));
redis.connect()
  .then(() => console.log('REDIS_CONNECTED'))
  .catch(e => { console.error('REDIS_CONNECT_FAIL', e && e.message); process.exit(1); });

const app = express();
app.use(bodyParser.json({ limit: '256kb' }));

// Token snapshot (supports TELEGRAM_TOKEN or TELEGRAM_BOT_TOKEN)
const TOKEN = process.env.TELEGRAM_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '';
console.log('WEB_TOKEN_SNAPSHOT', { hasToken: !!TOKEN, tokenMasked: TOKEN ? ('***len:' + TOKEN.length) : false });

// Env check (masked booleans only)
app.get('/env', (req,res) => {
  res.json({
    ok: true,
    env: {
      TELEGRAM_TOKEN: !!process.env.TELEGRAM_TOKEN,
      TELEGRAM_BOT_TOKEN: !!process.env.TELEGRAM_BOT_TOKEN,
      REDIS_URL: !!process.env.REDIS_URL
    },
    ts: new Date().toISOString()
  });
});

// Webhook — immediate ACK, enqueue to Redis
app.post('/telegram/:token', async (req,res) => {
  const incoming = req.params.token;
  if (!TOKEN) { console.warn('WEB_NO_TELEGRAM_TOKEN'); res.status(500).json({ ok:false, error:'missing token' }); return; }
  if (incoming !== TOKEN) { res.status(403).json({ ok:false, error:'invalid token' }); return; }

  // Immediate 200 to satisfy Telegram
  res.json({ ok:true });

  const job = {
    jobId: 'wh-' + Date.now(),
    type: 'telegram_update',
    payload: req.body,
    receivedAt: new Date().toISOString()
  };
  try {
    await redis.lPush('betrix-jobs', JSON.stringify(job));
    console.log('ENQUEUED', job.jobId);
  } catch (e) {
    console.error('ENQUEUE_FAIL', e && e.message);
  }
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log('WEB LISTENING', { port }));
