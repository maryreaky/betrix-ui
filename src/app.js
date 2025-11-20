import express from "express";
import bodyParser from "body-parser";
import Redis from "ioredis";

const app = express();
const redisClient = new Redis(process.env.REDIS_URL);

app.use(bodyParser.json());

// Health check routes
app.get("/", (req, res) => {
  res.status(200).send("OK");
});
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// Telegram webhook route
app.post("/telegram", (req, res) => {
  const update = req.body;
  redisClient.lpush("telegram:webhook:queue", JSON.stringify({
    jobId: `wh-${Date.now()}`,
    payload: update
  }));
  console.log("Telegram update received:", update); // log incoming updates
  res.sendStatus(200); // respond immediately with 200 OK
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on port ${PORT}`);
});
