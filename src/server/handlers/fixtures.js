const { sendText } = require("../utils/send");
exports.handle = async (chatId) => {
  await sendText(chatId, `📅 Today’s Fixtures:\n- 18:00 Arsenal vs Man City\n- 20:30 Lakers vs Celtics\n\nUse /live for scores.`);
};
