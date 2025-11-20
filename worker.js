import Redis from "ioredis";

const redisClient = new Redis(process.env.REDIS_URL);

async function processJobs() {
  while (true) {
    try {
      const job = await redisClient.brpop("telegram:webhook:queue", 0);
      if (job) {
        const data = JSON.parse(job[1]);
        console.log("Job popped:", data);
        // Add your job handling logic here (e.g., reply to Telegram, process commands)
      }
    } catch (err) {
      console.error("Worker error:", err);
    }
  }
}

processJobs();
