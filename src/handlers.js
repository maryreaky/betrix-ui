/**
 * Comprehensive command handlers with Gemini AI integration
 * Every command has intelligent responses and fallbacks
 */

import { Logger } from "./utils/logger.js";
import { ICONS, escapeHtml, pickRandom, formatList, MEMES, STRATEGY_TIPS } from "./utils/formatters.js";
import { CONFIG } from "./config.js";

const logger = new Logger("Handlers");

class BotHandlers {
  constructor(telegram, userService, apiFootball, gemini, redis) {
    this.telegram = telegram;
    this.userService = userService;
    this.apiFootball = apiFootball;
    this.gemini = gemini;
    this.redis = redis;
  }

  // ===== START & MENU =====

  async start(chatId, userId) {
    const user = await this.userService.getUser(userId) || {};
    
    if (user?.signupComplete) {
      const welcome = await this.gemini.chat(
        `User "${user.name}" returned to BETRIX. Give a warm, personalized 1-line greeting.`,
        { user }
      );
      return this.telegram.sendMessage(
        chatId,
        `👋 <b>Welcome back!</b>\n\n${welcome}\n\n📌 Use /menu to explore.`
      );
    }

    const intro = `${ICONS.brand} <b>BETRIX — Global Sports AI</b>\n\n` +
      `Neutral analysis. No hype. Just insights.\n\n` +
      `${pickRandom(MEMES)}\n\n` +
      `<b>Get started:</b> /signup`;

    return this.telegram.sendMessage(chatId, intro);
  }

  async menu(chatId, userId) {
    const user = await this.userService.getUser(userId);
    const isVVIP = user && this.userService.isVVIP(user);

    const text =
      `${ICONS.menu} <b>BETRIX Menu</b>\n\n` +
      `${ICONS.live} /live - Live now\n` +
      `${ICONS.standings} /standings - Tables\n` +
      `${ICONS.odds} /odds - Betting odds\n` +
      `${ICONS.tips} /tips - Smart tips\n` +
      `${ICONS.analysis} /analyze - Match analysis\n` +
      `${ICONS.pricing} /pricing - Plans\n` +
      `${isVVIP ? `${ICONS.vvip} /vvip - Premium\n` : ""}` +
      `${user?.signupComplete ? `${ICONS.status} /status - Account\n` : `${ICONS.signup} /signup - Join\n`}` +
      `${ICONS.refer} /refer - Earn\n` +
      `${ICONS.help} /help - Commands`;

    const kb = {
      inline_keyboard: [
        [{ text: `${ICONS.live} Live`, callback_data: "CMD:live" }],
        [{ text: `${ICONS.standings} Standings`, callback_data: "CMD:standings" }],
        [{ text: `${ICONS.tips} Tips`, callback_data: "CMD:tips" }],
        [{ text: `${ICONS.pricing} Pricing`, callback_data: "CMD:pricing" }],
      ],
    };

    return this.telegram.sendMessage(chatId, text, { reply_markup: kb });
  }

  // ===== LIVE & STANDINGS =====

  async live(chatId, userId) {
    try {
      const data = await this.apiFootball.getLive();

      if (!data?.response?.length) {
        const msg = await this.gemini.chat("No live football matches right now. Give a friendly 2-line response.");
        return this.telegram.sendMessage(chatId, `${ICONS.live} ${msg}`);
      }

      const matches = data.response.slice(0, CONFIG.PAGE_SIZE);
      const text =
        `${ICONS.live} <b>Live Matches (${data.response.length})</b>\n\n` +
        matches
          .map((m, i) => {
            const home = escapeHtml(m.teams?.home?.name || "Home");
            const away = escapeHtml(m.teams?.away?.name || "Away");
            const hs = m.goals?.home ?? "-";
            const as = m.goals?.away ?? "-";
            const status = m.fixture?.status?.short || "LIVE";
            return `${i + 1}. ${home} <b>${hs}-${as}</b> ${away} (${status})`;
          })
          .join("\n") +
        `\n\nℹ️ Tap a match for analysis or odds.`;

      return this.telegram.sendMessage(chatId, text);
    } catch (err) {
      logger.error("Live error", err);
      const fallback = await this.gemini.chat(
        "Live match data temporarily unavailable. Give a brief, helpful 2-line response suggesting what they can do."
      );
      return this.telegram.sendMessage(chatId, `❌ ${fallback}`);
    }
  }

  async standings(chatId, league = "39") {
    try {
      const leagueId = this.apiFootball.constructor.normalizeLeague(league) || 39;
      const season = new Date().getFullYear();

      const data = await this.apiFootball.getStandings(leagueId, season);

      if (!data?.response?.[0]?.league?.standings) {
        const msg = await this.gemini.chat(`No standings for league ${leagueId}. Friendly fallback.`);
        return this.telegram.sendMessage(chatId, `${ICONS.standings} ${msg}`);
      }

      const standings = data.response[0].league.standings[0];
      const text =
        `${ICONS.standings} <b>Standings</b>\n\n` +
        standings
          .slice(0, CONFIG.MAX_TABLE_ROWS)
          .map(
            (t) =>
              `${t.rank}. ${escapeHtml(t.team?.name)} — ${t.points}pts (W${t.all?.win}-D${t.all?.draw}-L${t.all?.lose})`
          )
          .join("\n");

      return this.telegram.sendMessage(chatId, text);
    } catch (err) {
      logger.error("Standings error", err);
      return this.telegram.sendMessage(
        chatId,
        `❌ Unable to fetch standings. Try /standings epl for Premier League.`
      );
    }
  }

  // ===== ODDS & ANALYSIS =====

  async odds(chatId, fixtureId) {
    if (!fixtureId) {
      return this.telegram.sendMessage(
        chatId,
        `🎲 <b>Betting Odds</b>\n\nUsage: /odds [fixture-id]\n\nExample: /odds 123456\n\nTip: Use /live to find fixture IDs.`
      );
    }

    try {
      const data = await this.apiFootball.getOdds(fixtureId);

      if (!data?.response?.length) {
        const msg = await this.gemini.chat("No odds available for this match. Helpful fallback.");
        return this.telegram.sendMessage(chatId, `${ICONS.odds} ${msg}`);
      }

      const odds = data.response[0];
      const text =
        `${ICONS.odds} <b>Odds for ${escapeHtml(odds.fixture?.name)}</b>\n\n` +
        `🏠 Home: ${odds.bookmakers?.[0]?.bets?.[0]?.values?.[0]?.odd || "N/A"}\n` +
        `🤝 Draw: ${odds.bookmakers?.[0]?.bets?.[0]?.values?.[1]?.odd || "N/A"}\n` +
        `🏁 Away: ${odds.bookmakers?.[0]?.bets?.[0]?.values?.[2]?.odd || "N/A"}\n\n` +
        `💡 Always compare odds across bookmakers for value.`;

      return this.telegram.sendMessage(chatId, text);
    } catch (err) {
      logger.error("Odds error", err);
      return this.telegram.sendMessage(chatId, `❌ Unable to fetch odds. Try again or contact support.`);
    }
  }

  async analyze(chatId, matchQuery) {
    if (!matchQuery) {
      return this.telegram.sendMessage(
        chatId,
        `${ICONS.analysis} <b>Match Analysis</b>\n\nUsage: /analyze [home] vs [away]\n\nExample: /analyze Arsenal vs Liverpool`
      );
    }

    try {
      const analysis = await this.gemini.chat(
        `Provide neutral match analysis for: ${matchQuery}. Include: form, key players, odds, confidence. Max 300 chars.`,
        {}
      );
      return this.telegram.sendMessage(chatId, `${ICONS.analysis} <b>Analysis</b>\n\n${analysis}`);
    } catch (err) {
      logger.error("Analysis error", err);
      const fallback = await this.gemini.chat("Unable to analyze this match right now. Helpful response.");
      return this.telegram.sendMessage(chatId, `❌ ${fallback}`);
    }
  }

  // ===== TIPS & STRATEGY =====

  async tips(chatId) {
    const tip = pickRandom(STRATEGY_TIPS);
    const aiTip = await this.gemini.chat(
      `Expand this tip into 2-3 lines: "${tip}". Make it actionable.`,
      {}
    );

    const text = `${ICONS.tips} <b>Smart Betting Tips</b>\n\n${aiTip}\n\n💡 Process over luck. Every day.`;
    return this.telegram.sendMessage(chatId, text);
  }

  // ===== PRICING & ACCOUNT =====

  async pricing(chatId) {
    const text =
      `${ICONS.pricing} <b>BETRIX Pricing</b>\n\n` +
      `📝 <b>Member Signup</b>\n` +
      `KES ${CONFIG.PRICING.SIGNUP_FEE.KES} / USD ${CONFIG.PRICING.SIGNUP_FEE.USD}\n` +
      `✓ Member-only features\n\n` +
      `${ICONS.vvip} <b>VVIP Tiers</b>\n` +
      `💎 Daily: KES ${CONFIG.PRICING.VVIP.DAILY.KES} / USD ${CONFIG.PRICING.VVIP.DAILY.USD}\n` +
      `💎 Weekly: KES ${CONFIG.PRICING.VVIP.WEEKLY.KES} / USD ${CONFIG.PRICING.VVIP.WEEKLY.USD}\n` +
      `💎 Monthly: KES ${CONFIG.PRICING.VVIP.MONTHLY.KES} / USD ${CONFIG.PRICING.VVIP.MONTHLY.USD}\n\n` +
      `✓ Live analysis\n✓ AI predictions\n✓ Expert odds\n✓ Priority support`;

    const kb = {
      inline_keyboard: [
        [{ text: "💳 Get VVIP", callback_data: "CMD:subscribe" }],
        [{ text: "📝 Become Member", callback_data: "CMD:signup" }],
      ],
    };

    return this.telegram.sendMessage(chatId, text, { reply_markup: kb });
  }

  async status(chatId, userId) {
    const user = await this.userService.getUser(userId);

    if (!user?.signupComplete) {
      return this.telegram.sendMessage(chatId, `Not a member yet. Use /signup to join BETRIX.`);
    }

    const isVVIP = this.userService.isVVIP(user);
    const text =
      `${ICONS.status} <b>Your Account</b>\n\n` +
      `👤 Name: ${escapeHtml(user.name || "N/A")}\n` +
      `🌍 Country: ${escapeHtml(user.country || "N/A")}\n` +
      `📊 Role: ${user.role === "vvip" ? "💎 VVIP" : "👤 Member"}\n` +
      `${isVVIP ? `⏰ Expires: ${new Date(user.vvip_expires_at).toLocaleDateString()}\n` : ""}` +
      `${user.referral_code ? `👥 Referral: ${user.referral_code}\n` : ""}` +
      `🏆 Points: ${user.rewards_points || 0}`;

    return this.telegram.sendMessage(chatId, text);
  }

  // ===== REFERRALS & REWARDS =====

  async refer(chatId, userId) {
    const code = await this.userService.getOrCreateReferralCode(userId);
    const text =
      `${ICONS.refer} <b>Earn Rewards</b>\n\n` +
      `Share your code: <code>${escapeHtml(code)}</code>\n\n` +
      `💰 +10 points per referral\n` +
      `🎁 Get 50 points = 1 month free VVIP\n\n` +
      `Use: /refer [send code to friends]`;

    return this.telegram.sendMessage(chatId, text);
  }

  async leaderboard(chatId) {
    try {
      const leaders = await this.userService.getLeaderboard("referrals", 5);

      if (!leaders.length) {
        return this.telegram.sendMessage(
          chatId,
          `${ICONS.leaderboard} <b>Top Referrers</b>\n\nLeaderboard loading... Share your code to start earning!`
        );
      }

      const text =
        `${ICONS.leaderboard} <b>Top Referrers</b>\n\n` +
        leaders.map((u, i) => `${i + 1}. ${escapeHtml(u.name)} — ${u.score} pts`).join("\n") +
        `\n\n${ICONS.refer} Use /refer to climb!`;

      return this.telegram.sendMessage(chatId, text);
    } catch (err) {
      logger.error("Leaderboard error", err);
      return this.telegram.sendMessage(chatId, `Unable to load leaderboard. Try again later.`);
    }
  }

  // ===== HELP & INFO =====

  async help(chatId) {
    const text =
      `${ICONS.help} <b>BETRIX Commands</b>\n\n` +
      `${ICONS.live} /live - Live matches\n` +
      `${ICONS.standings} /standings - League tables\n` +
      `${ICONS.odds} /odds [id] - Betting odds\n` +
      `${ICONS.analysis} /analyze [match] - AI analysis\n` +
      `${ICONS.tips} /tips - Strategy tips\n` +
      `${ICONS.pricing} /pricing - Plans\n` +
      `${ICONS.status} /status - Account\n` +
      `${ICONS.refer} /refer - Earn rewards\n` +
      `${ICONS.leaderboard} /leaderboard - Top earners\n\n` +
      `💬 Or just chat with me naturally!`;

    return this.telegram.sendMessage(chatId, text);
  }

  async about(chatId) {
    const text =
      `${ICONS.about} <b>About BETRIX</b>\n\n` +
      `Global multi-sport AI platform.\n` +
      `Neutral analysis. Data-driven insights.\n\n` +
      `📊 12+ sports\n💎 AI-powered\n🌍 Global coverage\n` +
      `👥 Community rewards\n\n` +
      `${pickRandom(MEMES)}`;

    return this.telegram.sendMessage(chatId, text);
  }

  // ===== SIGNUP & ACCOUNT CREATION =====

  async signup(chatId, userId) {
    const user = await this.userService.getUser(userId);

    if (user?.signupComplete) {
      return this.telegram.sendMessage(chatId, `You're already a member! Use /status to view your account.`);
    }

    const text =
      `${ICONS.signup} <b>Welcome to BETRIX</b>\n\n` +
      `Quick setup (2 minutes):\n\n` +
      `1️⃣ Your first name?\n2️⃣ Your country?\n3️⃣ Payment method\n\n` +
      `Type your first name to begin:`;

    await this.telegram.sendMessage(chatId, text);
    await this.redis.set(`signup:${userId}:state`, "name", "EX", 300);
  }

  // ===== NATURAL LANGUAGE FALLBACK =====

  async chat(chatId, userId, message) {
    const user = await this.userService.getUser(userId);
    const context = user || {};

    try {
      const response = await this.gemini.chat(message, context);
      return this.telegram.sendMessage(chatId, response);
    } catch (err) {
      logger.error("Chat error", err);
      const fallback = this.gemini.fallbackResponse(message, context);
      return this.telegram.sendMessage(chatId, fallback);
    }
  }
}

export { BotHandlers };
