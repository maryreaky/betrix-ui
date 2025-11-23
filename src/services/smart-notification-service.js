/**
 * Smart Notification Service
 * Intelligent alerts based on user preferences and odds movement
 */

import { Logger } from "../utils/logger.js";

const logger = new Logger("SmartNotifications");

class SmartNotificationService {
  constructor(redis, telegram) {
    this.redis = redis;
    this.telegram = telegram;
  }

  /**
   * Register user for notifications
   */
  async registerUser(userId, preferences = {}) {
    try {
      const defaults = {
        goalAlerts: true,
        oddsMovement: true,
        oddsDelta: 0.1, // 10% movement threshold
        matchReminders: true,
        reminderMinutes: 30,
        streakNotifications: true,
        leaderboardUpdates: true,
        ...preferences,
      };
      
      await this.redis.hset(`notif:${userId}:prefs`, ...Object.entries(defaults).flat());
      logger.info(`User registered for notifications: ${userId}`);
      return defaults;
    } catch (err) {
      logger.error("Register user failed", err);
      return null;
    }
  }

  /**
   * Send goal alert
   */
  async sendGoalAlert(userId, chatId, match, goalData) {
    try {
      const prefs = await this.redis.hgetall(`notif:${userId}:prefs`);
      if (prefs.goalAlerts !== "true") return false;
      
      const message = `🎯 GOAL! ${match.homeTeam} vs ${match.awayTeam}\n\n` +
        `⚽ ${goalData.scorer} (${goalData.team})\n` +
        `Score: ${goalData.homeScore}-${goalData.awayScore}\n` +
        `Time: ${goalData.minute}'`;
      
      await this.telegram.sendMessage(chatId, message);
      return true;
    } catch (err) {
      logger.error("Send goal alert failed", err);
      return false;
    }
  }

  /**
   * Monitor odds movement and alert
   */
  async checkOddsMovement(userId, chatId, matchId, oddsData) {
    try {
      const prefs = await this.redis.hgetall(`notif:${userId}:prefs`);
      if (prefs.oddsMovement !== "true") return false;
      
      const previousOdds = await this.redis.get(`odds:${matchId}:previous`);
      if (!previousOdds) {
        await this.redis.set(`odds:${matchId}:previous`, oddsData.homeOdds);
        return false;
      }
      
      const delta = Math.abs((oddsData.homeOdds - parseFloat(previousOdds)) / parseFloat(previousOdds));
      const threshold = parseFloat(prefs.oddsDelta || 0.1);
      
      if (delta >= threshold) {
        const direction = oddsData.homeOdds > previousOdds ? "📈 UP" : "📉 DOWN";
        const message = `⚠️ <b>Odds Movement!</b>\n\n` +
          `Match: ${matchId}\n` +
          `${direction} ${(delta * 100).toFixed(1)}%\n` +
          `From: ${parseFloat(previousOdds).toFixed(2)}\n` +
          `To: ${oddsData.homeOdds.toFixed(2)}`;
        
        await this.telegram.sendMessage(chatId, message);
        await this.redis.set(`odds:${matchId}:previous`, oddsData.homeOdds);
        return true;
      }
      
      return false;
    } catch (err) {
      logger.error("Check odds movement failed", err);
      return false;
    }
  }

  /**
   * Send match reminder
   */
  async sendMatchReminder(userId, chatId, match) {
    try {
      const prefs = await this.redis.hgetall(`notif:${userId}:prefs`);
      if (prefs.matchReminders !== "true") return false;
      
      const minutes = parseInt(prefs.reminderMinutes || 30);
      const startTime = new Date(match.startTime);
      const now = new Date();
      const diffMinutes = (startTime - now) / 60000;
      
      if (diffMinutes <= minutes && diffMinutes > 0) {
        const message = `⏰ <b>Match Starting Soon!</b>\n\n` +
          `${match.homeTeam} vs ${match.awayTeam}\n` +
          `In ${Math.round(diffMinutes)} minutes\n\n` +
          `Use /odds to check betting odds`;
        
        await this.telegram.sendMessage(chatId, message);
        return true;
      }
      
      return false;
    } catch (err) {
      logger.error("Send match reminder failed", err);
      return false;
    }
  }

  /**
   * Send streak notification
   */
  async sendStreakNotification(userId, chatId, streak) {
    try {
      const prefs = await this.redis.hgetall(`notif:${userId}:prefs`);
      if (prefs.streakNotifications !== "true") return false;
      
      if (streak === 5) {
        await this.telegram.sendMessage(chatId, `🔥 Amazing! You're on a 5-win streak! Keep it going!`);
      } else if (streak === 10) {
        await this.telegram.sendMessage(chatId, `🏆 Incredible! 10-win streak! You're a legend!`);
      } else if (streak % 5 === 0) {
        await this.telegram.sendMessage(chatId, `✨ You just hit a ${streak}-win streak! Fantastic!`);
      }
      
      return true;
    } catch (err) {
      logger.error("Send streak notification failed", err);
      return false;
    }
  }

  /**
   * Send milestone notification
   */
  async sendMilestoneNotification(userId, chatId, milestone) {
    try {
      const messages = {
        "first_prediction": `🎯 First prediction made! Welcome to BETRIX!`,
        "10_predictions": `📊 You've made 10 predictions! Great start!`,
        "50_predictions": `🚀 50 predictions reached! You're serious about this!`,
        "100_predictions": `👑 100 predictions! You're an expert analyst!`,
        "65_accuracy": `🎓 65% accuracy achieved! You're becoming an analyst!`,
        "75_accuracy": `🏆 75% accuracy! You're trading like a pro!`,
      };
      
      const message = messages[milestone];
      if (message) {
        await this.telegram.sendMessage(chatId, `🎉 <b>Milestone!</b>\n\n${message}`);
        return true;
      }
      
      return false;
    } catch (err) {
      logger.error("Send milestone notification failed", err);
      return false;
    }
  }
}

export { SmartNotificationService };
