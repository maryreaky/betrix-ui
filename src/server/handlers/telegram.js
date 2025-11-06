const { sendText } = require("../utils/send");

exports.handleTelegram = async (update, ctx) => {
  const message = update.message?.text?.trim();
  const chatId = update.message?.chat?.id;
  if (!message || !chatId) return;

  const lower = message.toLowerCase();

  if (lower === "/start") return sendText(chatId, `👋 Welcome to BETRIX — the future of sports, odds, and memes. Type /help to explore.`);
  if (lower === "/help") return sendText(chatId, `📜 Commands:\n/start\n/vip\n/odds\n/fixtures\n/live\n/refer\n/signup\n/meme\n/media\n/help`);
  if (lower === "/vip") return require("./vip").handle(chatId);
  if (lower === "/odds") return require("./odds").handle(chatId);
  if (lower === "/fixtures") return require("./fixtures").handle(chatId);
  if (lower === "/live") return require("./live").handle(chatId);
  if (lower === "/refer") return require("./refer").handle(chatId);
  if (lower === "/signup") return require("./signup").handle(chatId);
  if (lower === "/meme") return require("./meme").handle(chatId);
  if (lower === "/media") return require("./media").handle(chatId);

  return sendText(chatId, `🤖 Unknown command: ${message}\nType /help to see available options.`);
};
