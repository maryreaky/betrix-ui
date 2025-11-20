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

// ---------------- HTTP utils ----------------
async function safeFetch(url, options = {}, label = "request", retries = 2, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    const text = await res.text();
    clearTimeout(timer);
    if (!res.ok) throw new Error(`[${label}] HTTP ${res.status} ${res.statusText} ${text}`);
    return JSON.parse(text);
  } catch (err) {
    clearTimeout(timer);
    if (retries > 0) {
      console.warn(`[Retry] ${label}: ${err.message}`);
      await sleep(600);
      return safeFetch(url, options, label, retries - 1, timeoutMs);
    }
    throw err;
  }
}

async function sendTelegram(chatId, text) {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  const body = { chat_id: chatId, text, parse_mode: "Markdown", disable_web_page_preview: true };
  const res = await safeFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }, "sendMessage");
  console.log("[Telegram] reply:", res?.result?.text ?? text);
}

// ---------------- Formatting ----------------
function fmtList(title, rows) {
  if (!rows?.length) return `${title}: none`;
  return `*${title}:*\n` + rows.map(r => `- ${r}`).join("\n");
}
function fmtDate(iso) {
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  } catch {
    return iso;
  }
}
function parseArgs(text) {
  const parts = text.trim().split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);
  return { cmd, args };
}
function defaultSeason() {
  const d = new Date();
  const m = d.getUTCMonth() + 1;
  const y = d.getUTCFullYear();
  return m >= 7 ? y : y - 1;
}

// ---------------- API-Football adapter ----------------
const HEADERS = { "x-apisports-key": API_FOOTBALL_KEY };
const TZ = "Africa/Nairobi";

const ApiFootball = {
  async live() {
    const url = `${API_FOOTBALL_BASE}/fixtures?live=all&timezone=${encodeURIComponent(TZ)}`;
    return safeFetch(url, { headers: HEADERS }, "ApiFootball.live");
  },
  async fixtures({ league, season }) {
    const url = `${API_FOOTBALL_BASE}/fixtures?league=${encodeURIComponent(league)}&season=${encodeURIComponent(season)}&timezone=${encodeURIComponent(TZ)}`;
    return safeFetch(url, { headers: HEADERS }, "ApiFootball.fixtures");
  },
  async fixturesByDate(date, { league } = {}) {
    const url = `${API_FOOTBALL_BASE}/fixtures?date=${encodeURIComponent(date)}${league ? `&league=${encodeURIComponent(league)}` : ""}&timezone=${encodeURIComponent(TZ)}`;
    return safeFetch(url, { headers: HEADERS }, "ApiFootball.fixturesByDate");
  },
  async standings({ league, season }) {
    const url = `${API_FOOTBALL_BASE}/standings?league=${encodeURIComponent(league)}&season=${encodeURIComponent(season)}`;
    return safeFetch(url, { headers: HEADERS }, "ApiFootball.standings");
  },
  async odds({ fixture }) {
    const url = `${API_FOOTBALL_BASE}/odds?fixture=${encodeURIComponent(fixture)}&timezone=${encodeURIComponent(TZ)}`;
    return safeFetch(url, { headers: HEADERS }, "ApiFootball.odds");
  },
  async oddsByDate(date, { league } = {}) {
    const url = `${API_FOOTBALL_BASE}/odds?date=${encodeURIComponent(date)}${league ? `&league=${encodeURIComponent(league)}` : ""}&timezone=${encodeURIComponent(TZ)}`;
    return safeFetch(url, { headers: HEADERS }, "ApiFootball.oddsByDate");
  }
};

// ---------------- Handlers ----------------
const handlers = {
  async start({ chatId }) {
    return sendTelegram(chatId,
      "Welcome to BETRIX — your AI football assistant.\n\n" +
      "*Commands:*\n" +
      "- /help — list commands\n" +
      "- /live — live matches (IDs included)\n" +
      "- /fixtures <leagueId> <season?> — e.g., /fixtures 39 2024; season defaults if omitted\n" +
      "- /fixtures today [leagueId] — today’s fixtures\n" +
      "- /fixtures next [count] [leagueId] — next N fixtures\n" +
      "- /standings <leagueId> <season?> — e.g., /standings 39 2024; defaults if omitted\n" +
      "- /odds — upcoming odds for today (all fixtures)\n" +
      "- /odds <fixtureId> — odds for a specific fixture");
  },

  async help({ chatId }) {
    return sendTelegram(chatId,
      "*Commands:*\n" +
      "- /live — live matches\n" +
      "- /fixtures <leagueId> <season?> — e.g., /fixtures 39 2024\n" +
      "- /fixtures today [leagueId] — today’s fixtures\n" +
      "- /fixtures next [count] [leagueId] — next N fixtures\n" +
      "- /standings <leagueId> <season?> — e.g., /standings 39 2024\n" +
      "- /odds — odds for all upcoming fixtures today\n" +
      "- /odds <fixtureId> — odds for a specific match");
  },

  async live({ chatId }) {
    const data = await ApiFootball.live().catch(err => ({ error: err.message }));
    if (data.error) return sendTelegram(chatId, `Live unavailable: ${data.error}`);
    const items = (data?.response ?? []).slice(0, 20).map(f => {
      const home = f?.teams?.home?.name ?? "Home";
      const away = f?.teams?.away?.name ?? "Away";
      const hs = f?.goals?.home ?? 0;
      const as = f?.goals?.away ?? 0;
      const status = f?.fixture?.status?.short ?? "LIVE";
      const fid = f?.fixture?.id ?? "N/A";
      return `${home} vs ${away} — ${hs}:${as} (${status}) (ID: ${fid})`;
    });
    return sendTelegram(chatId, fmtList("Live now", items));
  },

  async fixtures({ chatId, args }) {
    // Modes: today / next / explicit league-season
    if (args[0]?.toLowerCase() === "today") {
      const league = args[1];
      const today = new Date().toISOString().slice(0, 10);
      const data = await ApiFootball.fixturesByDate(today, { league }).catch(err => ({ error: err.message }));
      if (data.error) return sendTelegram(chatId, `Fixtures unavailable: ${data.error}`);
      const items = (data?.response ?? []).slice(0, 20).map(f => {
        const date = fmtDate(f?.fixture?.date);
        const home = f?.teams?.home?.name ?? "Home";
        const away = f?.teams?.away?.name ?? "Away";
        const fid = f?.fixture?.id ?? "N/A";
        return `${date} — ${home} vs ${away} (ID: ${fid})`;
      });
      return sendTelegram(chatId, fmtList(`Today's fixtures${league ? ` (league ${league})` : ""}`, items));
    }

    if (args[0]?.toLowerCase() === "next") {
      const count = /^\d+$/.test(args[1]) ? Number(args[1]) : 10;
      const league = args[2] || (args[1] && !/^\d+$/.test(args[1]) ? args[1] : undefined);
      // API-Football supports next=N without season
      const url = `${API_FOOTBALL_BASE}/fixtures?next=${count}${league ? `&league=${encodeURIComponent(league)}` : ""}&timezone=${encodeURIComponent(TZ)}`;
      const data = await safeFetch(url, { headers: HEADERS }, "ApiFootball.fixturesNext").catch(err => ({ error: err.message }));
      if (data.error) return sendTelegram(chatId, `Fixtures unavailable: ${data.error}`);
      const items = (data?.response ?? []).slice(0, 20).map(f => {
        const date = fmtDate(f?.fixture?.date);
        const home = f?.teams?.home?.name ?? "Home";
        const away = f?.teams?.away?.name ?? "Away";
        const fid = f?.fixture?.id ?? "N/A";
        return `${date} — ${home} vs ${away} (ID: ${fid})`;
      });
      return sendTelegram(chatId, fmtList(`Next ${count} fixtures${league ? ` (league ${league})` : ""}`, items));
    }

    const [league, seasonArg] = args;
    if (!league) return sendTelegram(chatId, "Usage: /fixtures <leagueId> <season?> or /fixtures today [leagueId] or /fixtures next [count] [leagueId]");
    const season = seasonArg || defaultSeason();
    const data = await ApiFootball.fixtures({ league, season }).catch(err => ({ error: err.message }));
    if (data.error) return sendTelegram(chatId, `Fixtures unavailable: ${data.error}`);
    const items = (data?.response ?? []).slice(0, 20).map(f => {
      const date = fmtDate(f?.fixture?.date);
      const home = f?.teams?.home?.name ?? "Home";
      const away = f?.teams?.away?.name ?? "Away";
      const fid = f?.fixture?.id ?? "N/A";
      return `${date} — ${home} vs ${away} (ID: ${fid})`;
    });
    if (!items.length) {
      const hint = seasonArg ? "" : ` Try /fixtures today ${league} or /fixtures next 10 ${league}.`;
      return sendTelegram(chatId, `Fixtures league ${league} season ${season}: none.${hint}`);
    }
    return sendTelegram(chatId, fmtList(`Fixtures league ${league} season ${season}`, items));
  },

  async standings({ chatId, args }) {
    const [league, seasonArg] = args;
    if (!league) return sendTelegram(chatId, "Usage: /standings <leagueId> <season?>");
    const season = seasonArg || defaultSeason();
    const data = await ApiFootball.standings({ league, season }).catch(err => ({ error: err.message }));
    if (data.error) return sendTelegram(chatId, `Standings unavailable: ${data.error}`);
    const table = (data?.response?.[0]?.league?.standings?.[0] ?? [])
      .slice(0, 20)
      .map(r => `${r?.rank}. ${r?.team?.name} — ${r?.points} pts (W${r?.all?.win}-D${r?.all?.draw}-L${r?.all?.lose})`);
    if (!table.length) {
      const hint = seasonArg ? "" : ` Try an explicit season, e.g., /standings ${league} 2024.`;
      return sendTelegram(chatId, `Standings league ${league} season ${season}: none.${hint}`);
    }
    return sendTelegram(chatId, fmtList(`Standings league ${league} season ${season}`, table));
  },

  async odds({ chatId, args }) {
    // If fixtureId provided: odds for specific match
    if (args.length) {
      const [fixture] = args;
      const data = await ApiFootball.odds({ fixture }).catch(err => ({ error: err.message }));
      if (data.error) return sendTelegram(chatId, `Odds unavailable: ${data.error}`);
      const markets = (data?.response?.[0]?.bookmakers ?? []).flatMap(b =>
        (b?.bets ?? []).map(m => `${b?.name} — ${m?.name}: ${(m?.values ?? []).map(v => `${v?.value} ${v?.odd}`).join(" | ")}`)
      );
      if (!markets.length) return sendTelegram(chatId, `No odds found for fixture ${fixture}`);
      return sendTelegram(chatId, fmtList(`Odds for fixture ${fixture}`, markets.slice(0, 20)));
    }

    // No fixtureId: show odds for upcoming fixtures today
    const today = new Date().toISOString().slice(0, 10);

    // Step 1: get today’s fixtures (to ensure team names exist)
    const fx = await ApiFootball.fixturesByDate(today).catch(err => ({ error: err.message }));
    if (fx.error) return sendTelegram(chatId, `Odds unavailable: ${fx.error}`);
    const fixtureMap = new Map(
      (fx?.response ?? []).map(f => [f?.fixture?.id, { home: f?.teams?.home?.name, away: f?.teams?.away?.name }])
    );

    // Step 2: get today’s odds
    const od = await ApiFootball.oddsByDate(today).catch(err => ({ error: err.message }));
    if (od.error) return sendTelegram(chatId, `Odds unavailable: ${od.error}`);

    // Step 3: format safely
    const rows = [];
    for (const entry of (od?.response ?? [])) {
      const fid = entry?.fixture?.id;
      const home = entry?.teams?.home?.name ?? fixtureMap.get(fid)?.home ?? "Home";
      const away = entry?.teams?.away?.name ?? fixtureMap.get(fid)?.away ?? "Away";
      const bookmakers = entry?.bookmakers ?? [];
      for (const b of bookmakers) {
        const bets = b?.bets ?? [];
        for (const m of bets) {
          const values = (m?.values ?? []).map(v => `${v?.value}: ${v?.odd}`).join(" | ");
          rows.push(`${home} vs ${away} — ${b?.name} ${m?.name}: ${values}`);
          if (rows.length >= 50) break;
        }
        if (rows.length >= 50) break;
      }
      if (rows.length >= 50) break;
    }

    if (!rows.length) return sendTelegram(chatId, "Odds for upcoming fixtures today: none");
    return sendTelegram(chatId, fmtList("Odds for upcoming fixtures today", rows));
  }
};

// ---------------- Fallback ----------------
async function fallbackReply(chatId, text) {
  return sendTelegram(chatId, `Unknown command: ${text}\nTry /help`);
}

// ---------------- Main loop ----------------
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

      // Support multiple commands in one message (newline-separated)
      const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      for (const line of lines) {
        const { cmd, args } = parseArgs(line);
        switch (cmd) {
          case "/start":     await handlers.start({ chatId }); break;
          case "/help":      await handlers.help({ chatId }); break;
          case "/live":      await handlers.live({ chatId }); break;
          case "/fixtures":  await handlers.fixtures({ chatId, args }); break;
          case "/standings": await handlers.standings({ chatId, args }); break;
          case "/odds":      await handlers.odds({ chatId, args }); break;
          default:           await fallbackReply(chatId, line); break;
        }
      }
    } catch (err) {
      console.error("[Worker] loop error:", err.message);
      await sleep(400);
    }
  }
})();
