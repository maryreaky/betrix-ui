/**
 * Rate Limiting & Anti-Abuse Middleware
 */

import { Logger } from "../utils/logger.js";

const logger = new Logger("RateLimiter");

class RateLimiter {
  constructor(redis) {
    this.redis = redis;
    this.limits = {
      default: { requests: 30, window: 60 }, // 30 requests per minute
      premium: { requests: 100, window: 60 },
      admin: { requests: 1000, window: 60 },
    };
  }

  /**
   * Check if user is rate limited
   */
  async isRateLimited(userId, tier = "default") {
    try {
      const key = `ratelimit:${userId}`;
      const limit = this.limits[tier];

      const current = await this.redis.incr(key);
      if (current === 1) {
        await this.redis.expire(key, limit.window);
      }

      return current > limit.requests;
    } catch (err) {
      logger.error("Rate limit check failed", err);
      return false;
    }
  }

  /**
   * Get remaining requests
   */
  async getRemainingRequests(userId, tier = "default") {
    try {
      const key = `ratelimit:${userId}`;
      const limit = this.limits[tier];

      const current = await this.redis.get(key);
      return Math.max(0, limit.requests - (parseInt(current) || 0));
    } catch {
      return this.limits[tier].requests;
    }
  }

  /**
   * Reset rate limit for user
   */
  async resetRateLimit(userId) {
    try {
      const key = `ratelimit:${userId}`;
      await this.redis.del(key);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Detect spam patterns
   */
  async isSpamming(userId, threshold = 50) {
    try {
      const key = `ratelimit:${userId}`;
      const current = await this.redis.get(key);

      return parseInt(current) > threshold;
    } catch {
      return false;
    }
  }
}

export { RateLimiter };
