/**
 * BETRIX New Features Handlers
 * Meme, Crypto, News, Tips with full branding
 */

import { Logger } from "./utils/logger.js";
import { MemeService } from "./services/meme-service.js";
import { CryptoPredictionsService } from "./services/crypto-predictions-service.js";
import { NewsService } from "./services/news-service.js";
import { AIFallbackService } from "./services/ai-fallback-service.js";
import { ContentGenerationService } from "./services/content-generation-service.js";
import { BrandingService } from "./services/branding-service.js";

const logger = new Logger("NewFeatures");

class NewFeaturesHandlers {
  constructor(telegram, userService, gemini) {
    this.telegram = telegram;
    this.userService = userService;
    this.gemini = gemini;
    this.cryptoService = new CryptoPredictionsService();
    this.newsService = new NewsService();
  }

  /**
   * /meme - Random betting meme
   */
  async handleMeme(chatId, userId) {
    try {
      const meme = MemeService.generateTextMeme("Your Team", 2.5, "The Favorites");
      
      const text = `${BrandingService.ICONS.achievement} <b>BETRIX Meme of the Moment</b>

${MemeService.formatMeme(meme)}

😂 Too relatable? Share this with your betting crew!`;

      return this.telegram.sendMessage(chatId, text);
    } catch (err) {
      logger.error("Meme handler error", err);
      return this.telegram.sendMessage(
        chatId,
        `${BrandingService.ICONS.error} Meme engine temporarily down. Try again!`
      );
    }
  }

  /**
   * /crypto [symbol] - Crypto prediction
   */
  async handleCrypto(chatId, userId, symbol = "bitcoin") {
    try {
      const symbol_lower = (symbol || "bitcoin").toLowerCase();
      const prediction = await this.cryptoService.predictCryptoPrice(symbol_lower);

      if (!prediction) {
        return this.telegram.sendMessage(
          chatId,
          `${BrandingService.ICONS.error} <b>Crypto Not Found</b>\n\nTry: /crypto bitcoin or /crypto ethereum`
        );
      }

      const text = `${BrandingService.ICONS.special} <b>BETRIX Crypto Analysis</b>

${this.cryptoService.formatPrediction(prediction)}

💡 <i>Crypto predictions based on 24h momentum. Not financial advice.</i>`;

      return this.telegram.sendMessage(chatId, text);
    } catch (err) {
      logger.error("Crypto handler error", err);
      return this.telegram.sendMessage(
        chatId,
        `${BrandingService.ICONS.error} Unable to fetch crypto data right now.`
      );
    }
  }

  /**
   * /news - Latest sports news
   */
  async handleNews(chatId, userId, query = "football") {
    try {
      const articles = await this.newsService.getSportsNews(query || "football");

      const text = `${BrandingService.ICONS.info} <b>BETRIX Sports News</b>

${this.newsService.formatNews(articles)}

📖 Stay informed to make better betting decisions!`;

      return this.telegram.sendMessage(chatId, text);
    } catch (err) {
      logger.error("News handler error", err);
      return this.telegram.sendMessage(
        chatId,
        `${BrandingService.ICONS.error} News service temporarily unavailable.`
      );
    }
  }

  /**
   * /tip - Random betting strategy tip
   */
  async handleTip(chatId, userId) {
    try {
      const tip = ContentGenerationService.generateBettingTip();

      const text = `${BrandingService.ICONS.tips} <b>BETRIX Strategy Tip</b>

${tip}

🎯 Apply this wisdom to your next bet!`;

      return this.telegram.sendMessage(chatId, text);
    } catch (err) {
      logger.error("Tip handler error", err);
      return this.telegram.sendMessage(
        chatId,
        `${BrandingService.ICONS.error} Tip service down. Check back later!`
      );
    }
  }

  /**
   * Enhanced /menu with new commands
   */
  async enhancedMenu(chatId, userId) {
    const text = `${BrandingService.ICONS.menu} <b>BETRIX Complete Menu</b>

<b>🎮 Sports</b>
${BrandingService.ICONS.live} /live - Live matches
${BrandingService.ICONS.standings} /standings - Tables
${BrandingService.ICONS.odds} /odds - Betting odds
${BrandingService.ICONS.analyze} /analyze - Match analysis

<b>💡 Intelligence</b>
${BrandingService.ICONS.tips} /tips - Strategy tips
${BrandingService.ICONS.tips} /tip - Random tip
${BrandingService.ICONS.predict} /predict - AI prediction
${BrandingService.ICONS.insights} /insights - Personalized insights

<b>🆕 Premium Features</b>
${BrandingService.ICONS.achievement} /meme - Funny betting memes
💰 /crypto - Crypto analysis
📰 /news - Sports news
${BrandingService.ICONS.coach} /coach - Betting coach

<b>⚙️ Account</b>
${BrandingService.ICONS.status} /status - Your profile
${BrandingService.ICONS.pricing} /pricing - Plans
${BrandingService.ICONS.vvip} /vvip - Premium perks
${BrandingService.ICONS.help} /help - All commands`;

    return this.telegram.sendMessage(chatId, text);
  }

  /**
   * Enhanced /help with all commands
   */
  async enhancedHelp(chatId, userId) {
    const text = `${BrandingService.ICONS.help} <b>BETRIX Command Reference</b>

<b>Basic</b>
/start - Welcome
/menu - Main menu
/help - This list

<b>Football</b>
/live - Live now
/standings [league] - League table
/odds [match] - Betting odds
/analyze [match] - AI analysis

<b>Intelligence</b>
/predict [team1 vs team2] - Prediction
/stats - Your accuracy
/insights - Recommendations
/compete - Leaderboard

<b>Premium (VVIP)</b>
/dossier [match] - Deep analysis
/coach - Personal coach
/trends [league] - Seasonal analysis

<b>🆕 New!</b>
/meme - Funny memes
/crypto [symbol] - Bitcoin/crypto
/news - Sports headlines
/tip - Strategy tips

<b>Account</b>
/status - Profile
/pricing - Plans
/refer - Earn rewards
/language [en/sw/fr] - Language`;

    return this.telegram.sendMessage(chatId, text);
  }
}

export { NewFeaturesHandlers };
