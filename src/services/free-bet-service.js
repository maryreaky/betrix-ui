/**
 * Free Bet Service
 * Issue free bets, track usage, generate betslips for free bets
 */

import { Logger } from "../utils/logger.js";

const logger = new Logger("FreeBet");

class FreeBetService {
  constructor(redis) {
    this.redis = redis;
  }

  /**
   * Issue free bet to user
   */
  async issueBet(userId, amount, reason = "daily_bonus", expiryDays = 7) {
    try {
      const betId = `freebet:${userId}:${Date.now()}`;
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + expiryDays);

      const betData = {
        id: betId,
        userId,
        amount,
        reason,
        status: "active",
        issuedAt: new Date().toISOString(),
        expiryAt: expiry.toISOString(),
        usedAt: null,
      };

      await this.redis.hset(betId, ...Object.entries(betData).flat());
      await this.redis.expire(betId, expiryDays * 86400);

      // Track in user's free bets
      await this.redis.sadd(`user:${userId}:freebets`, betId);

      logger.info(`Free bet issued: ${betId} - ${amount}`);
      return betData;
    } catch (err) {
      logger.error("Issue free bet failed", err);
      return null;
    }
  }

  /**
   * Get user's active free bets
   */
  async getActiveBets(userId) {
    try {
      const betIds = await this.redis.smembers(`user:${userId}:freebets`);
      const activeBets = [];

      for (const betId of betIds) {
        const bet = await this.redis.hgetall(betId);
        if (bet && bet.status === "active") {
          activeBets.push(bet);
        }
      }

      return activeBets;
    } catch (err) {
      logger.error("Get active bets failed", err);
      return [];
    }
  }

  /**
   * Use free bet for betslip
   */
  async useBet(betId, slipId, stake) {
    try {
      const bet = await this.redis.hgetall(betId);
      if (!bet || bet.status !== "active") {
        return { success: false, error: "Bet not active" };
      }

      if (Number(stake) > Number(bet.amount)) {
        return { success: false, error: "Stake exceeds free bet amount" };
      }

      // Mark as used
      await this.redis.hset(betId, "status", "used", "usedAt", new Date().toISOString(), "slipId", slipId);

      logger.info(`Free bet used: ${betId} - Slip ${slipId}`);
      return { success: true, bet };
    } catch (err) {
      logger.error("Use free bet failed", err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Format free bet for display
   */
  formatBetDisplay(bet) {
    const remaining = Math.max(0, Math.ceil((new Date(bet.expiryAt) - new Date()) / (1000 * 60 * 60 * 24)));

    let text = `🎁 <b>FREE BET</b>\n\n`;
    text += `Amount: ${bet.amount}\n`;
    text += `Reason: ${bet.reason}\n`;
    text += `Expires in: ${remaining} days\n`;
    text += `Status: ${bet.status}\n\n`;

    if (remaining <= 1) {
      text += `⚠️ Expires soon! Use today!`;
    }

    return text;
  }

  /**
   * Check if bet expired
   */
  isExpired(bet) {
    return new Date() > new Date(bet.expiryAt);
  }

  /**
   * Generate free bet betslip
   */
  async generateFreeBetSlip(userId, bet, slip) {
    try {
      const freeBetSlip = {
        id: `freebet-slip-${Date.now()}`,
        userId,
        freeBetId: bet.id,
        freeBetAmount: bet.amount,
        matches: slip.matches,
        totalOdds: slip.totalOdds,
        potentialWinning: Number(bet.amount) * slip.totalOdds,
        type: "FREE_BET",
        createdAt: new Date().toISOString(),
      };

      return freeBetSlip;
    } catch (err) {
      logger.error("Generate free bet slip failed", err);
      return null;
    }
  }
}

export { FreeBetService };
