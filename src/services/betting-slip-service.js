/**
 * Betting Slip Service
 * Build and manage multi-match betting slips/parlays
 */

import { Logger } from "../utils/logger.js";

const logger = new Logger("BettingSlip");

class BettingSlipService {
  constructor(redis) {
    this.redis = redis;
  }

  /**
   * Create new betting slip for user
   */
  async createSlip(userId, name = "Slip") {
    try {
      const slipId = `slip:${userId}:${Date.now()}`;
      await this.redis.hset(slipId, "name", name, "created", new Date().toISOString(), "matches", "0", "totalOdds", "1");
      await this.redis.expire(slipId, 86400); // 24 hours
      
      logger.info(`Betting slip created: ${slipId}`);
      return slipId;
    } catch (err) {
      logger.error("Create slip failed", err);
      return null;
    }
  }

  /**
   * Add match to betting slip
   */
  async addMatch(slipId, matchId, team, odds, prediction) {
    try {
      const match = { matchId, team, odds, prediction, timestamp: Date.now() };
      await this.redis.hset(slipId, `match:${matchId}`, JSON.stringify(match));
      
      // Recalculate total odds
      const slip = await this.redis.hgetall(slipId);
      let totalOdds = 1;
      
      for (const [key, value] of Object.entries(slip)) {
        if (key.startsWith("match:")) {
          const m = JSON.parse(value);
          totalOdds *= parseFloat(m.odds);
        }
      }
      
      await this.redis.hset(slipId, "totalOdds", totalOdds.toFixed(2));
      return { matchId, odds: totalOdds.toFixed(2) };
    } catch (err) {
      logger.error("Add match failed", err);
      return null;
    }
  }

  /**
   * Remove match from slip
   */
  async removeMatch(slipId, matchId) {
    try {
      await this.redis.hdel(slipId, `match:${matchId}`);
      logger.info(`Match removed from slip: ${matchId}`);
      return true;
    } catch (err) {
      logger.error("Remove match failed", err);
      return false;
    }
  }

  /**
   * Get betting slip
   */
  async getSlip(slipId) {
    try {
      const slip = await this.redis.hgetall(slipId);
      if (!slip || !slip.created) return null;
      
      const matches = [];
      for (const [key, value] of Object.entries(slip)) {
        if (key.startsWith("match:")) {
          matches.push(JSON.parse(value));
        }
      }
      
      return {
        id: slipId,
        name: slip.name,
        matches,
        totalOdds: slip.totalOdds,
        created: slip.created,
      };
    } catch (err) {
      logger.error("Get slip failed", err);
      return null;
    }
  }

  /**
   * Calculate potential winnings
   */
  async calculateWinnings(slipId, stakeAmount) {
    try {
      const slip = await this.getSlip(slipId);
      if (!slip) return null;
      
      const totalOdds = parseFloat(slip.totalOdds);
      const potentialWinning = stakeAmount * totalOdds;
      const profit = potentialWinning - stakeAmount;
      
      return {
        stake: stakeAmount,
        odds: totalOdds,
        potentialWinning: potentialWinning.toFixed(2),
        profit: profit.toFixed(2),
        roi: ((profit / stakeAmount) * 100).toFixed(1),
      };
    } catch (err) {
      logger.error("Calculate winnings failed", err);
      return null;
    }
  }

  /**
   * Format slip for display
   */
  async formatSlipDisplay(slipId) {
    try {
      const slip = await this.getSlip(slipId);
      if (!slip) return "Slip not found";
      
      let text = `📋 <b>${slip.name}</b>\n\n`;
      text += `Matches in slip: ${slip.matches.length}\n`;
      
      slip.matches.forEach((m, i) => {
        text += `${i + 1}. ${m.team}\n   Prediction: ${m.prediction}\n   Odds: ${m.odds}\n`;
      });
      
      text += `\n💰 Total Odds: <b>${slip.totalOdds}</b>\n`;
      text += `\nEnter stake amount to calculate winnings.`;
      
      return text;
    } catch (err) {
      logger.error("Format slip display failed", err);
      return "Error displaying slip";
    }
  }
}

export { BettingSlipService };
