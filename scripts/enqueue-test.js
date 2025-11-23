const { Queue } = require("bullmq");

(async () => {
  try {
    const q = new Queue("betrix-jobs", {
      connection: {
        host: "redis-14261.c282.east-us-mz.azure.cloud.redislabs.com",
        port: 14261,
        password: process.env.REDIS_PASSWORD || process.env.REDIS || undefined,
        tls: false
      }
    });

    const payload = {
      update: {
        update_id: Math.floor(Math.random() * 100000000),
        message: {
          message_id: 9999,
          date: Math.floor(Date.now() / 1000),
          chat: { id: 259313404, type: "private", username: "probe_user" },
          from: { id: 259313404, is_bot: false, first_name: "Probe" },
          text: "/test enqueue"
        }
      },
      receivedAt: Date.now()
    };

    const job = await q.add("telegram-update", payload, { removeOnComplete: 1000, removeOnFail: 1000 });
    console.log("ENQUEUED", JSON.stringify({ id: job.id, name: job.name }));
    await q.close();
    process.exit(0);
  } catch (err) {
    console.error("ENQUEUE-ERROR", err && (err.stack || err.message) || err);
    process.exit(2);
  }
})();
