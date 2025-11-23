#!/usr/bin/env node

/**
 * BETRIX Complete Production Worker
 * Full integration with tier-aware handlers and UI
 */

import Redis from "ioredis";
import { CONFIG, validateConfig } from "./config.js";
import { Logger } from "./utils/logger.js";
import { TelegramService } from "./services/telegram.js";
import { UserService } from "./services/user.js";
import { APIFootballService } from "./services/api-football.js";
import { GeminiService } from "./services/gemini.js";
import { BotHandlers } from "./handlers.js";
import { AdvancedHandler } from "./advanced-handler.js";
import { PremiumService } from "./services/premium.js";
import { AdminDashboard } from "./admin/dashboard.js";
import { AnalyticsService } from "./services/analytics.js";
import { SubscriptionGatekeeper } from "./middleware/subscription-gatekeeper.js";
import { TierAwareHandlers } from "./handlers-tier.js";
import { UIBuilder } from "./utils/ui-builder.js";
import { PaymentPresenter } from "./utils/payment-presenter.js";
import { SafaricomTillService } from "./services/safaricom-till.js";
import { RateLimiter } from "./middleware/rate-limiter.js";
import { ContextManager } from "./middleware/context-manager.js";

const logger = new Logger("CompleteWorker");

try {
  validateConfig();
  logger.info("✅ Configuration validated");
} catch (err) {
  logger.error("Configuration failed", err);
  process.exit(1);
}

const redis = new Redis(CONFIG.REDIS_URL);
redis.on("error", err => logger.error("Redis error", err));
redis.on("connect", () => logger.info("✅ Redis connected"));

// Initialize all services
const telegram = new TelegramService(CONFIG.TELEGRAM_TOKEN, CONFIG.TELEGRAM.SAFE_CHUNK);
const userService = new UserService(redis);
const apiFootball = new APIFootballService(redis);
const gemini = new GeminiService(CONFIG.GEMINI.API_KEY);
const analytics = new AnalyticsService(redis);
const gatekeeper = new SubscriptionGatekeeper(userService, telegram);
const basicHandlers = new BotHandlers(telegram, userService, apiFootball, gemini, redis);
const advancedHandler = new AdvancedHandler(basicHandlers, redis, telegram, userService, gemini);
const premiumService = new PremiumService(redis, gemini);
const adminDashboard = new AdminDashboard(redis, telegram, analytics);
const tierHandlers = new TierAwareHandlers(basicHandlers, gatekeeper, userService);

logger.info("🚀 BETRIX Complete Worker - All Services Initialized");

async function main() {
  logger.info("🌟 BETRIX Worker started - waiting for Telegram updates");

  while (true) {
    try {
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

async function handleUpdate(update) {
  try {
    if (update.message) {
      const { chat, from, text } = update.message;
      const userId = from.id;
      const chatId = chat.id;

      // Check suspension
      if (await adminDashboard.isUserSuspended(userId)) {
        return await telegram.sendMessage(chatId, "⛔ Your account has been suspended.");
      }

      // Track engagement
      await analytics.trackEngagement(userId, "message");

      // Check signup flow
      const signupState = await redis.get(`signup:${userId}:state`);
      if (signupState) {
        return await handleSignupFlow(chatId, userId, text, signupState);
      }

      // Parse and route
      const { cmd, args } = parseCommand(text);

      if (cmd.startsWith("/")) {
        await handleCommand(chatId, userId, cmd, args, text);
      } else {
        // Natural language
        const user = await userService.getUser(userId);
        const response = await gemini.chat(text, user || {});
        await telegram.sendMessage(chatId, response);
      }
    }

    if (update.callback_query) {
      const { id: callbackId, from, data } = update.callback_query;
      const userId = from.id;
      const chatId = update.callback_query.message.chat.id;

      await telegram.answerCallback(callbackId, "⏳ Processing...");
      await handleCallback(chatId, userId, data);
    }
  } catch (err) {
    logger.error("Update error", err);
  }
}

function parseCommand(text) {
  const normalized = String(text).trim().toLowerCase();
  const parts = normalized.split(/\s+/);
  const cmd = parts[0].replace(/@[\w_]+$/, "");
  const args = parts.slice(1);
  return { cmd, args };
}

async function handleCommand(chatId, userId, cmd, args, fullText) {
  try {
    const user = await userService.getUser(userId) || {};
    const tier = await gatekeeper.getUserTier(userId);
    const isAdmin = userId === parseInt(CONFIG.TELEGRAM.ADMIN_ID);

    // Basic commands (no tier restriction)
    const basicCommands = {
      "/start": () => basicHandlers.start(chatId, userId),
      "/menu": async () => {
        const kb = UIBuilder.buildMainMenu(tier);
        return telegram.sendMessage(chatId, `🧭 <b>BETRIX Menu</b>`, { reply_markup: kb });
      },
      "/help": () => basicHandlers.help(chatId),
      "/live": () => tierHandlers.liveWithTier(chatId, userId),
      "/standings": () => tierHandlers.standingsWithTier(chatId, userId, args[0]),
      "/odds": () => tierHandlers.oddsWithTier(chatId, userId, args[0]),
      "/tips": () => basicHandlers.tips(chatId),
      "/pricing": async () => {
        const text = PaymentPresenter.formatTierComparison();
        const kb = UIBuilder.buildSubscriptionMenu();
        return telegram.sendMessage(chatId, text, { reply_markup: kb });
      },
      "/status": () => tierHandlers.showTierMenu(chatId, userId),
      "/features": () => tierHandlers.showFeatures(chatId, userId),
      "/refer": () => basicHandlers.refer(chatId, userId),
      "/leaderboard": () => basicHandlers.leaderboard(chatId),
      "/signup": () => basicHandlers.signup(chatId, userId),
    };

    // Tier-restricted commands
    const tierCommands = {
      "/analyze": () => tierHandlers.analysisWithTier(chatId, userId, args.join(" ")),
      "/predict": () => tierHandlers.predictionsWithTier(chatId, userId, args.join(" ")),
      "/stats": () => advancedHandler.handleStats(chatId, userId),
      "/insights": () => advancedHandler.handleInsights(chatId, userId),
      "/compete": () => advancedHandler.handleCompete(chatId, userId),
      "/dossier": () => tierHandlers.dossierWithTier(chatId, userId, args.join(" ")),
      "/coach": () => tierHandlers.coachWithTier(chatId, userId),
      "/trends": () => tierHandlers.trendsWithTier(chatId, userId, args[0]),
    };

    // Admin commands
    const adminCommands = {
      "/admin_health": () => adminDashboard.sendHealthReport(chatId),
      "/admin_broadcast": () => adminDashboard.broadcastMessage(args.join(" ")).then(sent =>
        telegram.sendMessage(chatId, `📢 Broadcast sent to ${sent} users`)
      ),
      "/admin_users": async () => {
        const stats = await adminDashboard.getUserStats();
        return telegram.sendMessage(chatId, 
          `👥 Total: ${stats.total}, Active: ${stats.active}, Paid: ${stats.paid}`
        );
      },
    };

    // Route to handler
    if (basicCommands[cmd]) {
      return await basicCommands[cmd]();
    } else if (tierCommands[cmd]) {
      return await tierCommands[cmd]();
    } else if (adminCommands[cmd] && isAdmin) {
      return await adminCommands[cmd]();
    } else {
      // Unknown - use Gemini
      await basicHandlers.chat(chatId, userId, fullText);
    }

    const duration = 0;
    await analytics.trackCommand(cmd, userId, duration);
  } catch (err) {
    logger.error(`Command ${cmd} failed`, err);
    await telegram.sendMessage(chatId, "❌ Error processing command. Try /menu");
  }
}

async function handleCallback(chatId, userId, data) {
  const [action, ...params] = data.split(":");
  try {
    const tier = await gatekeeper.getUserTier(userId);

    const callbacks = {
      "menu:live": () => tierHandlers.liveWithTier(chatId, userId),
      "menu:standings": () => tierHandlers.standingsWithTier(chatId, userId),
      "menu:odds": () => tierHandlers.oddsWithTier(chatId, userId, ""),
      "menu:tips": () => basicHandlers.tips(chatId),
      "menu:analysis": () => tierHandlers.analysisWithTier(chatId, userId, ""),
      "menu:predict": () => tierHandlers.predictionsWithTier(chatId, userId, ""),
      "menu:premium": () => tierHandlers.showFeatures(chatId, userId),
      "menu:account": () => tierHandlers.showTierMenu(chatId, userId),
      "menu:settings": () => tierHandlers.showFeatures(chatId, userId),
      "show:subscription": async () => {
        const text = PaymentPresenter.formatTierComparison();
        const kb = UIBuilder.buildSubscriptionMenu();
        return telegram.sendMessage(chatId, text, { reply_markup: kb });
      },
      "show:features": () => tierHandlers.showFeatures(chatId, userId),
    };

    if (callbacks[data]) return await callbacks[data]();
  } catch (err) {
    logger.error(`Callback ${data} failed`, err);
  }
}

async function handleSignupFlow(chatId, userId, text, state) {
  try {
    if (state === "name") {
      await userService.saveUser(userId, { name: text });
      await redis.set(`signup:${userId}:state`, "country", "EX", 300);
      return await telegram.sendMessage(chatId, `Nice to meet you, ${text}! 👋\n\nWhich country are you from?`);
    }

    if (state === "country") {
      const user = await userService.saveUser(userId, { country: text });
      await userService.getOrCreateReferralCode(userId);
      await userService.saveUser(userId, { signupComplete: true });
      await redis.del(`signup:${userId}:state`);
      await analytics.trackEngagement(userId, "signup");

      const welcome = `✅ Welcome to BETRIX, ${user.name}!\n\n` +
        `You're all set. Here's what's next:\n\n` +
        `💬 /menu - Explore all features\n` +
        `💵 /pricing - View our plans\n` +
        `👥 /refer - Earn rewards\n\n` +
        `💡 Or just chat naturally about football!`;

      return await telegram.sendMessage(chatId, welcome);
    }
  } catch (err) {
    logger.error("Signup error", err);
    await telegram.sendMessage(chatId, "Signup error. Try /signup again.");
  }
}

process.on("SIGINT", async () => {
  logger.info("Shutting down...");
  await redis.quit();
  process.exit(0);
});

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled rejection", reason);
});

process.on("uncaughtException", (err) => {
  logger.error("Uncaught exception", err);
  process.exit(1);
});

main().catch(err => {
  logger.error("Fatal", err);
  process.exit(1);
});

// Additional Till Payment Handler
async function handleTillPayment(chatId, userId, tier, amount) {
  try {
    const till = new SafaricomTillService(redis, CONFIG);
    const instructions = till.getTillPaymentInstructions(amount, tier);
    const ref = await till.recordTillPayment(userId, amount, tier);
    
    await telegram.sendMessage(chatId, instructions);
    
    setTimeout(() => {
      const confirmation = till.formatPaymentConfirmation(amount, tier, ref);
      telegram.sendMessage(chatId, confirmation).catch(() => {});
    }, 1000);
  } catch (err) {
    logger.error("Till payment error", err);
    await telegram.sendMessage(chatId, "Till payment setup failed. Try another method.");
  }
}
