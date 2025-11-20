import Redis from "ioredis";

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
        if (msg && msg.text) {
          const chatId = msg.chat.id;
          const text = msg.text.trim();

          switch (text) {
            case "/start":
              await sendTelegramMessage(chatId, "Welcome to BETRIX! ?? Your bot is live.");
              break;
            case "/help":
              await sendTelegramMessage(chatId,
                "Available commands:\n/start – Welcome message\n/help – Show this menu\n/odds – Sports odds (coming soon)\n/meme – Fun meme (coming soon)"
              );
              break;
            case "/odds":
              await sendTelegramMessage(chatId, "Sports odds feature is under construction ??? Stay tuned!");
              break;
            case "/meme":
              await sendTelegramMessage(chatId, "Meme feature is under construction ?? Stay tuned!");
              break;
            default:
              await sendTelegramMessage(chatId, "Unknown command. Type /help to see available options.");
          }
        }
      }
    } catch (err) {
      console.error("Worker error:", err);
    }
  }
}

processJobs();
