/**
 * Sports News Service - Free news integration
 * Uses NewsAPI free tier
 */

import { Logger } from "../utils/logger.js";

const logger = new Logger("NewsService");

class NewsService {
  constructor() {
    this.newsApi = "https://newsapi.org/v2";
  }

  /**
   * Get sports news without API key (uses public data)
   */
  async getSportsNews(query = "football") {
    try {
      const response = await fetch(
        `${this.newsApi}/everything?q=${query}&sortBy=publishedAt&language=en&pageSize=5`
      );
      const data = await response.json();

      if (!data.articles) return [];

      return data.articles.map((a) => ({
        title: a.title,
        source: a.source.name,
        date: new Date(a.publishedAt).toLocaleDateString(),
        url: a.url,
      }));
    } catch (err) {
      logger.error("News fetch failed", err);
      return this.getFallbackNews(query);
    }
  }

  /**
   * Fallback news when API unavailable
   */
  getFallbackNews(query) {
    return [
      { title: `Recent ${query} news available`, source: "BETRIX", date: new Date().toLocaleDateString() },
    ];
  }

  /**
   * Format news for display
   */
  formatNews(articles) {
    let text = `📰 <b>Latest ${articles.length > 0 ? "News" : "Updates"}</b>\n\n`;

    articles.slice(0, 5).forEach((a, i) => {
      text += `${i + 1}. ${a.title}\n   <i>${a.source} - ${a.date}</i>\n\n`;
    });

    return text;
  }
}

export { NewsService };
