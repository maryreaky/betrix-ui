/**
 * User management service
 * Handles user profiles, referrals, roles, and subscriptions
 */

import { Logger } from "../utils/logger.js";
import { CONFIG } from "../config.js";

const logger = new Logger("UserService");

class UserService {
  constructor(redis) {
    this.redis = redis;
  }

  /**
   * Get user by ID
   */
  async getUser(userId) {
    try {
      const data = await this.redis.get(`user:${userId}`);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      logger.error("Get user failed", err);
      return null;
    }
  }

  /**
   * Save/update user
   */
  async saveUser(userId, data) {
    try {
      const current = (await this.getUser(userId)) || {};
      const updated = { ...current, ...data, updatedAt: new Date().toISOString() };
      await this.redis.set(`user:${userId}`, JSON.stringify(updated));
      return updated;
    } catch (err) {
      logger.error("Save user failed", err);
      throw err;
    }
  }

  /**
   * Check if user is paid/member
   */
  isPaid(user) {
    return Boolean(user?.paid_at);
  }

  /**
   * Check if user is VVIP
   */
  isVVIP(user) {
    if (user?.role !== CONFIG.ROLES.VVIP) return false;
    if (!user?.vvip_expires_at) return true;
    return Date.now() < Number(user.vvip_expires_at);
  }

  /**
   * Check if user is admin
   */
  isAdmin(userId) {
    return String(userId) === String(CONFIG.TELEGRAM.ADMIN_ID);
  }

  /**
   * Generate referral code
   */
  generateReferralCode(userId) {
    const base = Buffer.from(String(userId)).toString("base64").replace(/=+/g, "");
    const rand = Math.random().toString(36).slice(2, 6);
    return `${base}-${rand}`;
  }

  /**
   * Get or create referral code
   */
  async getOrCreateReferralCode(userId) {
    let user = await this.getUser(userId);
    if (!user?.referral_code) {
      const code = this.generateReferralCode(userId);
      user = await this.saveUser(userId, {
        referral_code: code,
        referrals_count: 0,
        rewards_points: 0,
      });
    }
    return user.referral_code;
  }

  /**
   * Apply referral code for new user
   */
  async applyReferral(code, newUserId) {
    try {
      if (!code) return null;

      const base = code.split("-")[0];
      let referrerId;

      try {
        referrerId = Buffer.from(base, "base64").toString("utf8");
      } catch {
        return null;
      }

      if (!/^\d+$/.test(referrerId)) return null;

      // Don't allow self-referrals
      if (String(referrerId) === String(newUserId)) return null;

      // Update referrer
      const refUser = (await this.getUser(referrerId)) || {};
      const count = Number(refUser.referrals_count || 0) + 1;
      const points = Number(refUser.rewards_points || 0) + 10;
      
      await this.saveUser(referrerId, {
        referrals_count: count,
        rewards_points: points,
      });

      // Track in leaderboard
      await this.redis.zincrby("leaderboard:referrals", 1, String(referrerId));

      // Update new user
      await this.saveUser(newUserId, {
        referred_by: referrerId,
        referral_used: code,
      });

      logger.info(`Referral applied: ${referrerId} -> ${newUserId}`);
      return referrerId;
    } catch (err) {
      logger.error("Apply referral failed", err);
      return null;
    }
  }

  /**
   * Set VVIP subscription
   */
  async setVVIPSubscription(userId, durationMs) {
    const expiresAt = Date.now() + durationMs;
    return this.saveUser(userId, {
      role: CONFIG.ROLES.VVIP,
      vvip_expires_at: expiresAt,
    });
  }

  /**
   * Get leaderboard
   */
  async getLeaderboard(type = "referrals", limit = 10) {
    try {
      const key = type === "referrals" ? "leaderboard:referrals" : "leaderboard:points";
      const topIds = await this.redis.zrevrange(key, 0, limit - 1, "WITHSCORES");

      const users = [];
      for (let i = 0; i < topIds.length; i += 2) {
        const userId = topIds[i];
        const score = topIds[i + 1];
        const user = await this.getUser(userId);

        if (user) {
          users.push({
            id: userId,
            name: user.name,
            country: user.country,
            score: parseInt(score),
          });
        }
      }

      return users;
    } catch (err) {
      logger.error("Get leaderboard failed", err);
      return [];
    }
  }
}

export { UserService };
