"use strict";
require("dotenv").config();
const http = require("http");
const TelegramBot = require("node-telegram-bot-api");

const PORT = parseInt(process.env.PORT || process.env.RENDER_PORT || "3000", 10);
const server = http.createServer((req, res) => {
  if (req.url === "/" || req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", timestamp: Date.now() }));
    return;
  }
  res.writeHead(404);
  res.end("Not Found");
});
if (process.env.ENABLE_POLLING === "true") { server.listen(PORT, () } else { console.info("Polling disabled: ENABLE_POLLING != true") } => {
  console.log(`HTTP health server listening on port ${PORT}`);
  startBot();
});

function startBot() {
  const token = process.env.BOT_TOKEN;
  if (!token) {
    console.error("BOT_TOKEN missing in environment. Exiting.");
    return;
  }

  const bot = new TelegramBot(token, { polling: true });
  console.log("betrix-polling bootstrap started");

  const send = (chatId, text, opt) =>
    bot.sendMessage(chatId, text, opt).catch((e) => console.error("send err", e));

  bot.onText(/\/start/, (msg) =>
    send(msg.chat.id, "Welcome to BETRIX ? Use /menu to begin.")
  );
  bot.onText(/\/menu/, (msg) =>
    send(
      msg.chat.id,
      "BETRIX Menu\n• /signin\n• /profile\n• /share\n• /balance\n• /help"
    )
  );
  bot.onText(/\/signin/, (msg) =>
    send(msg.chat.id, "To sign in send: /dob YYYY-MM-DD")
  );
  bot.onText(/\/dob\s+(\d{4}-\d{2}-\d{2})/, (msg, match) =>
    send(msg.chat.id, `DOB saved: ${match[1]}`)
  );
  bot.onText(/\/profile/, (msg) =>
    send(msg.chat.id, "Profile\nDOB: not set")
  );
  bot.onText(/\/share/, (msg) =>
    send(
      msg.chat.id,
      `Share your referral link:\nhttps://t.me/${
        process.env.BOT_USERNAME || "YourBotUsername"
      }?start=${msg.chat.id}`
    )
  );
  bot.onText(/\/balance/, (msg) =>
    send(msg.chat.id, "Your balance: 0")
  );
  bot.on("message", (msg) => {
    if (!msg.text.startsWith("/"))
      send(msg.chat.id, "I received your message. Use /menu for options.");
  });

  process.on("SIGINT", () =>
    bot.stopPolling().then(() => process.exit(0))
  );
  process.on("SIGTERM", () =>
    bot.stopPolling().then(() => process.exit(0))
  );
}

