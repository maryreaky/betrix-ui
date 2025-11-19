import express from "express";
import bodyParser from "body-parser";
import Redis from "ioredis";

const app = express();
const redisClient = new Redis(process.env.REDIS_URL);

app.use(bodyParser.json());

app.post("/telegram", (req, res) => {
  const update = req.body;
  redisClient.lpush("telegram:webhook:queue", JSON.stringify({
    jobId: `wh-${Date.now()}`,
    payload: update
  }));
  res.sendStatus(200); // critical: always respond 200 OK
});

// Export the app so Render can mount
export default app;
