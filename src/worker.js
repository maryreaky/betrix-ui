import Redis from "ioredis";
import fetch from "node-fetch";

const redis = new Redis(process.env.REDIS_URL);

redis.on("error", err => console.error("Redis error", err));

console.log("Worker connected to Redis, waiting for jobs...");

(async () => {
  while (true) {
    try {
      const job = await redis.brpop("telegram-jobs", 0);
      if (job) {
        const [queue, raw] = job;
        const parsed = JSON.parse(raw);
        const payload = parsed.payload;

        console.log("Job popped:", payload);

        const chatId = payload.message.chat.id;
        const text = payload.message.text;

        // Command router
        let reply;
        switch (text.toLowerCase()) {
          case "/start":
            reply = "Welcome to BETRIX — your AI sports assistant!";
            break;
          case "/odds":
            reply = "Odds feature coming soon…";
            break;
          default:
            reply = `Unknown command: ${text}`;
        }

        // Send reply back to Telegram
        const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: reply
          })
        });

        const result = await res.json();
        console.log("Telegram API response:", result);
      }
    } catch (err) {
      console.error("Worker loop error", err);
    }
  }
})();
