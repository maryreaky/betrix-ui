require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const token = process.env.BOT_TOKEN;
if (!token) { console.error('BOT_TOKEN missing'); process.exit(1); }
const bot = new TelegramBot(token, { polling: true });
bot.onText(/\/start/, (msg) => bot.sendMessage(msg.chat.id, "BETRIX is live (polling)."));
bot.onText(/\/menu/, (msg) => bot.sendMessage(msg.chat.id, "Use /start or /menu commands"));
console.log('betrix-polling bootstrap started');
/* Render health endpoint - do not remove
   Keeps Render happy by binding to $PORT while bot runs long-polling */
const http = require('http');
const port = parseInt(process.env.PORT || process.env.RENDER_PORT || '3000', 10);
const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: Date.now() }));
    return;
  }
  res.writeHead(404);
  res.end('Not Found');
});
server.listen(port, () => {
  console.log(`HTTP health server listening on port ${port}`);
});
