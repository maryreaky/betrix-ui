const { createClient } = require("redis");

async function getRedis() {
  if (global.__REDIS_CLIENT && global.__REDIS_CLIENT.isOpen) return global.__REDIS_CLIENT;
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL not set");
  const client = createClient({ url, password: process.env.REDIS_PASSWORD || undefined, socket: { reconnectStrategy: () => 1000 } });
  client.on("error", (e) => console.error("REDIS_ERR", e && e.stack ? e.stack : String(e)));
  await client.connect();
  global.__REDIS_CLIENT = client;
  return client;
}

module.exports = async function telegramWebhookHandler(req, res) {
  try {
    const body = req.body || {};
    const client = await getRedis();
    const job = JSON.stringify({ jobId: `wh-${Date.now()}`, payload: body });
    await client.rPush("telegram:webhook:queue", job); await client.rPush("webhooks:incoming", job);
    console.log("SHIM_ENQUEUED", { jobId: job.slice(0,64) });
    return res.status(200).json({ ok:true, enqueued:true });
  } catch (err) {
    console.error("SHIM_ENQUEUE_ERR", err && err.stack ? err.stack : String(err));
    return res.status(500).json({ ok:false, error:"enqueue_failed" });
  }
};
