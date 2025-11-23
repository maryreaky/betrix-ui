/**
 * Betslip Handlers - Payment & Free Bet Integration
 */

import { Logger } from "./utils/logger.js";
import { BetslipGenerator } from "./services/betslip-generator.js";
import { BettingSitesService } from "./services/betting-sites-service.js";
import { BetslipAnalysisService } from "./services/betslip-analysis-service.js";
import { FreeBetService } from "./services/free-bet-service.js";

const logger = new Logger("BetslipHandlers");

class BetslipHandlers {
  constructor(telegram, userService, gemini) {
    this.telegram = telegram;
    this.userService = userService;
    this.analysis = new BetslipAnalysisService(gemini);
  }

  /**
   * Generate betslip after payment success
   */
  async generateBetslipAfterPayment(chatId, userId, slip, user, country) {
    try {
      const userStats = await this.userService.getUser(userId);
      const currency = this.getCurrencyForCountry(country);

      // 1. Generate AI analysis
      const analysis = await this.analysis.analyzeBetslip(slip, userStats);

      // 2. Format analysis display
      const analysisDisplay = this.analysis.formatAnalysisDisplay(analysis, slip, userStats);

      // 3. Send analysis first
      await this.telegram.sendMessage(
        chatId,
        `💡 <b>Analysis Before Your Betslip</b>\n\n${analysisDisplay}`
      );

      // 4. Generate betslip text
      const betslipText = BetslipGenerator.formatBetslipAsImage(slip, user, currency);

      // 5. Send betslip
      await this.telegram.sendMessage(chatId, `<pre>${betslipText}</pre>`);

      // 6. Show betting sites for their country
      const sitesDisplay = BettingSitesService.formatSitesDisplay(country);
      await this.telegram.sendMessage(chatId, sitesDisplay, {
        reply_markup: BettingSitesService.buildBettingSitesKeyboard(country),
      });

      logger.info(`Betslip generated for payment: ${userId}`);
    } catch (err) {
      logger.error("Generate betslip after payment failed", err);
      await this.telegram.sendMessage(
        chatId,
        "❌ Error generating betslip. Please try again."
      );
    }
  }

  /**
   * Generate betslip for free bet
   */
  async generateFreeBetSlip(chatId, userId, freeBet, slip, user, country) {
    try {
      const userStats = await this.userService.getUser(userId);
      const currency = this.getCurrencyForCountry(country);

      // 1. Show free bet info
      const freeBetDisplay = FreeBetService.prototype.formatBetDisplay(freeBet);
      await this.telegram.sendMessage(chatId, `🎁 <b>Your Free Bet</b>\n\n${freeBetDisplay}`);

      // 2. Generate AI analysis
      const analysis = await this.analysis.analyzeBetslip(slip, userStats);
      const analysisDisplay = this.analysis.formatAnalysisDisplay(analysis, slip, userStats);

      // 3. Send analysis
      await this.telegram.sendMessage(
        chatId,
        `💡 <b>Recommended Betslip Analysis</b>\n\n${analysisDisplay}`
      );

      // 4. Generate betslip
      const betslipText = BetslipGenerator.formatBetslipAsImage(slip, user, currency);
      await this.telegram.sendMessage(chatId, `<pre>${betslipText}</pre>`);

      // 5. Highlight potential winnings with free bet
      const potentialWinnings = Number(freeBet.amount) * slip.totalOdds;
      await this.telegram.sendMessage(
        chatId,
        `💰 <b>Potential Winnings</b>\n\n` +
          `Stake: ${freeBet.amount} (FREE)\n` +
          `Odds: ${slip.totalOdds}\n` +
          `Potential Win: ${potentialWinnings.toFixed(2)} ${currency}\n\n` +
          `Use the betting sites below to place your free bet!`
      );

      // 6. Show betting sites
      const sitesDisplay = BettingSitesService.formatSitesDisplay(country);
      await this.telegram.sendMessage(chatId, sitesDisplay, {
        reply_markup: BettingSitesService.buildBettingSitesKeyboard(country),
      });

      logger.info(`Free bet slip generated: ${userId}`);
    } catch (err) {
      logger.error("Generate free bet slip failed", err);
      await this.telegram.sendMessage(chatId, "❌ Error generating free bet slip.");
    }
  }

  /**
   * Get currency for country
   */
  getCurrencyForCountry(country) {
    const currencyMap = {
      KE: "KES",
      NG: "NGN",
      ZA: "ZAR",
      TZ: "TZS",
      UG: "UGX",
      GH: "GHS",
      US: "USD",
      GB: "GBP",
      AU: "AUD",
      FR: "EUR",
    };
    return currencyMap[country] || "USD";
  }
}

export { BetslipHandlers };
