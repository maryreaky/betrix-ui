/**
 * AI Betting Coach Service
 * Personalized betting advice based on user performance
 */

import { Logger } from "../utils/logger.js";

const logger = new Logger("AICoach");

class AICoachService {
  constructor(gemini, userService) {
    this.gemini = gemini;
    this.userService = userService;
  }

  /**
   * Generate personalized coaching advice
   */
  async generateCoaching(userId, userStats) {
    try {
      const context = {
        predictions: userStats.predictions || 0,
        accuracy: userStats.accuracy || 0,
        streak: userStats.streak || 0,
        totalWins: userStats.wins || 0,
        totalLosses: userStats.losses || 0,
        roi: userStats.roi || 0,
      };

      const prompt = `You are BETRIX, a betting coach. Analyze this user's performance and give personalized advice:

User Stats: ${JSON.stringify(context)}

Based on their accuracy (${context.accuracy}%), streak (${context.streak}), and ROI (${context.roi}%), provide:
1. Specific strength to leverage
2. Key weakness to address
3. One tactical tip to improve
4. Motivational message

Keep it concise (3-4 sentences), data-driven, and actionable.`;

      const advice = await this.gemini.chat(prompt, context);
      return advice;
    } catch (err) {
      logger.error("Generate coaching failed", err);
      return this.getFallbackCoaching(userStats);
    }
  }

  /**
   * Suggest match to bet on based on user profile
   */
  async suggestMatch(userId, userStats, availableMatches) {
    try {
      // User with high accuracy gets complex matches
      // User with low accuracy gets simpler matches
      const confidence = userStats.accuracy >= 70 ? "high" : userStats.accuracy >= 50 ? "medium" : "low";

      const prompt = `You are BETRIX. User has ${confidence} confidence (${userStats.accuracy}% accuracy).
      
User prefers: Data-driven approach, strong form analysis, clear value.

From these matches: ${JSON.stringify(availableMatches.slice(0, 3))}

Pick the BEST match for this user's profile and explain why in 1-2 sentences.`;

      const suggestion = await this.gemini.chat(prompt, userStats);
      return suggestion;
    } catch (err) {
      logger.error("Suggest match failed", err);
      return null;
    }
  }

  /**
   * Get risk management advice
   */
  async getRiskAdvice(userStats, bankroll) {
    try {
      const kellyPercentage = this.calculateKelly(userStats.accuracy);
      
      const prompt = `As BETRIX, give Kelly Criterion betting advice:

User accuracy: ${userStats.accuracy}%
Bankroll: ${bankroll}
Kelly %: ${kellyPercentage}%

Recommended unit size and bet sizing strategy in 2 sentences.`;

      const advice = await this.gemini.chat(prompt);
      return { kellyPercentage, advice };
    } catch (err) {
      logger.error("Get risk advice failed", err);
      return { kellyPercentage: 2, advice: "Bet 2% of bankroll per unit (conservative)" };
    }
  }

  /**
   * Calculate Kelly Criterion
   */
  calculateKelly(winPercentage) {
    const p = winPercentage / 100;
    const q = 1 - p;
    const avgOdds = 2.0; // Assume average 2.0 odds
    
    // Kelly = (p * avgOdds - q) / (avgOdds - 1)
    const kelly = (p * avgOdds - q) / (avgOdds - 1);
    
    // Cap at 10% for safety
    return Math.min(Math.max(kelly * 100, 1), 10).toFixed(1);
  }

  /**
   * Fallback coaching message
   */
  getFallbackCoaching(stats) {
    if (stats.accuracy >= 70) {
      return `🏆 Excellent accuracy! You're trading like a pro. Consider increasing unit size on high-confidence predictions. Remember: bankroll preservation is key.`;
    } else if (stats.accuracy >= 50) {
      return `📈 You're building a solid foundation! Focus on patterns and stick to high-conviction picks. Quality over quantity beats volume plays.`;
    } else {
      return `🎓 You're learning! Start with favorites and proven trends. Build your accuracy first, then increase stakes. Every expert started where you are.`;
    }
  }
}

export { AICoachService };
