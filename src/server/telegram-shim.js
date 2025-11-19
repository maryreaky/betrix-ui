const express = require('express');
const router = express.Router();
const bodyParser = express.json({ limit: "100kb" });
const { promisify } = require('util');

async function getRedisClient() {
  // lazy require to avoid loading redis during build-time checks
  const Redis = require('redis');
  const opts = process.env.REDIS_URL ? { url: process.env.REDIS_URL } : { socket: { host: process.env.REDIS_HOST || '127.0.0.1', port: Number(process.env.REDIS_PORT || 6379) } };
  const client = Redis.createClient(opts);
  if (process.env.REDIS_PASSWORD) {
    // older redis clients might need AUTH; this is best-effort
    try { await client.connect(); } catch(e) {}
  } else {
    try { await client.connect(); } catch(e) {}
  }
  return client;
}

router.post(['/telegram','/webhook/telegram','/telegram/:token'], bodyParser, async (req, res) => {
  try {
    const update = req.body;
    console.info("SHIM INCOMING TELEGRAM", { shape: Object.keys(update || {}).slice(0,8) });

    // Build the job object in the shape worker expects
    const job = {
      jobId: 'webhook-' + Date.now(),
      type: 'telegram_update',
      ts: Date.now(),
      payload: update,
      chatId: (update && update.message && update.message.chat && update.message.chat.id) || (update && update.chat && update.chat.id) || undefined
    };

    // Enqueue to Redis list used by your worker
    const client = await getRedisClient();
    try {
      await client.rPush('betrix-jobs', JSON.stringify(job));
      console.info("SHIM_ENQUEUED", { jobId: job.jobId, chatId: job.chatId });
    } catch(e) {
      console.error("SHIM_ENQUEUE_ERR", e && (e.stack || e.message || String(e)));
    } finally {
      try { await client.quit(); } catch(e) {}
    }

    // Immediate OK to Telegram
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("SHIM_FATAL", err && (err.stack || err.message || String(err)));
    try { res.status(200).json({ ok: true }); } catch(e) {}
  }
});

module.exports = router;
