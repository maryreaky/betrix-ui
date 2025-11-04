require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const token = process.env.BOT_TOKEN;
if (!token) { console.error('BOT_TOKEN missing'); process.exit(1); }
const bot = new TelegramBot(token, { polling: true });
bot.onText(/\/start/, (msg) => bot.sendMessage(msg.chat.id, "BETRIX is live (polling)."));
bot.onText(/\/menu/, (msg) => bot.sendMessage(msg.chat.id, "Use /start or /menu commands"));
console.log('betrix-polling bootstrap started');
