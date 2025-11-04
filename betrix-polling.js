/**
 * betrix-polling.js
 * Robust Render-friendly long-polling Telegram bot with HTTP health endpoint.
 * - Binds to process.env.PORT (or 3000) so Render detects open port
 * - Starts Telegram long-polling in same process
 * - Minimal, safe handlers; does not include secrets
 */
'use strict';

require('dotenv').config();
const http = require('http');
const TelegramBot = require('node-telegram-bot-api');

// Health server binds early to guarantee port open for Render
const PORT = parseInt(process.env.PORT || process.env.RENDER_PORT || '3000', 10);
const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', pid: process.pid, timestamp: Date.now() }));
    return;
  }
  res.writeHead(404);
  res.end('Not Found');
});
server.listen(PORT, () => {
  console.log(HTTP health server listening on port );
});

// --- Telegram bot startup ---
const token = process.env.BOT_TOKEN;
if (!token) {
  console.error('BOT_TOKEN missing in environment. Exiting after opening health port.');
  // keep health server alive so Render shows a running instance; exit with non-zero so Render will show failure
  setTimeout(() => process.exit(1), 5000);
} else {
  // ensure global fetch for any optional Upstash / HTTP calls (Node 18+)
  if (typeof fetch === 'undefined') {
    try { global.fetch = require('node-fetch'); } catch (e) { /* node 18+ has fetch */ }
  }

  const bot = new TelegramBot(token, { polling: true, request: { timeout: 120000 } });
  console.log('betrix-polling bootstrap started, polling enabled');

  // Simple storage fallback
  const store = new Map();

  const send = async (chatId, text, opts) => {
    try { await bot.sendMessage(chatId, text, opts); } catch (e) { console.error('send error', e && e.message); }
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

  // graceful shutdown
  const stop = async (sig) => {
    console.log(Received , stopping bot polling and closing server.);
    try { await bot.stopPolling(); } catch (e) { console.error('stopPolling err', e && e.message); }
    server.close(() => { process.exit(0); });
    setTimeout(() => process.exit(0), 5000);
  };
  process.on('SIGINT', () => stop('SIGINT'));
  process.on('SIGTERM', () => stop('SIGTERM'));
}
