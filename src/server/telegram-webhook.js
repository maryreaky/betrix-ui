/* AUTO_GENERATED TELEGRAM WEBHOOK ROUTER - CHATID + ENQUEUE GUARANTEE */
const express = require("express");
const router = express.Router();
const bodyParser = require("body-parser");

// lightweight resolver (robust across update shapes)
function resolveTelegramChatId(update){
  try {
    if (!update || typeof update !== "object") return undefined;
    if (update._resolvedChatId) return update._resolvedChatId;
    if (update.chatId !== undefined) return update.chatId;
    if (update.message && update.message.chat && update.message.chat.id) return update.message.chat.id;
    if (update.edited_message && update.edited_message.chat && update.edited_message.chat.id) return update.edited_message.chat.id;
    if (update.callback_query && update.callback_query.message && update.callback_query.message.chat && update.callback_query.message.chat.id) return update.callback_query.message.chat.id;
    const stack = [update];
    while(stack.length){
      const o = stack.pop();
      if(!o || typeof o !== "object") continue;
      if(o.chat && o.chat.id) return o.chat.id;
      for(const k of Object.keys(o)) if(o[k] && typeof o[k] === "object") stack.push(o[k]);
    }
  } catch(e){}
  return undefined;
}

// attach logger helper
function logResolved(prefix, update){
  try {
    const id = resolveTelegramChatId(update);
    console.log(prefix + " TELEGRAM_RAW_UPDATE " + JSON.stringify(update));
    console.log(prefix + " TELEGRAM_RESOLVED_CHAT_ID " + (typeof id === "undefined" ? "undefined" : id));
    return id;
  } catch(e){ console.log(prefix + " TELEGRAM_RESOLVE_ERROR " + (e && e.stack ? e.stack : String(e))); return undefined; }
}

router.post("/telegram", bodyParser.json({ limit: "100kb" }), async (req, res) => {
  try {
    const update = req.body || {};
    const chatId = logResolved("INCOMING", update);
    // attach top-level fields so downstream code sees them
    try { update._resolvedChatId = chatId; if (typeof update.chatId === "undefined") update.chatId = chatId; } catch(e){}

    // Best-effort enqueue:
    let enqueued = false;
    try {
      // try to use the project's queue factory if available
      let createQueue;
      try { createQueue = require("./queue").createQueue; } catch(e) { try { createQueue = require("../server/queue").createQueue } catch(e){} }
      if (createQueue && typeof createQueue === "function") {
        const q = createQueue("betrix-jobs");
        if (q && typeof q.add === "function") {
          // standard signature: queue.add(name, payload, opts) OR queue.add(payload, opts)
          // use a safe payload wrapper to guarantee top-level chatId
          const payload = Object.assign({}, update, { chatId: chatId });
          // prefer named jobs if you used them elsewhere: use 'webhook' as safe default
          await q.add("webhook", payload).catch(e => { console.error("WEBHOOK_QUEUE_ADD_ERR", e && e.stack ? e.stack : String(e)); });
          enqueued = true;
        }
      }
    } catch(e){ console.error("WEBHOOK_ENQUEUE_TRY_ERR", e && e.stack ? e.stack : String(e)); }

    // fallback: try Redis lPush directly if a REDIS_URL exists and ioredis available
    if (!enqueued) {
      try {
        const Redis = require("ioredis");
        if (process.env.REDIS_URL) {
          const client = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
          const payloadStr = JSON.stringify(Object.assign({}, update, { chatId: chatId }));
          // keep queue key same shape your workers read: try "betrix-jobs" then "betrix:retry"
          await client.rpush("betrix-jobs", JSON.stringify({ jobId: "wh-fallback-"+Date.now(), payload: Object.assign({}, update, { chatId: chatId }), ts: new Date().toISOString() }));
          client.disconnect();
          enqueued = true;
        }
      } catch(e){ console.error("WEBHOOK_REDIS_FALLBACK_ERR", e && e.stack ? e.stack : String(e)); }
    }

    // Always respond 200 to Telegram quickly
    res.status(200).json({ ok: true, enqueued: !!enqueued });
  } catch(err){
    console.error("WEBHOOK_HANDLER_FATAL:", err && (err.stack || err.message) || err);
    try { res.status(200).json({ ok: false, error: "internal" }); } catch(e){}
  }
});

module.exports = router;
