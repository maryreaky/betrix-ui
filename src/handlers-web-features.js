/**
 * BETRIX Web Features Handlers
 * RSS, Reddit, Weather, Trivia, Sentiment, Stadiums, Commentary, Fixtures, Trending
 */

import { Logger } from "./utils/logger.js";
import { RSSFeedsService } from "./services/rss-feeds-service.js";
import { RedditSportsService } from "./services/reddit-sports-service.js";
import { WeatherService } from "./services/weather-service.js";
import { SportsTriviaService } from "./services/sports-trivia-service.js";
import { SocialSentimentService } from "./services/social-sentiment-service.js";
import { StadiumInfoService } from "./services/stadium-info-service.js";
import { LiveCommentaryService } from "./services/live-commentary-service.js";
import { FixtureTrackerService } from "./services/fixture-tracker-service.js";
import { TrendingBetsService } from "./services/trending-bets-service.js";
import { BrandingService } from "./services/branding-service.js";

const logger = new Logger("WebFeatures");

class WebFeaturesHandlers {
  constructor(telegram) {
    this.telegram = telegram;
    this.rssService = new RSSFeedsService();
    this.redditService = new RedditSportsService();
    this.weatherService = new WeatherService();
    this.triviaService = SportsTriviaService;
    this.sentimentService = SocialSentimentService;
    this.stadiumService = StadiumInfoService;
    this.commentaryService = LiveCommentaryService;
    this.fixtureService = FixtureTrackerService;
    this.trendingService = TrendingBetsService;
  }

  /**
   * /headlines - RSS sports headlines
   */
  async handleHeadlines(chatId) {
    try {
      const headlines = await this.rssService.getAllHeadlines(10);
      const text = `${BrandingService.ICONS.info} ${RSSFeedsService.formatHeadlines(headlines)}`;
      return this.telegram.sendMessage(chatId, text);
    } catch (err) {
      logger.error("Headlines error", err);
      return this.telegram.sendMessage(
        chatId,
        `${BrandingService.ICONS.error} Could not fetch headlines right now.`
      );
    }
  }

  /**
   * /reddit - Reddit sports trending
   */
  async handleReddit(chatId) {
    try {
      const discussions = await this.redditService.getAllTrending();
      const text = `${BrandingService.ICONS.share} ${RedditSportsService.formatDiscussions(discussions)}`;
      return this.telegram.sendMessage(chatId, text);
    } catch (err) {
      logger.error("Reddit error", err);
      return this.telegram.sendMessage(
        chatId,
        `${BrandingService.ICONS.error} Reddit service temporarily down.`
      );
    }
  }

  /**
   * /trending - What's trending on social media
   */
  async handleTrending(chatId) {
    const text = `${BrandingService.ICONS.share} ${SocialSentimentService.formatTrending()}`;
    return this.telegram.sendMessage(chatId, text);
  }

  /**
   * /quote - Inspirational sports quote
   */
  async handleQuote(chatId) {
    const text = `${BrandingService.ICONS.tips} ${this.triviaService.formatQuote()}`;
    return this.telegram.sendMessage(chatId, text);
  }

  /**
   * /fact - Sports trivia fact
   */
  async handleFact(chatId) {
    const text = `${BrandingService.ICONS.info} ${this.triviaService.formatFact()}`;
    return this.telegram.sendMessage(chatId, text);
  }

  /**
   * /betting_fact - Betting strategy fact
   */
  async handleBettingFact(chatId) {
    const text = `${BrandingService.ICONS.tips} ${this.triviaService.formatBettingFact()}`;
    return this.telegram.sendMessage(chatId, text);
  }

  /**
   * /stadium [name] - Stadium information
   */
  async handleStadium(chatId, name = "Old Trafford") {
    try {
      const text = `${BrandingService.ICONS.info} ${StadiumInfoService.formatStadium(name)}`;
      return this.telegram.sendMessage(chatId, text);
    } catch (err) {
      logger.error("Stadium error", err);
      return this.telegram.sendMessage(
        chatId,
        `${BrandingService.ICONS.error} Stadium not found. Try: /stadium "Old Trafford"`
      );
    }
  }

  /**
   * /live_commentary [team1] [team2] - Simulated live match commentary
   */
  async handleLiveCommentary(chatId, team1 = "Manchester United", team2 = "Liverpool") {
    const text = `${BrandingService.ICONS.live} ${LiveCommentaryService.generateLiveUpdate(team1, team2, 1, 0)}`;
    return this.telegram.sendMessage(chatId, text);
  }

  /**
   * /fixtures - Upcoming big fixtures
   */
  async handleFixtures(chatId) {
    const fixtures = this.fixtureService.getUpcomingFixtures();
    const text = `${BrandingService.ICONS.live} ${FixtureTrackerService.formatAllFixtures(fixtures)}`;
    return this.telegram.sendMessage(chatId, text);
  }

  /**
   * /trending_bets - Popular bet types
   */
  async handleTrendingBets(chatId) {
    const text = `${BrandingService.ICONS.odds} ${TrendingBetsService.formatTrending()}`;
    return this.telegram.sendMessage(chatId, text);
  }

  /**
   * /bet_recommendation - Recommended bet type
   */
  async handleBetRecommendation(chatId) {
    const text = `${BrandingService.ICONS.odds} ${TrendingBetsService.formatRecommendation()}`;
    return this.telegram.sendMessage(chatId, text);
  }
}

export { WebFeaturesHandlers };
