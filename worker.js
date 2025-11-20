import fetch from "node-fetch";
import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL);
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;

async function sendMessage(chatId, text) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text })
  });
}

// === Helper Functions ===
// Each API wrapper calls RapidAPI with shared RAPIDAPI_KEY

async function getSofaSportOdds(matchId) { return callApi("sofasport.p.rapidapi.com", `/odds/${matchId}`); }
async function getTournamentSeasons(tournamentId) { return callApi("os-sports-perform.p.rapidapi.com", `/tournament/${tournamentId}/seasons`); }
async function runAIAnalysis(prompt) { return callPost("chatgpt-rapidapi.p.rapidapi.com", "/chat/completions", { model:"gpt-5-mini-2025-08-07", messages:[{role:"user",content:prompt}] }); }
async function getSportsbookAdvantages(sport) { return callApi("sportsbook-api.p.rapidapi.com", `/v0/advantages/${sport}`); }
async function searchPlayer(name) { return callApi("free-football-data.p.rapidapi.com", `/players/search?name=${encodeURIComponent(name)}`); }
async function runCopilot(prompt) { return callPost("copilot.p.rapidapi.com", "/copilot", { input: prompt }); }
async function runChatGPT4(prompt) { return callPost("chatgpt4.p.rapidapi.com", "/chat", { input: prompt }); }
async function getScores(fixtureId) { return callApi("odds-api.p.rapidapi.com", `/scores/${fixtureId}`); }
async function getMBBNews() { return callApi("sports-information.p.rapidapi.com", "/mbb/news"); }
async function runChatCompletion(prompt) { return callPost("chatgpt.p.rapidapi.com", "/chat/completions", { model:"gpt-4", messages:[{role:"user",content:prompt}] }); }
async function getTeamTransfers(teamId) { return callApi("allsportsapi.p.rapidapi.com", `/api/team/${teamId}/transfers`); }
async function getFootballPrediction(params) { return callApi("football-prediction.p.rapidapi.com", `/predictions?${params}`); }
async function getMarkets(eventId) { return callApi("odds-feed.p.rapidapi.com", `/markets/feed?eventId=${eventId}`); }

// === Generic API Callers ===
async function callApi(host, path) {
  const res = await fetch(`https://${host}${path}`, {
    headers: { "X-RapidAPI-Key": RAPIDAPI_KEY, "X-RapidAPI-Host": host }
  });
  return JSON.stringify(await res.json(), null, 2);
}

async function callPost(host, path, body) {
  const res = await fetch(`https://${host}${path}`, {
    method: "POST",
    headers: { "X-RapidAPI-Key": RAPIDAPI_KEY, "X-RapidAPI-Host": host, "Content-Type":"application/json" },
    body: JSON.stringify(body)
  });
  return JSON.stringify(await res.json(), null, 2);
}

// === Command Router ===
async function handleCommand(chatId, text) {
  const [cmd, ...args] = text.split(" ");
  let reply;
  switch (cmd) {
    case "/odds": reply = await getSofaSportOdds(args[0]); break;
    case "/seasons": reply = await getTournamentSeasons(args[0]); break;
    case "/ai": reply = await runAIAnalysis(args.join(" ")); break;
    case "/advantages": reply = await getSportsbookAdvantages(args[0]); break;
    case "/player": reply = await searchPlayer(args.join(" ")); break;
    case "/copilot": reply = await runCopilot(args.join(" ")); break;
    case "/ai4": reply = await runChatGPT4(args.join(" ")); break;
    case "/scores": reply = await getScores(args[0]); break;
    case "/news": reply = await getMBBNews(); break;
    case "/chat": reply = await runChatCompletion(args.join(" ")); break;
    case "/transfers": reply = await getTeamTransfers(args[0]); break;
    case "/predict": reply = await getFootballPrediction(args.join("&")); break;
    case "/markets": reply = await getMarkets(args[0]); break;
    default: reply = "Unknown command. Type /help for options.";
  }
  await sendMessage(chatId, reply);
}

// === Worker Loop ===
async function workerLoop() {
  while (true) {
    const job = await redis.lpop("telegram-jobs");
    if (!job) { await new Promise(r => setTimeout(r, 1000)); continue; }
    const { chatId, text } = JSON.parse(job);
    await handleCommand(chatId, text);
  }
}
workerLoop();
