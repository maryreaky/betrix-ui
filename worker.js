import fetch from 'node-fetch';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;

async function sendMessage(chatId, text) {
  try {
    await fetch(https://api.telegram.org/bot/sendMessage, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text })
    });
  } catch (e) {
    console.error('sendMessage error:', e);
  }
}

async function handleCommand(chatId, text) {
  const [cmd, ...args] = (text || '').trim().split(' ');
  let reply;
  switch (cmd) {
    case '/start':
      reply = 'Welcome to BETRIX! Your bot is live.';
      break;
    case '/help':
      reply = 'Commands: /odds <matchId>, /seasons <tournamentId>, /ai <prompt>, etc.';
      break;
    default:
      reply = 'Unknown command. Type /help for options.';
  }
  await sendMessage(chatId, reply);
}

async function workerLoop() {
  while (true) {
    try {
      const jobRaw = await redis.lpop('telegram-jobs');
      if (!jobRaw) { await new Promise(r => setTimeout(r, 500)); continue; }
      const job = JSON.parse(jobRaw);
      const chatId = job?.payload?.message?.chat?.id;
      const text = job?.payload?.message?.text;
      if (!chatId) continue;
      await handleCommand(chatId, text);
    } catch (e) {
      console.error('Worker loop error:', e);
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

workerLoop();
