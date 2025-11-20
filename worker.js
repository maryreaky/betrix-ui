import fetch from 'node-fetch';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;

// --- Telegram send ---
async function sendMessage(chatId, text) {
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text })
    });
  } catch (e) {
    console.error('sendMessage error:', e);
  }
}

// --- Utilities ---
function requireParam(val, label) {
<<<<<<< HEAD
  if (!val) return Missing . Usage: provide  after the command.;
=======
  if (!val) return `Missing ${label}. Usage: provide ${label} after the command.`;
>>>>>>> 38d1c6b4e17e58ca366d621f4bf1358b9e3e7157
  return null;
}

async function callGet(host, path) {
  try {
<<<<<<< HEAD
    const res = await fetch(https://System.Management.Automation.Internal.Host.InternalHost, {
=======
    const res = await fetch(`https://${host}${path}`, {
>>>>>>> 38d1c6b4e17e58ca366d621f4bf1358b9e3e7157
      headers: {
        'X-RapidAPI-Key': RAPIDAPI_KEY,
        'X-RapidAPI-Host': host
      }
    });
<<<<<<< HEAD
    if (!res.ok) return HTTP : ;
    const data = await res.json().catch(() => null);
    return data ? JSON.stringify(data, null, 2) : 'No JSON body.';
  } catch (e) {
    return Request failed: ;
=======
    if (!res.ok) return `HTTP ${res.status}: ${await res.text()}`;
    const data = await res.json().catch(() => null);
    return data ? JSON.stringify(data, null, 2) : 'No JSON body.';
  } catch (e) {
    return `Request failed: ${e.message}`;
>>>>>>> 38d1c6b4e17e58ca366d621f4bf1358b9e3e7157
  }
}

async function callPost(host, path, body) {
  try {
<<<<<<< HEAD
    const res = await fetch(https://System.Management.Automation.Internal.Host.InternalHost, {
=======
    const res = await fetch(`https://${host}${path}`, {
>>>>>>> 38d1c6b4e17e58ca366d621f4bf1358b9e3e7157
      method: 'POST',
      headers: {
        'X-RapidAPI-Key': RAPIDAPI_KEY,
        'X-RapidAPI-Host': host,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
<<<<<<< HEAD
    if (!res.ok) return HTTP : ;
    const data = await res.json().catch(() => null);
    return data ? JSON.stringify(data, null, 2) : 'No JSON body.';
  } catch (e) {
    return Request failed: ;
=======
    if (!res.ok) return `HTTP ${res.status}: ${await res.text()}`;
    const data = await res.json().catch(() => null);
    return data ? JSON.stringify(data, null, 2) : 'No JSON body.';
  } catch (e) {
    return `Request failed: ${e.message}`;
>>>>>>> 38d1c6b4e17e58ca366d621f4bf1358b9e3e7157
  }
}

// --- Helpers (13 commands) ---
async function getSofaSportOdds(matchId) {
  const miss = requireParam(matchId, 'matchId'); if (miss) return miss;
<<<<<<< HEAD
  return await callGet('sofasport.p.rapidapi.com', /odds/);
=======
  return await callGet('sofasport.p.rapidapi.com', `/odds/${encodeURIComponent(matchId)}`);
>>>>>>> 38d1c6b4e17e58ca366d621f4bf1358b9e3e7157
}

async function getTournamentSeasons(tournamentId) {
  const miss = requireParam(tournamentId, 'tournamentId'); if (miss) return miss;
<<<<<<< HEAD
  return await callGet('os-sports-perform.p.rapidapi.com', /tournament//seasons);
=======
  return await callGet('os-sports-perform.p.rapidapi.com', `/tournament/${encodeURIComponent(tournamentId)}/seasons`);
>>>>>>> 38d1c6b4e17e58ca366d621f4bf1358b9e3e7157
}

async function runAIAnalysis(prompt) {
  const miss = requireParam(prompt, 'prompt'); if (miss) return miss;
  return await callPost('chatgpt.p.rapidapi.com', '/chat/completions', {
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }]
  });
}

async function getSportsbookAdvantages(sport) {
  const miss = requireParam(sport, 'sport'); if (miss) return miss;
<<<<<<< HEAD
  return await callGet('sportsbook-api.p.rapidapi.com', /v0/advantages/);
=======
  return await callGet('sportsbook-api.p.rapidapi.com', `/v0/advantages/${encodeURIComponent(sport)}`);
>>>>>>> 38d1c6b4e17e58ca366d621f4bf1358b9e3e7157
}

async function searchPlayer(name) {
  const miss = requireParam(name, 'player name'); if (miss) return miss;
<<<<<<< HEAD
  return await callGet('free-football-data.p.rapidapi.com', /players/search?name=);
=======
  return await callGet('free-football-data.p.rapidapi.com', `/players/search?name=${encodeURIComponent(name)}`);
>>>>>>> 38d1c6b4e17e58ca366d621f4bf1358b9e3e7157
}

async function runCopilot(prompt) {
  const miss = requireParam(prompt, 'prompt'); if (miss) return miss;
  return await callPost('copilot-ai.p.rapidapi.com', '/copilot', { input: prompt });
}

async function runChatGPT4(prompt) {
  const miss = requireParam(prompt, 'prompt'); if (miss) return miss;
  return await callPost('chatgpt4.p.rapidapi.com', '/chat', { input: prompt });
}

async function getScores(fixtureId) {
  const miss = requireParam(fixtureId, 'fixtureId'); if (miss) return miss;
<<<<<<< HEAD
  return await callGet('odds-api.p.rapidapi.com', /scores/);
=======
  return await callGet('odds-api.p.rapidapi.com', `/scores/${encodeURIComponent(fixtureId)}`);
>>>>>>> 38d1c6b4e17e58ca366d621f4bf1358b9e3e7157
}

async function getMBBNews() {
  return await callGet('sports-information.p.rapidapi.com', '/mbb/news');
}

async function runChatCompletion(prompt) {
  const miss = requireParam(prompt, 'prompt'); if (miss) return miss;
  return await callPost('chatgpt.p.rapidapi.com', '/chat/completions', {
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }]
  });
}

async function getTeamTransfers(teamId) {
  const miss = requireParam(teamId, 'teamId'); if (miss) return miss;
<<<<<<< HEAD
  return await callGet('allsportsapi.p.rapidapi.com', /api/team//transfers);
=======
  return await callGet('allsportsapi.p.rapidapi.com', `/api/team/${encodeURIComponent(teamId)}/transfers`);
>>>>>>> 38d1c6b4e17e58ca366d621f4bf1358b9e3e7157
}

async function getFootballPrediction(query) {
  const miss = requireParam(query, 'query'); if (miss) return miss;
<<<<<<< HEAD
  const path = query.includes('=') ? /predictions? : '/predictions';
=======
  const path = query.includes('=') ? `/predictions?${query}` : '/predictions';
>>>>>>> 38d1c6b4e17e58ca366d621f4bf1358b9e3e7157
  return await callGet('football-prediction.p.rapidapi.com', path);
}

async function getMarkets(eventId) {
  const miss = requireParam(eventId, 'eventId'); if (miss) return miss;
<<<<<<< HEAD
  return await callGet('odds-feed.p.rapidapi.com', /markets/feed?eventId=);
=======
  return await callGet('odds-feed.p.rapidapi.com', `/markets/feed?eventId=${encodeURIComponent(eventId)}`);
>>>>>>> 38d1c6b4e17e58ca366d621f4bf1358b9e3e7157
}

// --- Help ---
function helpText() {
  return [
    'Commands:',
    '/start — Welcome',
    '/help — This help menu',
    '/odds <matchId> — SofaSport odds',
    '/seasons <tournamentId> — Tournament seasons',
    '/ai <prompt> — Lightweight AI',
    '/advantages <sport> — Arbitrage opportunities',
    '/player <name> — Player search',
    '/copilot <prompt> — Copilot AI',
    '/ai4 <prompt> — ChatGPT-4',
    '/scores <fixtureId> — Fixture scores',
    '/news — NCAA MBB news',
    '/chat <prompt> — ChatGPT completions',
    '/transfers <teamId> — Team transfers',
    '/predict <query> — Predictions (e.g., league=EPL&date=2025-11-20)',
    '/markets <eventId> — Markets feed'
  ].join('\n');
}

// --- Router ---
async function handleCommand(chatId, text) {
  const [cmd, ...args] = (text || '').trim().split(' ');
  const argstr = args.join(' ');
  let reply;

  try {
    switch (cmd) {
      case '/start': reply = 'Welcome to BETRIX! Your bot is live.'; break;
      case '/help': reply = helpText(); break;
      case '/odds': reply = await getSofaSportOdds(args[0]); break;
      case '/seasons': reply = await getTournamentSeasons(args[0]); break;
      case '/ai': reply = await runAIAnalysis(argstr); break;
      case '/advantages': reply = await getSportsbookAdvantages(args[0]); break;
      case '/player': reply = await searchPlayer(argstr); break;
      case '/copilot': reply = await runCopilot(argstr); break;
      case '/ai4': reply = await runChatGPT4(argstr); break;
      case '/scores': reply = await getScores(args[0]); break;
      case '/news': reply = await getMBBNews(); break;
      case '/chat': reply = await runChatCompletion(argstr); break;
      case '/transfers': reply = await getTeamTransfers(args[0]); break;
      case '/predict': reply = await getFootballPrediction(argstr); break;
      case '/markets': reply = await getMarkets(args[0]); break;
      default: reply = 'Unknown command. Type /help for options.';
    }
  } catch (e) {
<<<<<<< HEAD
    reply = Error: ;
=======
    reply = `Error: ${e.message}`;
>>>>>>> 38d1c6b4e17e58ca366d621f4bf1358b9e3e7157
  }

  await sendMessage(chatId, reply);
}

// --- Worker loop ---
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