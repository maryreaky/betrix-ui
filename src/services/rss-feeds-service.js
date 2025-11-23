/**
 * RSS Feeds Service - Free sports news from multiple sources
 * No authentication required
 */

import { Logger } from "../utils/logger.js";

const logger = new Logger("RSSFeeds");

class RSSFeedsService {
  constructor() {
    this.feeds = {
      ESPN: "https://www.espn.com/espn/rss/news",
      BBCSport: "https://feeds.bbc.co.uk/sport/rss.xml",
      Skysports: "https://feeds.skysports.com/xml/feeds/rss/sports.xml",
      Goal: "https://www.goal.com/en-us/feeds/news",
      Foxsports: "https://www.foxsports.com/rss.xml",
    };
  }

  /**
   * Fetch RSS feed (simple text parsing)
   */
  async getFeedHeadlines(source = "ESPN", limit = 5) {
    try {
      const url = this.feeds[source];
      if (!url) return [];

      const response = await fetch(url, { timeout: 5000 });
      const text = await response.text();

      const headlines = [];
      const titleRegex = /<title>([^<]+)<\/title>/g;
      let match;
      while ((match = titleRegex.exec(text)) !== null && headlines.length < limit) {
        const title = match[1].trim();
        if (title.length > 10 && !title.includes("RSS")) {
          headlines.push(title);
        }
      }
      return headlines;
    } catch (err) {
      logger.error(`Failed to fetch ${source} feed`, err);
      return [];
    }
  }

  /**
   * Get sports headlines from all sources
   */
  async getAllHeadlines(limit = 10) {
    const allHeadlines = [];

    for (const [source] of Object.entries(this.feeds)) {
      const headlines = await this.getFeedHeadlines(source, 3);
      allHeadlines.push({
        source,
        headlines,
      });
    }

    return allHeadlines.slice(0, limit);
  }

  /**
   * Format feed for display
   */
  static formatHeadlines(headlines) {
    let text = `📡 <b>Live Sports Headlines</b>\n\n`;

    headlines.forEach(({ source, headlines: items }) => {
      if (items.length > 0) {
        text += `<b>${source}</b>\n`;
        items.forEach((h) => {
          text += `• ${h.substring(0, 60)}...\n`;
        });
        text += "\n";
      }
    });

    return text || "No headlines available";
  }
}

export { RSSFeedsService };
