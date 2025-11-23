/**
 * Reddit Sports Service - Trending sports discussions
 * Free public Reddit data (no auth required)
 */

import { Logger } from "../utils/logger.js";

const logger = new Logger("RedditSports");

class RedditSportsService {
  constructor() {
    this.subreddits = [
      "sports",
      "football",
      "soccer",
      "nba",
      "nfl",
      "premierleague",
      "sportsbetting",
    ];
  }

  /**
   * Get trending posts from Reddit subreddit
   */
  async getTrendingPosts(subreddit = "sports", limit = 5) {
    try {
      const url = `https://www.reddit.com/r/${subreddit}/hot.json?limit=${limit}`;
      const response = await fetch(url, {
        headers: { "User-Agent": "BETRIX Sports Bot" },
      });
      const data = await response.json();

      if (!data.data?.children) return [];

      return data.data.children.map((post) => ({
        title: post.data.title,
        score: post.data.score,
        comments: post.data.num_comments,
        url: `https://reddit.com${post.data.permalink}`,
      }));
    } catch (err) {
      logger.error(`Reddit fetch failed for r/${subreddit}`, err);
      return [];
    }
  }

  /**
   * Get all trending sports discussions
   */
  async getAllTrending(limit = 15) {
    const allPosts = [];

    for (const sub of this.subreddits) {
      const posts = await this.getTrendingPosts(sub, 2);
      if (posts.length > 0) {
        allPosts.push({ subreddit: sub, posts });
      }
    }

    return allPosts.slice(0, limit);
  }

  /**
   * Format Reddit discussions
   */
  static formatDiscussions(discussions) {
    let text = `💬 <b>Reddit Sports Trends</b>\n\n`;

    discussions.forEach(({ subreddit, posts }) => {
      text += `<b>r/${subreddit}</b> (Trending)\n`;
      posts.forEach((p) => {
        text += `▸ ${p.title.substring(0, 50)}...\n  👍 ${p.score} | 💬 ${p.comments}\n`;
      });
      text += "\n";
    });

    return text || "No Reddit discussions available";
  }
}

export { RedditSportsService };
