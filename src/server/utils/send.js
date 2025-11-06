const axios = require("axios");
const BOT_TOKEN = process.env.BOT_TOKEN;

exports.sendText = async (chatId, text) => {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  await axios.post(url, { chat_id: chatId, text });
};
