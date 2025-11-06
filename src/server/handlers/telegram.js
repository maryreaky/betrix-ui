const { sendText } = require("../utils/send");
const { askGeneral, askFootball } = require("../utils/openai");

exports.handleTelegram = async (update, ctx) => {
  const message = update.message?.text?.trim();
  const chatId = update.message?.chat?.id;
  if (!message || !chatId) return;

  const lower = message.toLowerCase();
  const isFootball = /(arsenal|man city|odds|fixtures|scores|match|goal|jackpot|betrix|vip|fixed|football|analyse|stats|live)/.test(lower);

  const reply = isFootball
    ? await askFootball(message)
    : await askGeneral(message);

  await sendText(chatId, reply);
};
