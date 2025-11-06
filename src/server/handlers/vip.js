const { sendText } = require("../utils/send");
exports.handle = async (chatId) => {
  await sendText(chatId, `💎 VIP Access:\n- Exclusive odds\n- Affiliate pricing\n- Early drops\n\nJoin now: https://betrix.vip`);
};
