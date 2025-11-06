const { sendText } = require("../utils/send");
exports.handle = async (chatId) => {
  await sendText(chatId, `📊 Live Odds:\n⚽ Arsenal vs Man City — 2.10\n🏀 Lakers vs Celtics — 1.85\n\nMore: /fixtures`);
};
