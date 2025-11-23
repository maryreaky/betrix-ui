const express = require('express');
const router = express.Router();
const bodyParser = express.json({ limit: "100kb" });

async function getRedisClient() {
  const Redis = require('redis');
  const opts = process.env.REDIS_URL ? { url: process.env.REDIS_URL } : { socket: { host: process.env.REDIS_HOST || '127.0.0.1', port: Number(process.env.REDIS_PORT || 6379) } };
  const client = Redis.createClient(opts);
  try { await client.connect(); } catch(e) {}
  return client;
}

router.post(['/telegram','/webhook/telegram','/telegram/:token'], bodyParser, async (req, res) => {
  try {
    const update = req.body;
    console.info('SHIM_INCOMING_TELEGRAM', { shape: Object.keys(update || {}).slice(0,8) });

    const job = {
      jobId: 'webhook-' + Date.now(),
      type: 'telegram_update',
      ts: Date.now(),
      payload: update,
      chatId: (update && update.message && update.message.chat && update.message.chat.id) || (update && update.chat && update.chat.id) || undefined
    };

    const client = await getRedisClient();
    try {
      await client.rPush('betrix-jobs', JSON.stringify(job));
      console.info('SHIM_ENQUEUED', { jobId: job.jobId, chatId: job.chatId });
    } catch(e) {
      console.error('SHIM_ENQUEUE_ERR', e && (e.stack || e.message || String(e)));
    } finally {
      try { await client.quit(); } catch(e) {}
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('SHIM_FATAL', err && (err.stack || err.message || String(err)));
    try { res.status(200).json({ ok: true }); } catch(e) {}
  }
});

module.exports = router;
