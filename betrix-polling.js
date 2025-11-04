/**
 * betrix-polling.js
 * Fixed Render-friendly long-polling Telegram bot with HTTP health endpoint.
 * - Binds to process.env.PORT early so Render sees open port
 * - Uses correct string quoting/template literals (no syntax errors)
 * - Starts Telegram polling after the HTTP server listens
 */
'use strict';

require('dotenv').config();
const http = require('http');
const TelegramBot = require('node-telegram-bot-api');

const PORT = parseInt(process.env.PORT || process.env.RENDER_PORT || '3000', 10);

// Start health server first so Render detects the bind immediately
const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', pid: process.pid, timestamp: Date.now() }));
    return;
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(HTTP health server listening on port );
  // After health server is listening, start the Telegram polling bot
  startBot();
});

async function startBot() {
  const token = process.env.BOT_TOKEN;
  if (!token) {
    console.error('BOT_TOKEN missing in environment. The bot will not start.');
    return;
  }

  // Ensure fetch exists for optional HTTP calls (Node 18+ typically has fetch)
  if (typeof fetch === 'undefined') {
    try { global.fetch = require('node-fetch'); } catch (e) { /* optional */ }
  }

  const bot = new TelegramBot(token, { polling: true, request: { timeout: 120000 } });
  console.log('betrix-polling bootstrap started, polling enabled');

  // Minimal in-memory store (Upstash integration can be added later)
  const store = new Map();

  const send = async (chatId, text, opts) => {
    try {
      await bot.sendMessage(chatId, text, opts);
    } catch (e) {
      console.error('send error', e && e.message);
    }
  };

  bot.onText(/\/start/, async (msg) => {
    await send(msg.chat.id, 'Welcome to BETRIX ⚡ Use /menu to begin.');
  });

  bot.onText(/\/menu/, async (msg) => {
    await send(msg.chat.id, 'BETRIX Menu\n• /signin\n• /profile\n• /share\n• /balance\n• /help');
  });

  bot.onText(/\/signin/, async (msg) => {
    await send(msg.chat.id, 'To sign in send: /dob YYYY-MM-DD');
  });

  bot.onText(/\/dob\s+(\d{4}-\d{2}-\d{2})/, async (msg, match) => {
    const dob = match[1];
    store.set('dob:' + msg.chat.id, dob);
    await send(msg.chat.id, DOB saved: );
  });

  bot.onText(/\/profile/, async (msg) => {
    const dob = store.get('dob:' + msg.chat.id) || 'not set';
    await send(msg.chat.id, Profile\nDOB: );
  });

  bot.onText(/\/share/, async (msg) => {
    const ref = https://t.me/?start=;
    await send(msg.chat.id, Share your referral link:\n);
  });

  bot.onText(/\/balance/, async (msg) => {
    const bal = store.get('bal:' + msg.chat.id) || 0;
    await send(msg.chat.id, Your balance: );
  });

  bot.on('message', async (msg) => {
    if (msg.text && msg.text.startsWith('/')) return;
    await send(msg.chat.id, 'I received your message. Use /menu for options.');
  });

  // Graceful shutdown
  const stop = async (sig) => {
    console.log(Received , stopping bot polling and closing server.);
    try { await bot.stopPolling(); } catch (e) { console.error('stopPolling err', e && e.message); }
    server.close(() => { process.exit(0); });
    setTimeout(() => process.exit(0), 5000);
  };
  process.on('SIGINT', () => stop('SIGINT'));
  process.on('SIGTERM', () => stop('SIGTERM'));
}
