/**
 * Crypto Predictions Service - Free crypto analysis
 * Uses CoinGecko free API (no auth required)
 */

import { Logger } from "../utils/logger.js";

const logger = new Logger("CryptoPredictions");

class CryptoPredictionsService {
  constructor() {
    this.coingeckoBase = "https://api.coingecko.com/api/v3";
  }

  /**
   * Get crypto price and predict trend
   */
  async predictCryptoPrice(symbol) {
    try {
      const response = await fetch(
        `${this.coingeckoBase}/simple/price?ids=${symbol}&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true`
      );
      const data = await response.json();

      if (!data[symbol]) return null;

      const price = data[symbol].usd;
      const change24h = data[symbol].usd_24h_change;

      return {
        symbol,
        price,
        change24h,
        trend: change24h > 0 ? "🟢 UP" : "🔴 DOWN",
        prediction: this.getPrediction(change24h),
        confidence: Math.min(Math.abs(change24h / 5) + 50, 95),
      };
    } catch (err) {
      logger.error("Crypto prediction failed", err);
      return null;
    }
  }

  /**
   * Get prediction based on 24h change
   */
  getPrediction(change24h) {
    if (change24h > 10) {
      return "🚀 Strong momentum UP - might cool off soon (mean reversion)";
    } else if (change24h > 5) {
      return "📈 Bullish momentum - good trend";
    } else if (change24h > 0) {
      return "🟢 Slight UP - neutral signal";
    } else if (change24h > -5) {
      return "🔴 Slight DOWN - possible bounce";
    } else if (change24h > -10) {
      return "📉 Bearish momentum - reversal possible";
    } else {
      return "💥 Heavy selling - might stabilize soon";
    }
  }

  /**
   * Get top gainers
   */
  async getTopGainers() {
    try {
      const response = await fetch(
        `${this.coingeckoBase}/coins/markets?vs_currency=usd&order=24h_change_desc&per_page=5&sparkline=false`
      );
      const coins = await response.json();

      return coins.map((c) => ({
        name: c.name,
        symbol: c.symbol.toUpperCase(),
        change: c.market_cap_change_percentage_24h || 0,
        price: c.current_price,
      }));
    } catch (err) {
      logger.error("Get gainers failed", err);
      return [];
    }
  }

  /**
   * Format prediction for display
   */
  formatPrediction(pred) {
    if (!pred) return "Unable to fetch crypto data";

    return `💰 <b>${pred.symbol.toUpperCase()}</b>

Price: $${pred.price.toFixed(2)}
24h Change: ${pred.trend} ${pred.change24h.toFixed(2)}%

📊 Prediction: ${pred.prediction}
🎯 Confidence: ${pred.confidence.toFixed(0)}%`;
  }
}

export { CryptoPredictionsService };
