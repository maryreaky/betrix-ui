// src/worker.js
import Redis from "ioredis";
import fetch from "node-fetch";

// -------- Environment variables --------
const {
  REDIS_URL,
  TELEGRAM_TOKEN,
  API_FOOTBALL_KEY,
  API_FOOTBALL_BASE
} = process.env;

if (!REDIS_URL || !TELEGRAM_TOKEN || !API_FOOTBALL_KEY || !API_FOOTBALL_BASE) {
  console.error("[FATAL] Missing required environment variables");
  process.exit(1);
}

// -------- Redis connection --------
const redis = new Redis(REDIS_URL);
redis.on("error", err => console.error("[Redis] error:", err));

const sleep = ms => new Promise(r => setTimeout(r, ms));

// -------- Utility functions --------
async function safeFetch(url, options = {}, label = "request", retries = 2) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`[${label}] HTTP ${res.status} ${res.statusText} ${body}`);
    }
    return res.json();
  } catch (err) {
    clearTimeout(timeout);
    if (retries > 0) {
      console.warn(`[Retry] ${label}: ${err.message}`);
      await sleep(600);
      return safeFetch(url, options, label, retries - 1);
    }
    throw err;
  }
}

async function sendTelegram(chatId, text, opts = {}) {
  const body = { chat_id: chatId, text, parse_mode: "Markdown", ...opts };
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  const res = await safeFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }, "sendMessage");
  console.log("[Telegram] reply:", res?.result?.text ?? text);
  return res;
}

function fmtList(title, rows) {
  if (!rows?.length) return `${title}: none`;
  return `*${title}:*\n` + rows.map(r => `- ${r}`).join("\n");
}

function parseArgs(text) {
  const parts = text.trim().split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);
  return { cmd, args };
}

// -------- API-Football adapter --------
const ApiFootball = {
  async live() {
    const url = `${API_FOOTBALL_BASE}/fixtures?live=all`;
    return safeFetch(url, {
      headers: { "x-apisports-key": API_FOOTBALL_KEY }
    }, "ApiFootball.live");
  },

  async fixtures({ league, season }) {
    const url = `${API_FOOTBALL_BASE}/fixtures?league=${league}&season=${season}`;
    return safeFetch(url, {
      headers: { "x-apisports-key": API_FOOTBALL_KEY }
    }, "ApiFootball.fixtures");
  },

  async standings({ league, season }) {
    const url = `${API_FOOTBALL_BASE}/standings?league=${league}&season=${season}`;
    return safeFetch(url, {
      headers: { "x-apisports-key": API_FOOTBALL_KEY }
    }, "ApiFootball.standings");
  },

  async odds({ fixture }) {
    const url = `${API_FOOTBALL_BASE}/odds?fixture=${fixture}`;
    return safeFetch(url, {
      headers: { "x-apisports-key": API_FOOTBALL_KEY }
    }, "ApiFootball.odds");
  }
};

// -------- Command handlers --------
const handlers = {
  async start({ chatId }) {
    return sendTelegram(chatId,
      "Welcome to BETRIX — your AI sports assistant.\n\n" +
      "Try:\n- /help\n- /live\n- /fixtures 39 2025\n- /standings 39 2025\n- /odds <fixtureId>");
  },

  async help({ chatId }) {
    return sendTelegram(chatId,
      "*Commands:*\n" +
      "- /start — welcome\n" +
      "- /help — list commands\n" +
      "- /live — live matches\n" +
      "- /fixtures <leagueId> <season> — upcoming fixtures\n" +
      "- /standings <leagueId> <season> — league table\n" +
      "- /odds <fixtureId> — odds for a fixture");
  },

  async live({ chatId }) {
    const data = await ApiFootball.live().catch(err => ({ error: err.message }));
    if (data.error) return sendTelegram(chatId, `Live unavailable: ${data.error}`);
    const items = (data?.response ?? []).slice(0, 10).map(f =>
      `${f.teams.home.name} vs ${f.teams.away.name} — ${f.goals.home}:${f.goals.away} (${f.fixture.status.short})`
    );
    return sendTelegram(chatId, fmtList("Live now", items));
  },

  async fixtures({ chatId, args }) {
    const [league, season] = args;
    if (!league || !season) return sendTelegram(chatId, "Usage: /fixtures <leagueId> <season>");
    const data = await ApiFootball.fixtures({ league, season }).catch(err => ({ error: err.message }));
    if (data.error) return sendTelegram(chatId, `Fixtures unavailable: ${data.error}`);
    const items = (data?.response ?? []).slice(0, 10).map(f =>
      `${new Date(f.fixture.date).toLocaleDateString()} — ${f.teams.home.name} vs ${f.teams.away.name}`
    );
    return sendTelegram(chatId, fmtList(`Fixtures league ${league} season ${season}`, items));
  },

  async standings({ chatId, args }) {
    const [league, season] = args;
    if (!league || !season) return sendTelegram(chatId, "Usage: /standings <leagueId> <season>");
    const data = await ApiFootball.standings({ league, season }).catch(err => ({ error: err.message }));
    if (data.error) return sendTelegram(chatId, `Standings unavailable: ${data.error}`);
    const table = (data?.response?.[0]?.league?.standings?.[0] ?? []).slice(0, 10).map(
      r => `${r.rank}. ${r.team.name} (${r.points} pts)`
    );
    return sendTelegram(chatId, fmtList(`Standings league ${league} season ${season}`, table));
  },

  async odds({ chatId, args }) {
    const [fixture] = args;
    if (!fixture) return sendTelegram(chatId, "Usage: /odds <fixtureId>");
    const data = await ApiFootball.odds({ fixture }).catch(err => ({ error: err.message }));
    if (data.error) return sendTelegram(chatId, `Odds unavailable: ${data.error}`);
    const markets = (data?.response?.[0]?.bookmakers ?? []).flatMap(b =>
      b.bets.map(m => `${b.name} — ${m.name}: ${m.values.map(v => `${v.value} ${v.odd}`).join(" | ")}`)
    );
    if (!markets.length) return sendTelegram(chatId, `No odds found for fixture ${fixture}`);
    return sendTelegram(chatId, fmtList(`Odds for fixture ${fixture}`, markets.slice(0, 10)));
  }
};

// -------- Fallback --------
async function fallbackReply(chatId, text) {
  return sendTelegram(chatId, `Unknown command: ${text}\nTry /help`);
}

// -------- Main loop --------
console.log("Worker connected to Redis, waiting for jobs...");

(async () => {
  while (true) {
    try {
      const job = await redis.brpop("telegram-jobs", 0);
      if (!job) continue;

      const [queue, raw] = job;
      let payload;
      try {
        const parsed = JSON.parse(raw);
        payload = parsed.payload ?? parsed;
      } catch (err) {
        console.error("[Parse] invalid job payload:", err.message);
        continue;
      }

      const msg = payload?.message ?? payload?.edited_message ?? null;
      if (!msg?.chat?.id || !msg?.text) {
        console.warn("[Skip] missing chat/text in payload");
        continue;
      }

      const chatId = msg.chat.id;
      const text = msg.text.trim();
      console.log("Job popped:", { update_id: payload.update_id, message: { chat: msg.chat, text } });

      const { cmd, args } = parseArgs(text);

      switch (cmd) {
        case "/start":     await handlers.start({ chatId }); break;
        case "/help":      await handlers.help({ chatId }); break;
        case "/live":      await handlers.live({ chatId }); break;
        case "/fixtures":  await handlers.fixtures({ chatId, args }); break;
        case "/standings": await handlers.standings({ chatId, args }); break;
        case "/odds":      await handlers.odds({ chatId, args }); break;
        default:
      }
    } catch (err) {
      console.error("[Worker] loop error:", err.message);
      await sleep(400);
    }
  }
})();
