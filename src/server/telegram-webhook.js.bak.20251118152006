/**
 * telegram-webhook.js
 * Hardened webhook: requires TELEGRAM_WEBHOOK_SECRET path param, validates minimal shape,
 * enqueues incoming update to Redis-backed queue and responds 200 immediately.
 */
const express = require("express");
const router = express.Router();
const { jobsQueue } = require("./queue");

function isValidTelegramUpdate(body) {
  return body && (body.message || body.callback_query || body.edited_message);
}

// Mount this router at /telegram/:secret (see index.js patch below)
router.post("/:secret", express.json({ limit: "100kb" }), async (req, res) => {
  try {
    const secret = req.params.secret;
    if (!process.env.TELEGRAM_WEBHOOK_SECRET || secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
      console.warn("WEBHOOK: invalid secret", secret && secret.slice ? secret.slice(0,8) : secret);
      return res.status(403).end();
    }
    if (!isValidTelegramUpdate(req.body)) {
      console.warn("WEBHOOK: invalid update shape");
      return res.status(400).end();
    }
    // quick dedupe: if update_id present, set jobId so duplicate updates aren't reprocessed
    const jobId = req.body.update_id ? `tg-${req.body.update_id}` : undefined;
    await jobsQueue.add("telegram-update", { update: req.body, receivedAt: Date.now() }, jobId ? { jobId, removeOnComplete: 1000, removeOnFail: 1000 } : { removeOnComplete: 1000, removeOnFail: 1000 });
    // respond fast so Telegram stops retrying
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("WEBHOOK-ENQUEUE-ERROR:", err && (err.stack||err.message) || err);
    // return 200 to avoid Telegram retry storm if enqueue temporarily fails; use monitoring to alert
    res.status(200).json({ ok: false, error: "enqueue_failed" });
  }
});

module.exports = router;
