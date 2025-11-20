import Redis from "ioredis";

const redisClient = new Redis(process.env.REDIS_URL);

async function processJobs() {
  while (true) {
    const job = await redisClient.brpop("telegram:webhook:queue", 0);
    if (job) {
      const data = JSON.parse(job[1]);
      console.log("Job popped:", data);
      // Here you can add actual job handling logic
    }
  }
}

processJobs().catch(err => {
  console.error("Worker error:", err);
});
