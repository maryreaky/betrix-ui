import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL);

redis.on("error", err => console.error("Redis error", err));

console.log("Worker connected to Redis, waiting for jobs...");

(async () => {
  while (true) {
    try {
      // Blocking pop from the correct queue
      const job = await redis.brpop("telegram-jobs", 0);
      if (job) {
        const [queue, raw] = job;
        console.log("Job popped:", raw);

        // Parse and process payload
        const parsed = JSON.parse(raw);
        const payload = parsed.payload;

        // TODO: handle payload (e.g., sendMessage back to Telegram)
      }
    } catch (err) {
      console.error("Worker loop error", err);
    }
  }
})();
