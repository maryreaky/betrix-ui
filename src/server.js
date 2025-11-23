/**
 * BETRIX Express Server
 * HTTP API + Telegram Webhook + Admin Dashboard
 */

import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { Logger } from "./utils/logger.js";
import { MpesaCallbackHandler } from "./middleware/mpesa-callback.js";

const logger = new Logger("Server");
const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});
app.use(limiter);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date(), service: "BETRIX" });
});

// Telegram webhook
app.post("/webhook/telegram", async (req, res) => {
  try {
    res.status(200).json({ ok: true });
  } catch (err) {
    logger.error("Webhook error", err);
    res.status(500).json({ ok: false });
  }
});

// M-Pesa callback
app.post("/webhook/mpesa", async (req, res) => {
  try {
    const handler = new MpesaCallbackHandler();
    await handler.handleCallback(req, res);
  } catch (err) {
    logger.error("M-Pesa error", err);
    res.status(500).json({ ok: false });
  }
});

// Start server
export function startServer() {
  const PORT = 5000;
  const server = app.listen(PORT, "0.0.0.0", () => {
    logger.info(`🚀 Server on port ${PORT}`);
  });

  process.on("SIGTERM", () => {
    logger.info("Shutting down...");
    server.close(() => process.exit(0));
  });

  return server;
}

export { app };
