/**
 * Real-time Leaderboard Service
 * Live rankings, achievements, streaks
 */

import { Logger } from "../utils/logger.js";

const logger = new Logger("Leaderboard");

class LeaderboardService {
  constructor(redis) {
    this.redis = redis;
  }

  /**
   * Add points to user's leaderboard
   */
  async addPoints(userId, points, reason = "prediction") {
    try {
      const today = new Date().toISOString().split("T")[0];
      const key = `leaderboard:${today}:${userId}`;
      
      await this.redis.incrby(key, points);
      await this.redis.expire(key, 86400 * 30); // 30 days retention

      // Add to all-time
      await this.redis.zincrby("leaderboard:alltime", points, userId);
      
      logger.info(`Points added: ${userId} +${points} (${reason})`);
    } catch (err) {
      logger.error("Add points failed", err);
    }
  }

  /**
   * Track prediction accuracy
   */
  async recordPrediction(userId, prediction, outcome) {
    try {
      const accuracy = prediction === outcome ? 100 : 0;
      await this.redis.hincrbyfloat(`user:${userId}:accuracy`, "total", 1);
      await this.redis.hincrbyfloat(`user:${userId}:accuracy`, "correct", accuracy / 100);
      
      // Calculate win percentage
      const total = await this.redis.hget(`user:${userId}:accuracy`, "total");
      const correct = await this.redis.hget(`user:${userId}:accuracy`, "correct");
      const percentage = (correct / total * 100).toFixed(1);
      
      await this.redis.hset(`user:${userId}:accuracy`, "percentage", percentage);
    } catch (err) {
      logger.error("Record prediction failed", err);
    }
  }

  /**
   * Get live leaderboard (top 20)
   */
  async getLeaderboard(period = "today") {
    try {
      let key = `leaderboard:${new Date().toISOString().split("T")[0]}`;
      if (period === "alltime") key = "leaderboard:alltime";
      if (period === "week") key = `leaderboard:week:${Math.floor(Date.now() / 604800000)}`;
      
      const ranks = await this.redis.zrevrange(key, 0, 19, "WITHSCORES");
      const leaderboard = [];
      
      for (let i = 0; i < ranks.length; i += 2) {
        const userId = ranks[i];
        const points = parseInt(ranks[i + 1]);
        leaderboard.push({ rank: leaderboard.length + 1, userId, points });
      }
      
      return leaderboard;
    } catch (err) {
      logger.error("Get leaderboard failed", err);
      return [];
    }
  }

  /**
   * Get user rank
   */
  async getUserRank(userId, period = "today") {
    try {
      let key = `leaderboard:${new Date().toISOString().split("T")[0]}`;
      if (period === "alltime") key = "leaderboard:alltime";
      
      const rank = await this.redis.zrevrank(key, userId);
      const score = await this.redis.zscore(key, userId);
      
      return { rank: rank ? rank + 1 : null, score: score ? parseInt(score) : 0 };
    } catch (err) {
      logger.error("Get user rank failed", err);
      return { rank: null, score: 0 };
    }
  }

  /**
   * Check and award achievements
   */
  async checkAchievements(userId, stats) {
    try {
      const achievements = [];
      
      // Milestone achievements
      if (stats.predictions >= 10) achievements.push({ id: "first_10", name: "🎯 Starter", desc: "10 predictions" });
      if (stats.predictions >= 50) achievements.push({ id: "first_50", name: "🔥 On Fire", desc: "50 predictions" });
      if (stats.predictions >= 100) achievements.push({ id: "first_100", name: "👑 Legend", desc: "100 predictions" });
      if (stats.accuracy >= 65) achievements.push({ id: "accuracy_65", name: "🎓 Analyst", desc: "65% accuracy" });
      if (stats.accuracy >= 75) achievements.push({ id: "accuracy_75", name: "🏆 Expert", desc: "75% accuracy" });
      if (stats.streak >= 5) achievements.push({ id: "streak_5", name: "✨ Hot Streak", desc: "5 wins in a row" });
      if (stats.referrals >= 5) achievements.push({ id: "referral_5", name: "👥 Connector", desc: "5 referrals" });
      
      // Store achievements
      for (const ach of achievements) {
        await this.redis.sadd(`user:${userId}:achievements`, ach.id);
      }
      
      return achievements;
    } catch (err) {
      logger.error("Check achievements failed", err);
      return [];
    }
  }

  /**
   * Get user streak
   */
  async updateStreak(userId, won) {
    try {
      if (won) {
        await this.redis.incr(`user:${userId}:streak`);
      } else {
        await this.redis.del(`user:${userId}:streak`);
      }
      
      const streak = await this.redis.get(`user:${userId}:streak`);
      return parseInt(streak || 0);
    } catch (err) {
      logger.error("Update streak failed", err);
      return 0;
    }
  }
}

export { LeaderboardService };
