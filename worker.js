import Redis from "ioredis";
import fetch from "node-fetch";

const redisClient = new Redis(process.env.REDIS_URL);
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;

async function sendTelegramMessage(chatId, text) {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  const body = { chat_id: chatId, text };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    console.log("Sent message:", data);
  } catch (err) {
    console.error("Error sending message:", err);
  }
}

async function processJobs() {
  while (true) {
    try {
      const job = await redisClient.brpop("telegram:webhook:queue", 0);
      if (job) {
        const data = JSON.parse(job[1]);
        console.log("Job popped:", data);

        const msg = data.payload.message;
        if (msg && msg.text === "/start") {
          await sendTelegramMessage(msg.chat.id, "Welcome to BETRIX! ?? Your bot is live.");
        }
      }
    } catch (err) {
      console.error("Worker error:", err);
    }
  }
}

processJobs();
