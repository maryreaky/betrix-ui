/**
 * Webhook Handler for Telegram Updates
 */

import { Logger } from "../utils/logger.js";

const logger = new Logger("WebhookHandler");

class WebhookHandler {
  constructor(redis, telegram) {
    this.redis = redis;
    this.telegram = telegram;
  }

  async handleWebhook(req, res) {
    try {
      const update = req.body;
      
      if (!update || !update.update_id) {
        return res.status(200).json({ ok: true });
      }

      await this.redis.rpush("telegram:updates", JSON.stringify(update));
      
      return res.status(200).json({ ok: true });
    } catch (err) {
      logger.error("Webhook error", err);
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  async handleCallback(callbackQuery) {
    try {
      const { id, from, data } = callbackQuery;
      await this.redis.rpush("telegram:callbacks", JSON.stringify({ id, from, data, timestamp: Date.now() }));
    } catch (err) {
      logger.error("Callback handling failed", err);
    }
  }
}

export { WebhookHandler };
