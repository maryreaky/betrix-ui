#!/usr/bin/env node

/**
 * BETRIX Modern Worker
 * Refactored with modular architecture, better error handling, and clean code
 */

import Redis from "ioredis";
import { CONFIG, validateConfig } from "./config.js";
import { Logger } from "./utils/logger.js";
import { TelegramService } from "./services/telegram.js";
import { UserService } from "./services/user.js";
import { APIFootballService } from "./services/api-football.js";

const logger = new Logger("Worker");

// Validate configuration
try {
  validateConfig();
  logger.info("Configuration validated");
} catch (err) {
  logger.error("Configuration validation failed", err);
  process.exit(1);
}

// Initialize Redis
const redis = new Redis(CONFIG.REDIS_URL);
redis.on("error", err => logger.error("Redis error", err));
redis.on("connect", () => logger.info("Redis connected"));

// Initialize services
const telegram = new TelegramService(CONFIG.TELEGRAM_TOKEN, CONFIG.TELEGRAM.SAFE_CHUNK);
const userService = new UserService(redis);
const apiFootball = new APIFootballService(redis);

logger.info("All services initialized");

/**
 * Main worker loop
 * Processes Telegram updates from Redis queue
 */
async function main() {
  logger.info("🚀 BETRIX Worker started");

  while (true) {
    try {
      // Pop update from queue
      const update = await redis.lpop("telegram:updates");
      if (!update) {
        await new Promise(r => setTimeout(r, 100));
        continue;
      }

      const data = JSON.parse(update);
      await handleUpdate(data);
    } catch (err) {
      logger.error("Worker error", err);
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

/**
 * Handle Telegram update
 */
async function handleUpdate(update) {
  try {
    // Handle message
    if (update.message) {
      const { chat, from, text } = update.message;
      const userId = from.id;
      const chatId = chat.id;

      logger.info(`Message from ${userId}: ${text}`);

      // Parse command
      const { cmd, args } = parseCommand(text);

      // Route to handler
      await handleCommand(chatId, userId, cmd, args);
    }

    // Handle callback query (inline button)
    if (update.callback_query) {
      const { id: callbackId, from, data } = update.callback_query;
      const userId = from.id;
      const chatId = update.callback_query.message.chat.id;

      logger.info(`Callback from ${userId}: ${data}`);

      await telegram.answerCallback(callbackId, "Processing...");
      await handleCallback(chatId, userId, data);
    }
  } catch (err) {
    logger.error("Handle update failed", err);
  }
}

/**
 * Parse command from text
 */
function parseCommand(text) {
  const normalized = String(text).trim().toLowerCase();
  const parts = normalized.split(/\s+/);
  const rawCmd = parts[0];
  const cmd = rawCmd.replace(/@[\w_]+$/, "");
  const args = parts.slice(1);
  return { cmd, args };
}

/**
 * Command handlers
 */
async function handleCommand(chatId, userId, cmd, args) {
  try {
    // Free commands (no subscription required)
    if (cmd === "/start") {
      return handleStart(chatId, userId);
    }

    if (cmd === "/menu") {
      return handleMenu(chatId, userId);
    }

    if (cmd === "/help") {
      return handleHelp(chatId);
    }

    if (cmd === "/pricing") {
      return handlePricing(chatId);
    }

    if (cmd === "/live") {
      return handleLive(chatId, args[0]);
    }

    if (cmd === "/standings") {
      return handleStandings(chatId, args[0]);
    }

    if (cmd === "/signup") {
      return handleSignup(chatId, userId);
    }

    // Unknown command
    await telegram.sendMessage(chatId, "❓ Unknown command. Try /help or /menu");
  } catch (err) {
    logger.error(`Command ${cmd} failed`, err);
    await telegram.sendMessage(chatId, `❌ Error: ${err.message}`);
  }
}

/**
 * Callback handlers
 */
async function handleCallback(chatId, userId, data) {
  // Parse callback data format: ACTION:param1:param2
  const parts = data.split(":");
  const action = parts[0];

  try {
    if (action === "SHOW_MENU") {
      return handleMenu(chatId, userId);
    }

    if (action === "SHOW_SIGNUP") {
      return handleSignup(chatId, userId);
    }

    logger.warn(`Unknown callback action: ${action}`);
  } catch (err) {
    logger.error(`Callback ${action} failed`, err);
  }
}

// ===== Command Implementations =====

/**
 * /start - Welcome and signup flow
 */
async function handleStart(chatId, userId) {
  const user = await userService.getUser(userId);

  if (user?.signupComplete) {
    const text = `👋 Welcome back, ${user.name || "User"}!\n\n` +
      `You're all set. Use /menu to see available commands.`;
    await telegram.sendMessage(chatId, text);
  } else {
    const text = `🚀 <b>Welcome to BETRIX</b>\n\n` +
      `Your neutral AI sports analyst. No hype, just insights.\n\n` +
      `Get started: /signup`;
    await telegram.sendMessage(chatId, text);
  }
}

/**
 * /menu - Main menu
 */
async function handleMenu(chatId, userId) {
  const user = await userService.getUser(userId);
  const isVVIP = user && userService.isVVIP(user);

  const text = `${"🧭"} <b>BETRIX Menu</b>\n\n` +
    `<b>Free Commands:</b>\n` +
    `/live - Live matches now\n` +
    `/ standings - League standings\n` +
    `/pricing - View our plans\n` +
    `${isVVIP ? `/vvip - Your VVIP content\n` : ""}\n` +
    `<b>Account:</b>\n` +
    `${user?.signupComplete ? `/status - Your account\n` : "/signup - Create account\n"}` +
    `<b>Support:</b>\n` +
    `/help - Commands\n` +
    `/contact - Get help`;

  const kb = {
    inline_keyboard: [
      [{ text: "🔴 Live Matches", callback_data: "CMD:live" }],
      [{ text: "📊 Standings", callback_data: "CMD:standings" }],
      [{ text: "💵 Pricing", callback_data: "CMD:pricing" }],
    ],
  };

  await telegram.sendMessage(chatId, text, { reply_markup: kb });
}

/**
 * /help - Help and commands
 */
async function handleHelp(chatId) {
  const text = `📚 <b>BETRIX Commands</b>\n\n` +
    `<b>Matches & Data:</b>\n` +
    `/live - Live matches\n` +
    `/standings [league] - League table\n` +
    `/fixtures [league] - Upcoming matches\n\n` +
    `<b>Premium:</b>\n` +
    `/pricing - Subscription plans\n` +
    `/subscribe - Get VVIP\n\n` +
    `<b>Account:</b>\n` +
    `/status - Your account info\n` +
    `/signup - New account\n\n` +
    `<b>Support:</b>\n` +
    `/contact - Help & support`;

  await telegram.sendMessage(chatId, text);
}

/**
 * /pricing - Show pricing tiers
 */
async function handlePricing(chatId) {
  const text = `💵 <b>BETRIX Pricing</b>\n\n` +
    `<b>Member Signup</b>\n` +
    `KES ${CONFIG.PRICING.SIGNUP_FEE.KES} / USD ${CONFIG.PRICING.SIGNUP_FEE.USD}\n` +
    `Access to Member-only features\n\n` +
    `<b>VVIP Tiers</b>\n` +
    `💎 Daily: KES ${CONFIG.PRICING.VVIP.DAILY.KES} / USD ${CONFIG.PRICING.VVIP.DAILY.USD}\n` +
    `💎 Weekly: KES ${CONFIG.PRICING.VVIP.WEEKLY.KES} / USD ${CONFIG.PRICING.VVIP.WEEKLY.USD}\n` +
    `💎 Monthly: KES ${CONFIG.PRICING.VVIP.MONTHLY.KES} / USD ${CONFIG.PRICING.VVIP.MONTHLY.USD}\n\n` +
    `<b>What's Included:</b>\n` +
    `✓ Live match analysis\n` +
    `✓ AI predictions\n` +
    `✓ Betting odds\n` +
    `✓ Expert tips`;

  await telegram.sendMessage(chatId, text);
}

/**
 * /live - Show live matches
 */
async function handleLive(chatId, league = null) {
  try {
    const data = await apiFootball.getLive();

    if (!data.response || !data.response.length) {
      return await telegram.sendMessage(chatId, "⚽ No live matches right now.");
    }

    const matches = data.response.slice(0, CONFIG.PAGE_SIZE);
    const text = `🔴 <b>Live Matches (${data.response.length} total)</b>\n\n` +
      matches.map((m, i) => {
        const home = m.teams?.home?.name || "Home";
        const away = m.teams?.away?.name || "Away";
        const hs = m.goals?.home ?? "-";
        const as = m.goals?.away ?? "-";
        return `${i + 1}. ${home} ${hs}-${as} ${away}`;
      }).join("\n");

    await telegram.sendMessage(chatId, text);
  } catch (err) {
    logger.error("Live matches error", err);
    await telegram.sendMessage(chatId, `❌ Could not fetch live matches: ${err.message}`);
  }
}

/**
 * /standings - Show league standings
 */
async function handleStandings(chatId, league = "39") {
  try {
    const leagueId = APIFootballService.normalizeLeague(league) || 39;
    const season = new Date().getFullYear();

    const data = await apiFootball.getStandings(leagueId, season);

    if (!data.response || !data.response.length) {
      return await telegram.sendMessage(chatId, "📊 No standings data available.");
    }

    const standings = data.response[0]?.league?.standings?.[0] || [];
    const text = `📊 <b>League Standings</b>\n\n` +
      standings.slice(0, CONFIG.MAX_TABLE_ROWS).map(t => {
        const rank = t.rank || "-";
        const name = t.team?.name || "Team";
        const pts = t.points || 0;
        return `${rank}. ${name} - ${pts}pts`;
      }).join("\n");

    await telegram.sendMessage(chatId, text);
  } catch (err) {
    logger.error("Standings error", err);
    await telegram.sendMessage(chatId, `❌ Could not fetch standings: ${err.message}`);
  }
}

/**
 * /signup - User signup flow
 */
async function handleSignup(chatId, userId) {
  const text = `📝 <b>Create Your Account</b>\n\n` +
    `Let's get you set up with BETRIX.\n\n` +
    `Reply with your name to continue.`;

  await telegram.sendMessage(chatId, text);
  // Store state in Redis for next message
  await redis.set(`signup:${userId}:state`, "name", "EX", 300);
}

/**
 * Error handler
 */
process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled rejection", { reason, promise });
});

process.on("uncaughtException", err => {
  logger.error("Uncaught exception", err);
  process.exit(1);
});

// Start worker
main().catch(err => {
  logger.error("Fatal error", err);
  process.exit(1);
});
