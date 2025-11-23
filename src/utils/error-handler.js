/**
 * Centralized Error Handler with Recovery
 */

import { Logger } from "./logger.js";

const logger = new Logger("ErrorHandler");

class BetrixError extends Error {
  constructor(message, code, recoverable = true) {
    super(message);
    this.code = code;
    this.recoverable = recoverable;
    this.timestamp = new Date();
  }
}

const errorMessages = {
  TIER_DENIED: "🔒 This feature requires a higher tier subscription.",
  PAYMENT_FAILED: "💳 Payment processing failed. Try another method.",
  API_UNAVAILABLE: "🌐 Sports data temporarily unavailable.",
  GEMINI_ERROR: "🤖 AI is thinking... try again in a moment.",
  RATE_LIMITED: "⏱️ You're sending requests too fast. Wait a moment.",
  USER_BANNED: "⛔ Your account has been suspended.",
  INVALID_INPUT: "❌ Please provide valid input.",
};

async function handleError(err, chatId, telegram, userId = null) {
  try {
    let message = errorMessages.INVALID_INPUT;
    
    if (err.code === "TIER_DENIED") message = errorMessages.TIER_DENIED;
    else if (err.code === "RATE_LIMITED") message = errorMessages.RATE_LIMITED;
    else if (err.code === "API_ERROR") message = errorMessages.API_UNAVAILABLE;
    else if (err.code === "BANNED") message = errorMessages.USER_BANNED;

    await telegram?.sendMessage(chatId, message);
    
    logger.error(`${err.code || "UNKNOWN"}`, {
      userId,
      message: err.message,
      recoverable: err.recoverable,
    });

    return err.recoverable;
  } catch (e) {
    logger.error("Error handler failed", e);
    return false;
  }
}

export { BetrixError, handleError, errorMessages };
