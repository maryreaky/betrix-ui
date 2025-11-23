/**
 * Notification Service
 * Handles push notifications, alerts, and user messaging
 */

import { Logger } from "../utils/logger.js";

const logger = new Logger("NotificationService");

class NotificationService {
  constructor(redis, telegram) {
    this.redis = redis;
    this.telegram = telegram;
  }

  async sendNotification(userId, title, message, type = "info") {
    try {
      const notification = { userId, title, message, type, timestamp: Date.now(), read: false };
      const key = `notifications:${userId}`;
      
      await this.redis.rpush(key, JSON.stringify(notification));
      await this.redis.ltrim(key, -100, -1); // Keep last 100
      
      return notification;
    } catch (err) {
      logger.error("Send notification failed", err);
      return null;
    }
  }

  async sendAlert(userId, text, alertType = "info") {
    try {
      if (this.telegram) {
        await this.telegram.sendMessage(userId, text);
      }
      
      const icons = {
        warning: "⚠️",
        error: "❌",
        success: "✅",
        info: "ℹ️",
        goal: "⚽",
        odds: "💰",
      };

      const icon = icons[alertType] || "📢";
      const fullText = `${icon} ${text}`;
      
      await this.sendNotification(userId, alertType.toUpperCase(), fullText);
    } catch (err) {
      logger.error("Send alert failed", err);
    }
  }

  async broadcastMessage(message, filter = {}) {
    try {
      const userKeys = await this.redis.keys("user:*");
      let sent = 0;

      for (const key of userKeys) {
        const user = await this.redis.get(key);
        if (!user) continue;

        const userData = JSON.parse(user);
        
        // Apply filter if specified
        if (filter.tier && userData.tier !== filter.tier) continue;
        if (filter.active && !userData.active) continue;

        try {
          await this.telegram.sendMessage(userData.chatId, message);
          sent++;
        } catch (e) {
          // Continue if individual message fails
        }
      }

      return sent;
    } catch (err) {
      logger.error("Broadcast failed", err);
      return 0;
    }
  }

  async getNotifications(userId, limit = 10) {
    try {
      const key = `notifications:${userId}`;
      const notifications = await this.redis.lrange(key, -limit, -1);
      return notifications.map(n => JSON.parse(n));
    } catch (err) {
      return [];
    }
  }
}

export { NotificationService };
