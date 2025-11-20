import fetch from "node-fetch";
import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL);
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;

// Optional hosts for APIs whose exact RapidAPI hosts may vary.
// If not set, the command will respond instructively instead of crashing.
const SOFASPORT_HOST = process.env.SOFASPORT_HOST || "";
const OSSPORTS_HOST = process.env.OSSPORTS_HOST || "";
const SPORTSBOOK_HOST = process.env.SPORTSBOOK_HOST || "";
const FREE_FOOTBALL_HOST = process.env.FREE_FOOTBALL_HOST || "";
const COPILOT_HOST = process.env.COPILOT_HOST || "";

// Confirmed RapidAPI hosts (based on your test logs)
const CHATGPT4_HOST = "chatgpt4.p.rapidapi.com";
const CHATGPT_HOST = "chatgpt.p.rapidapi.com";
const ODDS_API_HOST = "odds-api.p.rapidapi.com";
const SPORTS_INFO_HOST = "sports-information.p.rapidapi.com";
const ALLSPORTS_HOST = "allsportsapi.p.rapidapi.com";
const FOOTBALL_PRED_HOST = "football-prediction.p.rapidapi.com";
const ODDS_FEED_HOST = "odds-feed.p.rapidapi.com";

// --- Telegram send ---
async function sendMessage(chatId, text) {
  try {
    await fetch(\`https://api.telegram.org/bot\${TELEGRAM_TOKEN}/sendMessage\`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text })
    });
  } catch (e) {
    console.error("sendMessage error:", e);
  }
}

// --- Utilities ---
function requireParam(val, label) {
  if (!val) return \`Missing \${label}. Usage: provide \${label} after the command.\`;
  return null;
}

function ensureHost(host, envName) {
  if (!host) return \`Host not configured: set \${envName} in Render to enable this command.\`;
  return null;
}

async function callGet(host, path) {
  try {
    const res = await fetch(\`https://\${host}\${path}\`, {
      headers: {
        "X-RapidAPI-Key": RAPIDAPI_KEY,
        "X-RapidAPI-Host": host
      }
    });
    if (!res.ok) return \`HTTP \${res.status}: \${await res.text()}\`;
    const data = await res.json().catch(() => null);
    return data ? JSON.stringify(data, null, 2) : "No JSON body.";
  } catch (e) {
    return \`Request failed: \${e.message}\`;
  }
}

async function callPost(host, path, body) {
  try {
    const res = await fetch(\`https://\${host}\${path}\`, {
      method: "POST",
      headers: {
        "X-RapidAPI-Key": RAPIDAPI_KEY,
        "X-RapidAPI-Host": host,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) return \`HTTP \${res.status}: \${await res.text()}\`;
    const data = await res.json().catch(() => null);
    return data ? JSON.stringify(data, null, 2) : "No JSON body.";
  } catch (e) {
    return \`Request failed: \${e.message}\`;
  }
}

// --- Helpers (13 commands) ---
// 1) /odds -> SofaSport (host configurable)
async function getSofaSportOdds(matchId) {
  const miss = requireParam(matchId, "matchId"); if (miss) return miss;
  const h = ensureHost(SOFASPORT_HOST, "SOFASPORT_HOST"); if (h) return h;
  return await callGet(SOFASPORT_HOST, \`/odds/\${encodeURIComponent(matchId)}\`);
}

// 2) /seasons -> OS Sports Perform (host configurable)
async function getTournamentSeasons(tournamentId) {
  const miss = requireParam(tournamentId, "tournamentId"); if (miss) return miss;
  const h = ensureHost(OSSPORTS_HOST, "OSSPORTS_HOST"); if (h) return h;
  return await callGet(OSSPORTS_HOST, \`/tournament/\${encodeURIComponent(tournamentId)}/seasons\`);
}

// 3) /ai -> ChatGPT-mini or designated mini model (POST; host configurable if you use a specific mini provider)
// Fallback: use ChatGPT with a smaller prompt
async function runAIAnalysis(prompt) {
  const miss = requireParam(prompt, "prompt"); if (miss) return miss;
  // Use general ChatGPT endpoint with a lightweight prompt
  return await callPost(CHATGPT_HOST, "/chat/completions", {
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }]
  });
}

// 4) /advantages -> Sportsbook API (host configurable)
async function getSportsbookAdvantages(sport) {
  const miss = requireParam(sport, "sport"); if (miss) return miss;
  const h = ensureHost(SPORTSBOOK_HOST, "SPORTSBOOK_HOST"); if (h) return h;
  return await callGet(SPORTSBOOK_HOST, \`/v0/advantages/\${encodeURIComponent(sport)}\`);
}

// 5) /player -> Free Football Data (host configurable)
async function searchPlayer(name) {
  const miss = requireParam(name, "player name"); if (miss) return miss;
  const h = ensureHost(FREE_FOOTBALL_HOST, "FREE_FOOTBALL_HOST"); if (h) return h;
  return await callGet(FREE_FOOTBALL_HOST, \`/players/search?name=\${encodeURIComponent(name)}\`);
}

// 6) /copilot -> Copilot AI (host configurable)
async function runCopilot(prompt) {
  const miss = requireParam(prompt, "prompt"); if (miss) return miss;
  const h = ensureHost(COPILOT_HOST, "COPILOT_HOST"); if (h) return h;
  return await callPost(COPILOT_HOST, "/copilot", { input: prompt });
}

// 7) /ai4 -> ChatGPT-4 (confirmed host)
async function runChatGPT4(prompt) {
  const miss = requireParam(prompt, "prompt"); if (miss) return miss;
  return await callPost(CHATGPT4_HOST, "/chat", { input: prompt });
}

// 8) /scores -> ODDS-API (confirmed host)
async function getScores(fixtureId) {
  const miss = requireParam(fixtureId, "fixtureId"); if (miss) return miss;
  return await callGet(ODDS_API_HOST, \`/scores/\${encodeURIComponent(fixtureId)}\`);
}

// 9) /news -> Sports Information (confirmed host)
async function getMBBNews() {
  return await callGet(SPORTS_INFO_HOST, "/mbb/news");
}

// 10) /chat -> ChatGPT (confirmed host)
async function runChatCompletion(prompt) {
  const miss = requireParam(prompt, "prompt"); if (miss) return miss;
  return await callPost(CHATGPT_HOST, "/chat/completions", {
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }]
  });
}

// 11) /transfers -> AllSportsApi (confirmed host)
async function getTeamTransfers(teamId) {
  const miss = requireParam(teamId, "teamId"); if (miss) return miss;
  // This endpoint can return 204 (no content). Handle gracefully.
  try {
    const res = await fetch(\`https://\${ALLSPORTS_HOST}/api/team/\${encodeURIComponent(teamId)}/transfers\`, {
      headers: { "X-RapidAPI-Key": RAPIDAPI_KEY, "X-RapidAPI-Host": ALLSPORTS_HOST }
    });
    if (res.status === 204) return "No transfer data available for this team.";
    if (!res.ok) return \`HTTP \${res.status}: \${await res.text()}\`;
    const data = await res.json().catch(() => null);
    return data ? JSON.stringify(data, null, 2) : "No JSON body.";
  } catch (e) {
    return \`Request failed: \${e.message}\`;
  }
}

// 12) /predict -> Football Prediction (confirmed host)
async function getFootballPrediction(query) {
  const miss = requireParam(query, "query (e.g., league=EPL&date=2025-11-20)"); if (miss) return miss;
  const path = query.includes("=") ? \`/predictions?\${query}\` : \`/predictions\`;
  return await callGet(FOOTBALL_PRED_HOST, path);
}

// 13) /markets -> Odds Feed (confirmed host)
async function getMarkets(eventId) {
  const miss = requireParam(eventId, "eventId"); if (miss) return miss;
  return await callGet(ODDS_FEED_HOST, \`/markets/feed?eventId=\${encodeURIComponent(eventId)}\`);
}

// --- Help ---
function helpText() {
  return [
    "Commands:",
    "/start — Welcome",
    "/help — This help menu",
    "/odds <matchId> — SofaSport odds",
    "/seasons <tournamentId> — Tournament seasons",
    "/ai <prompt> — Lightweight AI",
    "/advantages <sport> — Arbitrage opportunities",
    "/player <name> — Player search",
    "/copilot <prompt> — Copilot AI",
    "/ai4 <prompt> — ChatGPT-4",
    "/scores <fixtureId> — Fixture scores",
    "/news — NCAA MBB news",
    "/chat <prompt> — ChatGPT completions",
    "/transfers <teamId> — Team transfers",
    "/predict <query> — Predictions (e.g., league=EPL&date=2025-11-20)",
    "/markets <eventId> — Markets feed"
  ].join("\n");
}

// --- Router ---
async function handleCommand(chatId, text) {
  const [cmd, ...args] = (text || "").trim().split(" ");
  const argstr = args.join(" ");
  let reply;

  try {
    switch (cmd) {
      case "/start": reply = "Welcome to BETRIX! Your bot is live."; break;
      case "/help": reply = helpText(); break;

      case "/odds": reply = await getSofaSportOdds(args[0]); break;
      case "/seasons": reply = await getTournamentSeasons(args[0]); break;
      case "/ai": reply = await runAIAnalysis(argstr); break;
      case "/advantages": reply = await getSportsbookAdvantages(args[0]); break;
      case "/player": reply = await searchPlayer(argstr); break;
      case "/copilot": reply = await runCopilot(argstr); break;
      case "/ai4": reply = await runChatGPT4(argstr); break;
      case "/scores": reply = await getScores(args[0]); break;
      case "/news": reply = await getMBBNews(); break;
      case "/chat": reply = await runChatCompletion(argstr); break;
      case "/transfers": reply = await getTeamTransfers(args[0]); break;
      case "/predict": reply = await getFootballPrediction(argstr); break;
      case "/markets": reply = await getMarkets(args[0]); break;

      default:
        reply = "Unknown command. Type /help for options.";
    }
  } catch (e) {
    reply = \`Error: \${e.message}\`;
  }

  await sendMessage(chatId, reply);
}

// --- Worker loop ---
async function workerLoop() {
  while (true) {
    try {
      const jobRaw = await redis.lpop("telegram-jobs");
      if (!jobRaw) { await new Promise(r => setTimeout(r, 500)); continue; }
      const job = JSON.parse(jobRaw);
      const chatId = job?.payload?.message?.chat?.id;
      const text = job?.payload?.message?.text;
      if (!chatId) continue;
      await handleCommand(chatId, text);
    } catch (e) {
      console.error("Worker loop error:", e);
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

workerLoop();
