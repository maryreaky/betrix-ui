import express from "express";
import bodyParser from "body-parser";
import Redis from "ioredis";

const app = express();
const redisClient = new Redis(process.env.REDIS_URL);

app.use(bodyParser.json());

app.get("/", (req, res) => {
  res.status(200).send("OK");
});

app.post("/telegram", (req, res) => {
  const update = req.body;
  redisClient.lpush("telegram:webhook:queue", JSON.stringify({
    jobId: `wh-${Date.now()}`,
    payload: update
  }));
  res.sendStatus(200);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
