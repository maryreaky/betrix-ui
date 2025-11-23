/**
 * Achievements & Gamification Service
 * Badges, milestones, achievements, and rewards
 */

import { Logger } from "../utils/logger.js";

const logger = new Logger("Achievements");

class AchievementsService {
  constructor(redis) {
    this.redis = redis;
  }

  /**
   * All available achievements
   */
  getAchievements() {
    return {
      // Prediction milestones
      first_1: { emoji: "🎯", name: "First Step", desc: "Make your first prediction" },
      first_10: { emoji: "📊", name: "Starter Pack", desc: "10 predictions" },
      first_50: { emoji: "🔥", name: "On Fire", desc: "50 predictions" },
      first_100: { emoji: "👑", name: "Century Club", desc: "100 predictions" },
      first_500: { emoji: "🚀", name: "High Roller", desc: "500 predictions" },

      // Accuracy achievements
      accuracy_55: { emoji: "🎓", name: "Analyst", desc: "55% accuracy" },
      accuracy_65: { emoji: "📈", name: "Professional", desc: "65% accuracy" },
      accuracy_75: { emoji: "🏆", name: "Expert", desc: "75% accuracy" },
      accuracy_85: { emoji: "👑", name: "Legendary", desc: "85% accuracy" },

      // Streak achievements
      streak_3: { emoji: "⭐", name: "Hot Hands", desc: "3-win streak" },
      streak_5: { emoji: "✨", name: "On Fire", desc: "5-win streak" },
      streak_10: { emoji: "🔥", name: "Untouchable", desc: "10-win streak" },
      streak_20: { emoji: "👑", name: "Legendary Streak", desc: "20-win streak" },

      // Social achievements
      referral_1: { emoji: "👥", name: "Connector", desc: "1 referral" },
      referral_5: { emoji: "🌟", name: "Influencer", desc: "5 referrals" },
      referral_10: { emoji: "🚀", name: "Growth Hacker", desc: "10 referrals" },

      // Member achievements
      member_7days: { emoji: "💎", name: "Member", desc: "Member for 7 days" },
      member_30days: { emoji: "👑", name: "VIP", desc: "Member for 30 days" },
      vvip_premium: { emoji: "💰", name: "Premium", desc: "VVIP subscriber" },

      // Special achievements
      perfect_day: { emoji: "💯", name: "Perfect Day", desc: "100% accuracy in a day" },
      double_roi: { emoji: "📈", name: "Double Return", desc: "200%+ ROI" },
      comeback_5: { emoji: "🎯", name: "Comeback King", desc: "Win after 5-loss streak" },
    };
  }

  /**
   * Check and award achievements
   */
  async checkAndAward(userId, stats) {
    try {
      const achievements = this.getAchievements();
      const userAchievements = await this.redis.smembers(`user:${userId}:achievements`) || [];
      const newAchievements = [];

      // Check prediction milestones
      if (stats.predictions >= 1 && !userAchievements.includes("first_1")) {
        newAchievements.push("first_1");
      }
      if (stats.predictions >= 10 && !userAchievements.includes("first_10")) {
        newAchievements.push("first_10");
      }
      if (stats.predictions >= 50 && !userAchievements.includes("first_50")) {
        newAchievements.push("first_50");
      }
      if (stats.predictions >= 100 && !userAchievements.includes("first_100")) {
        newAchievements.push("first_100");
      }

      // Check accuracy achievements
      if (stats.accuracy >= 55 && !userAchievements.includes("accuracy_55")) {
        newAchievements.push("accuracy_55");
      }
      if (stats.accuracy >= 65 && !userAchievements.includes("accuracy_65")) {
        newAchievements.push("accuracy_65");
      }
      if (stats.accuracy >= 75 && !userAchievements.includes("accuracy_75")) {
        newAchievements.push("accuracy_75");
      }

      // Check streak achievements
      if (stats.streak >= 3 && !userAchievements.includes("streak_3")) {
        newAchievements.push("streak_3");
      }
      if (stats.streak >= 5 && !userAchievements.includes("streak_5")) {
        newAchievements.push("streak_5");
      }
      if (stats.streak >= 10 && !userAchievements.includes("streak_10")) {
        newAchievements.push("streak_10");
      }

      // Award new achievements
      for (const id of newAchievements) {
        await this.redis.sadd(`user:${userId}:achievements`, id);
      }

      logger.info(`Achievements awarded: ${userId} - ${newAchievements.join(", ")}`);
      
      return newAchievements.map(id => ({
        id,
        ...achievements[id],
      }));
    } catch (err) {
      logger.error("Check achievements failed", err);
      return [];
    }
  }

  /**
   * Get user achievements
   */
  async getUserAchievements(userId) {
    try {
      const achievementIds = await this.redis.smembers(`user:${userId}:achievements`) || [];
      const achievements = this.getAchievements();
      
      return achievementIds.map(id => ({
        id,
        ...achievements[id],
      })).filter(a => a.name);
    } catch (err) {
      logger.error("Get user achievements failed", err);
      return [];
    }
  }

  /**
   * Format achievements for display
   */
  async formatAchievementsDisplay(userId) {
    try {
      const achievements = await this.getUserAchievements(userId);
      
      if (achievements.length === 0) {
        return `🏆 <b>Achievements</b>\n\nMake predictions to earn achievements!`;
      }

      let text = `🏆 <b>Achievements (${achievements.length})</b>\n\n`;
      
      achievements.forEach((a, i) => {
        text += `${a.emoji} <b>${a.name}</b>\n   ${a.desc}\n`;
        if (i < achievements.length - 1) text += "\n";
      });

      return text;
    } catch (err) {
      logger.error("Format display failed", err);
      return "Error loading achievements";
    }
  }
}

export { AchievementsService };
