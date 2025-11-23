/**
 * Admin Dashboard & Monitoring
 * Real-time system metrics and user management
 */

import { Logger } from "../utils/logger.js";

const logger = new Logger("AdminDashboard");

class AdminDashboard {
  constructor(redis, telegram, analyticsService) {
    this.redis = redis;
    this.telegram = telegram;
    this.analytics = analyticsService;
  }

  /**
   * Get system health report
   */
  async getHealthReport() {
    try {
      const metrics = await this.analytics.getHealthMetrics();
      const topCommands = await this.analytics.getTopCommands(5);

      return {
        timestamp: new Date().toISOString(),
        users: metrics.totalUsers,
        status: metrics.uptime,
        topCommands,
        alerts: [],
      };
    } catch (err) {
      logger.error("Health report failed", err);
      return { status: "error" };
    }
  }

  /**
   * Send health report to admin
   */
  async sendHealthReport(chatId) {
    try {
      const report = await this.getHealthReport();

      const text =
        `📊 <b>System Health Report</b>\n\n` +
        `Timestamp: ${report.timestamp}\n` +
        `Status: ${report.status}\n` +
        `Active Users: ${report.users}\n\n` +
        `<b>Top Commands:</b>\n` +
        report.topCommands.map((c, i) => `${i + 1}. ${c.command} (${c.count}x, ${c.avgTime}ms avg)`).join("\n");

      return this.telegram.sendMessage(chatId, text);
    } catch (err) {
      logger.error("Send report failed", err);
    }
  }

  /**
   * Get user statistics
   */
  async getUserStats() {
    try {
      const totalUsers = await this.redis.zcard("users:all");
      const activeToday = await this.redis.zcard("users:active:today");
      const paidMembers = await this.redis.zcard("subscriptions:active");

      return {
        total: totalUsers,
        active: activeToday,
        paid: paidMembers,
      };
    } catch (err) {
      return { total: 0, active: 0, paid: 0 };
    }
  }

  /**
   * Broadcast announcement
   */
  async broadcastMessage(message) {
    try {
      const users = await this.redis.zrange("users:all", 0, -1);
      let sent = 0;

      for (const userId of users) {
        try {
          await this.telegram.sendMessage(userId, `📢 <b>Announcement</b>\n\n${message}`);
          sent++;
        } catch (err) {
          logger.warn(`Failed to send to ${userId}`);
        }
      }

      logger.info(`Broadcast sent to ${sent}/${users.length} users`);
      return sent;
    } catch (err) {
      logger.error("Broadcast failed", err);
      return 0;
    }
  }

  /**
   * Suspend/ban user
   */
  async suspendUser(userId, reason) {
    try {
      await this.redis.set(`user:${userId}:suspended`, reason, "EX", 86400 * 30);
      logger.warn(`User ${userId} suspended: ${reason}`);
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Check if user suspended
   */
  async isUserSuspended(userId) {
    try {
      const reason = await this.redis.get(`user:${userId}:suspended`);
      return !!reason;
    } catch {
      return false;
    }
  }

  /**
   * Get system logs
   */
  async getSystemLogs(limit = 20) {
    try {
      const logs = await this.redis.lrange("system:logs", 0, limit - 1);
      return logs.map(l => {
        try {
          return JSON.parse(l);
        } catch {
          return l;
        }
      });
    } catch {
      return [];
    }
  }

  /**
   * Log system event
   */
  async logEvent(event, data = {}) {
    try {
      const entry = {
        timestamp: new Date().toISOString(),
        event,
        data,
      };
      await this.redis.lpush("system:logs", JSON.stringify(entry));
      await this.redis.ltrim("system:logs", 0, 999);
    } catch (err) {
      logger.warn("Log event failed", err);
    }
  }

  /**
   * Get revenue metrics
   */
  async getRevenueMetrics() {
    try {
      const totalRevenue = await this.redis.get("revenue:total");
      const todayRevenue = await this.redis.get("revenue:today");
      const monthlyRevenue = await this.redis.get("revenue:month");

      return {
        total: parseFloat(totalRevenue) || 0,
        today: parseFloat(todayRevenue) || 0,
        month: parseFloat(monthlyRevenue) || 0,
      };
    } catch {
      return { total: 0, today: 0, month: 0 };
    }
  }
}

export { AdminDashboard };
