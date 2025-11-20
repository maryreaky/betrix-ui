// src/worker.js
import Redis from "ioredis";
import fetch from "node-fetch";

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

const redis = new Redis(REDIS_URL);
redis.on("error", err => console.error("[Redis] error:", err));

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function safeFetch(url, options = {}, label = "request", retries = 2) {
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`[${label}] HTTP ${res.status} ${res.statusText} ${body}`);
    }
    return res.json();
  } catch (err) {
    if (retries > 0) {
      console.warn(`[Retry] ${label}: ${err.message}`);
      await sleep(600);
      return safeFetch(url, options, label, retries - 1);
    }
    throw err;
  }
}

async function sendTelegram(chatId, text) {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  const body = { chat_id: chatId, text, parse_mode: "Markdown" };
  await safeFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }, "sendMessage");
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

const ApiFootball = {
  headers: { "x-apisports-key": API_FOOTBALL_KEY },

  async live() {
    const url = `${API_FOOTBALL_BASE}/fixtures?live=all&timezone=Africa/Nairobi`;
    return safeFetch(url, { headers: this.headers }, "ApiFootball.live");
  },

  async fixtures({ league, season }) {
    const url = `${API_FOOTBALL_BASE}/fixtures?league=${league}&season=${season}&timezone=Africa/Nairobi`;
    return safeFetch(url, { headers: this.headers }, "ApiFootball.fixtures");
  },

  async standings({ league, season }) {
    const url = `${API_FOOTBALL_BASE}/standings?league=${league}&season=${season}`;
    return safeFetch(url, { headers: this.headers }, "ApiFootball.standings");
  },

  async odds({ fixture }) {
    const url = `${API_FOOTBALL_BASE}/odds?fixture=${fixture}&timezone=Africa/Nairobi`;
    return safeFetch(url, { headers: this.headers }, "ApiFootball.odds");
  },

  async oddsUpcoming() {
    const today = new Date().toISOString().slice(0, 10);
    const url = `${API_FOOTBALL_BASE}/odds?date=${today}&timezone=Africa/Nairobi`;
    return safeFetch(url, { headers: this.headers }, "ApiFootball.oddsUpcoming");
  }
};

const handlers = {
  async start({ chatId }) {
    return sendTelegram(chatId,
      "Welcome to BETRIX — your AI football assistant.\n\n" +
      "Commands:\n" +
      "- /help — list commands\n" +
      "- /live — live matches\n" +
      "- /fixtures 39 2024 — EPL fixtures\n" +
      "- /standings 39 2024 — EPL table\n" +
      "- /odds — odds for all upcoming fixtures today\n" +
      "- /odds <fixtureId> — odds for a specific fixture");
  },

  async help({ chatId }) {
    return sendTelegram(chatId,
      "*Commands:*\n" +
      "- /start — welcome\n" +
      "- /help — list commands\n" +
      "- /live — live matches (IDs included)\n" +
      "- /fixtures <leagueId> <season> — e.g., /fixtures 39 2024\n" +
      "- /standings <leagueId> <season> — e.g., /standings 39 2024\n" +
      "- /odds — odds for all upcoming fixtures today\n" +
      "- /odds <fixtureId> — odds for a specific fixture");
  },

  async live({ chatId }) {
    const data = await ApiFootball.live().catch(err => ({ error: err.message }));
    if (data.error) return sendTelegram(chatId, `Live unavailable: ${data.error}`);
    const items = (data?.response ?? []).map(f =>
      `${f.teams.home.name} vs ${f.teams.away.name} — ${f.goals.home}:${f.goals.away} (${f.fixture.status.short}) (ID: ${f.fixture.id})`
    );
    return sendTelegram(chatId, fmtList("Live now", items));
  },

  async fixtures({ chatId, args }) {
    const [league, season] = args;
    if (!league || !season) return sendTelegram(chatId, "Usage: /fixtures <leagueId> <season>");
    const data = await ApiFootball.fixtures({ league, season }).catch(err => ({ error: err.message }));
    if (data.error) return sendTelegram(chatId, `Fixtures unavailable: ${data.error}`);
    const items = (data?.response ?? []).map(f =>
      `${new Date(f.fixture.date).toLocaleDateString()} — ${f.teams.home.name} vs ${f.teams.away.name} (ID: ${f.fixture.id})`
    );
    return sendTelegram(chatId, fmtList(`Fixtures league ${league} season ${season}`, items));
  },

  async standings({ chatId, args }) {
    const [league, season] = args;
    if (!league || !season) return sendTelegram(chatId, "Usage: /standings <leagueId> <season>");
    const data = await ApiFootball.standings({ league, season }).catch(err => ({ error: err.message }));
    if (data.error) return sendTelegram(chatId, `Standings unavailable: ${data.error}`);
    const table = (data?.response?.[0]?.league?.standings?.[0] ?? []).map(
      r => `${r.rank}. ${r.team.name} — ${r.points} pts`
    );
    return sendTelegram(chatId, fmtList(`Standings league ${league} season ${season}`, table));
  },

  async odds({ chatId, args }) {
    if (!args.length) {
      const data = await ApiFootball.oddsUpcoming().catch(err => ({ error: err.message }));
      if (data.error) return sendTelegram(chatId, `Odds unavailable: ${data.error}`);
      const items = (data?.response ?? []).flatMap(f =>
        (f.bookmakers ?? []).flatMap(b =>
          (b.bets ?? []).map(m =>
            `${f.teams.home.name} vs ${f.teams.away.name} — ${b.name} ${m.name}: ${m.values.map(v => `${v.value} ${v.odd}`).join(" | ")}`
          )
        )
      );
      return sendTelegram(chatId, fmtList("Odds for upcoming fixtures today", items.slice(0, 20)));
    }

    const [fixture] = args;
    const data = await ApiFootball.odds({ fixture }).catch(err => ({ error: err.message }));
    if (data.error) return sendTelegram(chatId, `Odds unavailable: ${data.error}`);
    const markets = (data?.response?.[0]?.bookmakers ?? []).flatMap(b =>
      b.bets.map(m => `${b.name} — ${m.name}: ${m.values.map(v => `${v.value} ${v.odd}`).join(" | ")}`)
    );
    if (!markets.length) return sendTelegram(chatId, `No odds found for fixture ${fixture}`);
    return sendTelegram(chatId, fmtList(`Odds for fixture ${fixture}`, markets.slice(0, 20)));
  }
};

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

      const [, raw] = job;
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
        default:           await fallbackReply(chatId, text); break;
      }
    } catch (err) {
      console.error("[Worker] loop error:", err.message);
      await sleep(400);
    }
  }
})();
