// src/worker.js
import Redis from "ioredis";
import fetch from "node-fetch";

// ---------- Env ----------
const {
  REDIS_URL,
  TELEGRAM_TOKEN,
  API_FOOTBALL_KEY,
  API_FOOTBALL_BASE,
  TELEGRAM_SAFE_CHUNK
} = process.env;

const REQUIRED_ENVS = { REDIS_URL, TELEGRAM_TOKEN, API_FOOTBALL_KEY, API_FOOTBALL_BASE };
for (const [k, v] of Object.entries(REQUIRED_ENVS)) {
  if (!v) {
    console.error(`[FATAL] Missing env: ${k}`);
    process.exit(1);
  }
}

// ---------- Globals ----------
const TZ = "Africa/Nairobi";
const SAFE_CHUNK = Math.max(500, Number(TELEGRAM_SAFE_CHUNK || 3000));
const HEADERS = { "x-apisports-key": API_FOOTBALL_KEY };
const MAX_ROWS = 20;       // generic cap for list outputs
const MAX_AGG_ROWS = 50;   // odds aggregate cap

// Common league name → ID mapping (normalized, case-insensitive)
const LEAGUES = {
  epl: 39, premierleague: 39, england: 39,
  laliga: 140, spain: 140,
  seriea: 135, italy: 135,
  bundesliga: 78, germany: 78,
  ligue1: 61, france: 61,
  ucl: 2, championsleague: 2
};
function normLeagueId(token) {
  if (!token) return null;
  const t = String(token).toLowerCase().replace(/\s+/g, "");
  if (/^\d+$/.test(t)) return Number(t);
  return LEAGUES[t] || null;
}

// ---------- Redis ----------
const redis = new Redis(REDIS_URL);
redis.on("error", err => console.error("[Redis] error:", err));

// ---------- Utils ----------
const sleep = ms => new Promise(r => setTimeout(r, ms));

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

function chunkText(text, chunkSize = SAFE_CHUNK) {
  if (!text) return [""];
  const chunks = [];
  let remaining = String(text);

  while (remaining.length > chunkSize) {
    let idx = remaining.lastIndexOf("\n", chunkSize);
    if (idx === -1 || idx < chunkSize * 0.6) {
      idx = remaining.lastIndexOf(" ", chunkSize);
      if (idx === -1 || idx < chunkSize * 0.6) idx = chunkSize;
    }
    chunks.push(remaining.slice(0, idx));
    remaining = remaining.slice(idx).trimStart();
  }
  if (remaining.length) chunks.push(remaining);
  return chunks;
}

async function sendTelegram(chatId, text, opts = {}) {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  const chunks = chunkText(text);

  for (let i = 0; i < chunks.length; i++) {
    const suffix = chunks.length > 1 ? `\n\n_Page ${i + 1}/${chunks.length}_` : "";
    const body = {
      chat_id: chatId,
      text: chunks[i] + suffix,
      parse_mode: "Markdown",
      disable_web_page_preview: true,
      ...opts
    };
    await safeFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }, "sendMessage");
  }
}

function fmtList(title, rows) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return `${title}: none`;
  return `*${title}:*\n` + list.map(r => `- ${r}`).join("\n");
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
  const m = d.getUTCMonth() + 1; // 1–12
  const y = d.getUTCFullYear();
  return m >= 7 ? y : y - 1; // football seasons typically start mid-year
}

// ---------- Simple cache helpers ----------
async function cacheGet(key) {
  try {
    const raw = await redis.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
async function cacheSet(key, value, ttlSec) {
  try {
    await redis.set(key, JSON.stringify(value), "EX", Math.max(10, ttlSec));
  } catch { /* ignore */ }
}

// ---------- API-Football ----------
const ApiFootball = {
  async live() {
    const key = `fixtures:live:${TZ}`;
    const hit = await cacheGet(key);
    if (hit) return hit;
    const url = `${API_FOOTBALL_BASE}/fixtures?live=all&timezone=${encodeURIComponent(TZ)}`;
    const data = await safeFetch(url, { headers: HEADERS }, "ApiFootball.live");
    await cacheSet(key, data, 30); // short cache (live)
    return data;
  },

  async fixtures({ league, season }) {
    const key = `fixtures:league:${league}:season:${season}:${TZ}`;
    const hit = await cacheGet(key);
    if (hit) return hit;
    const url = `${API_FOOTBALL_BASE}/fixtures?league=${encodeURIComponent(league)}&season=${encodeURIComponent(season)}&timezone=${encodeURIComponent(TZ)}`;
    const data = await safeFetch(url, { headers: HEADERS }, "ApiFootball.fixtures");
    await cacheSet(key, data, 300); // 5 min
    return data;
  },

  async fixturesByDate(date, { league } = {}) {
    const key = `fixtures:date:${date}:league:${league || "all"}:${TZ}`;
    const hit = await cacheGet(key);
    if (hit) return hit;
    const url = `${API_FOOTBALL_BASE}/fixtures?date=${encodeURIComponent(date)}${league ? `&league=${encodeURIComponent(league)}` : ""}&timezone=${encodeURIComponent(TZ)}`;
    const data = await safeFetch(url, { headers: HEADERS }, "ApiFootball.fixturesByDate");
    await cacheSet(key, data, 300); // 5 min
    return data;
  },

  async nextFixtures({ count = 10, league }) {
    const key = `fixtures:next:${count}:league:${league || "all"}:${TZ}`;
    const hit = await cacheGet(key);
    if (hit) return hit;
    const url = `${API_FOOTBALL_BASE}/fixtures?next=${Number(count)}${league ? `&league=${encodeURIComponent(league)}` : ""}&timezone=${encodeURIComponent(TZ)}`;
    const data = await safeFetch(url, { headers: HEADERS }, "ApiFootball.fixturesNext");
    await cacheSet(key, data, 300); // 5 min
    return data;
  },

  async standings({ league, season }) {
    const key = `standings:${league}:${season}`;
    const hit = await cacheGet(key);
    if (hit) return hit;
    const url = `${API_FOOTBALL_BASE}/standings?league=${encodeURIComponent(league)}&season=${encodeURIComponent(season)}`;
    const data = await safeFetch(url, { headers: HEADERS }, "ApiFootball.standings");
    await cacheSet(key, data, 21600); // 6 hours
    return data;
  },

  async odds({ fixture }) {
    const key = `odds:fixture:${fixture}:${TZ}`;
    const hit = await cacheGet(key);
    if (hit) return hit;
    const url = `${API_FOOTBALL_BASE}/odds?fixture=${encodeURIComponent(fixture)}&timezone=${encodeURIComponent(TZ)}`;
    const data = await safeFetch(url, { headers: HEADERS }, "ApiFootball.odds");
    await cacheSet(key, data, 120); // 2 min
    return data;
  },

  async oddsByDate(date, { league } = {}) {
    const key = `odds:date:${date}:league:${league || "all"}:${TZ}`;
    const hit = await cacheGet(key);
    if (hit) return hit;
    const url = `${API_FOOTBALL_BASE}/odds?date=${encodeURIComponent(date)}${league ? `&league=${encodeURIComponent(league)}` : ""}&timezone=${encodeURIComponent(TZ)}`;
    const data = await safeFetch(url, { headers: HEADERS }, "ApiFootball.oddsByDate");
    await cacheSet(key, data, 120); // 2 min
    return data;
  }
};

// ---------- Handlers ----------
const handlers = {
  async start({ chatId }) {
    return sendTelegram(chatId,
      "Welcome to BETRIX — your AI football assistant.\n\n" +
      "*Quick commands:*\n" +
      "- /help — list commands with examples\n" +
      "- /live — live matches (IDs included)\n" +
      "- /today [league] — today’s fixtures (e.g., /today epl)\n" +
      "- /next [count] [league] — next games (e.g., /next 10 epl)\n" +
      "- /fixtures <leagueId|name> <season?> — e.g., /fixtures epl 2024; season defaults if omitted\n" +
      "- /standings <leagueId|name> <season?> — e.g., /standings epl 2024\n" +
      "- /odds — odds for upcoming fixtures today\n" +
      "- /odds <fixtureId> — odds for a specific match");
  },

  async help({ chatId }) {
    return sendTelegram(chatId,
      "*Commands:*\n" +
      "- /live — live matches\n" +
      "- /today [leagueId|name] — today’s fixtures (optional league filter)\n" +
      "- /next [count] [leagueId|name] — next N fixtures (optional league)\n" +
      "- /fixtures <leagueId|name> <season?> — e.g., /fixtures epl 2024\n" +
      "- /standings <leagueId|name> <season?> — e.g., /standings epl 2024\n" +
      "- /odds — odds for all upcoming fixtures today\n" +
      "- /odds <fixtureId> — odds for a specific fixture");
  },

  async live({ chatId }) {
    const data = await ApiFootball.live().catch(err => ({ error: err.message }));
    if (data.error) return sendTelegram(chatId, `Live unavailable: ${data.error}`);

    const items = (data?.response ?? []).slice(0, 40).map(f => {
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

  async today({ chatId, args }) {
    const leagueToken = args[0];
    const league = normLeagueId(leagueToken);
    const today = new Date().toISOString().slice(0, 10);

    const data = await ApiFootball.fixturesByDate(today, { league }).catch(err => ({ error: err.message }));
    if (data.error) return sendTelegram(chatId, `Fixtures unavailable: ${data.error}`);

    const items = (data?.response ?? []).slice(0, 50).map(f => {
      const date = fmtDate(f?.fixture?.date);
      const home = f?.teams?.home?.name ?? "Home";
      const away = f?.teams?.away?.name ?? "Away";
      const fid = f?.fixture?.id ?? "N/A";
      return `${date} — ${home} vs ${away} (ID: ${fid})`;
    });

    return sendTelegram(chatId, fmtList(`Today's fixtures${league ? ` (league ${league})` : ""}`, items));
  },

  async next({ chatId, args }) {
    const count = /^\d+$/.test(args[0]) ? Number(args[0]) : 10;
    const leagueToken = args.find(a => isNaN(Number(a)));
    const league = normLeagueId(leagueToken);

    const data = await ApiFootball.nextFixtures({ count, league }).catch(err => ({ error: err.message }));
    if (data.error) return sendTelegram(chatId, `Fixtures unavailable: ${data.error}`);

    const items = (data?.response ?? []).slice(0, 50).map(f => {
      const date = fmtDate(f?.fixture?.date);
      const home = f?.teams?.home?.name ?? "Home";
      const away = f?.teams?.away?.name ?? "Away";
      const fid = f?.fixture?.id ?? "N/A";
      return `${date} — ${home} vs ${away} (ID: ${fid})`;
    });

    return sendTelegram(chatId, fmtList(`Next ${count} fixtures${league ? ` (league ${league})` : ""}`, items));
  },

  async fixtures({ chatId, args }) {
    const [leagueToken, seasonArg] = args;
    if (!leagueToken) {
      return sendTelegram(chatId, "Usage: /fixtures <leagueId|name> <season?>\nTry /today epl or /next 10 epl");
    }
    const league = normLeagueId(leagueToken);
    if (!league) return sendTelegram(chatId, `Unknown league: ${leagueToken}. Try epl, laliga, seriea, bundesliga, ligue1, ucl or a numeric ID.`);
    const season = seasonArg || defaultSeason();

    const data = await ApiFootball.fixtures({ league, season }).catch(err => ({ error: err.message }));
    if (data.error) return sendTelegram(chatId, `Fixtures unavailable: ${data.error}`);

    const items = (data?.response ?? []).slice(0, 100).map(f => {
      const date = fmtDate(f?.fixture?.date);
      const home = f?.teams?.home?.name ?? "Home";
      const away = f?.teams?.away?.name ?? "Away";
      const fid = f?.fixture?.id ?? "N/A";
      return `${date} — ${home} vs ${away} (ID: ${fid})`;
    });

    if (!items.length) {
      return sendTelegram(chatId, `Fixtures league ${league} season ${season}: none.\nTry /today ${league} or /next 10 ${league}`);
    }
    return sendTelegram(chatId, fmtList(`Fixtures league ${league} season ${season}`, items));
  },

  async standings({ chatId, args }) {
    const [leagueToken, seasonArg] = args;
    if (!leagueToken) return sendTelegram(chatId, "Usage: /standings <leagueId|name> <season?>\nExample: /standings epl 2024");
    const league = normLeagueId(leagueToken);
    if (!league) return sendTelegram(chatId, `Unknown league: ${leagueToken}. Try epl, laliga, seriea, bundesliga, ligue1, ucl or a numeric ID.`);
    const season = seasonArg || defaultSeason();

    const data = await ApiFootball.standings({ league, season }).catch(err => ({ error: err.message }));
    if (data.error) return sendTelegram(chatId, `Standings unavailable: ${data.error}`);

    const table = (data?.response?.[0]?.league?.standings?.[0] ?? [])
      .slice(0, 20)
      .map(r => `${r?.rank}. ${r?.team?.name} — ${r?.points} pts (W${r?.all?.win}-D${r?.all?.draw}-L${r?.all?.lose})`);

    if (!table.length) {
      return sendTelegram(chatId, `Standings league ${league} season ${season}: none.\nTip: Try an explicit season: /standings ${league} 2024`);
    }
    return sendTelegram(chatId, fmtList(`Standings league ${league} season ${season}`, table));
  },

  async table({ chatId, args }) {
    // alias to standings
    return handlers.standings({ chatId, args });
  },

  async odds({ chatId, args }) {
    // Odds for a specific fixture if ID provided
    if (args.length) {
      const [fixture] = args;
      const data = await ApiFootball.odds({ fixture }).catch(err => ({ error: err.message }));
      if (data.error) return sendTelegram(chatId, `Odds unavailable: ${data.error}`);

      const markets = (data?.response?.[0]?.bookmakers ?? []).flatMap(b =>
        (b?.bets ?? []).map(m => `${b?.name} — ${m?.name}: ${(m?.values ?? []).map(v => `${v?.value} ${v?.odd}`).join(" | ")}`)
      );

      if (!markets.length) return sendTelegram(chatId, `No odds found for fixture ${fixture}`);
      return sendTelegram(chatId, fmtList(`Odds for fixture ${fixture}`, markets.slice(0, MAX_AGG_ROWS)));
    }

    // Aggregate odds for upcoming fixtures today
    const today = new Date().toISOString().slice(0, 10);

    // 1) Get today’s fixtures to ensure team names
    const fx = await ApiFootball.fixturesByDate(today).catch(err => ({ error: err.message }));
    if (fx.error) return sendTelegram(chatId, `Odds unavailable: ${fx.error}`);
    const fixtureMap = new Map(
      (fx?.response ?? []).map(f => [f?.fixture?.id, {
        home: f?.teams?.home?.name,
        away: f?.teams?.away?.name
      }])
    );

    // 2) Get today’s odds
    const od = await ApiFootball.oddsByDate(today).catch(err => ({ error: err.message }));
    if (od.error) return sendTelegram(chatId, `Odds unavailable: ${od.error}`);

    // 3) Format safely, cap rows
    const rows = [];
    for (const entry of (od?.response ?? [])) {
      const fid = entry?.fixture?.id;
      const names = fixtureMap.get(fid) || {};
      const home = entry?.teams?.home?.name ?? names.home ?? "Home";
      const away = entry?.teams?.away?.name ?? names.away ?? "Away";

      for (const b of (entry?.bookmakers ?? [])) {
        for (const m of (b?.bets ?? [])) {
          const values = (m?.values ?? []).map(v => `${v?.value}: ${v?.odd}`).join(" | ");
          rows.push(`${home} vs ${away} — ${b?.name} ${m?.name}: ${values}`);
          if (rows.length >= MAX_AGG_ROWS) break;
        }
        if (rows.length >= MAX_AGG_ROWS) break;
      }
      if (rows.length >= MAX_AGG_ROWS) break;
    }

    if (!rows.length) return sendTelegram(chatId, "Odds for upcoming fixtures today: none");
    return sendTelegram(chatId, fmtList("Odds for upcoming fixtures today", rows));
  }
};

// ---------- Fallback ----------
async function fallbackReply(chatId, text) {
  return sendTelegram(chatId, `Unknown command: ${text}\nTry /help`);
}

// ---------- Main loop ----------
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

      // Support multiple commands per message (newline-separated)
      const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      for (const line of lines) {
        const { cmd, args } = parseArgs(line);

        switch (cmd) {
          case "/start":      await handlers.start({ chatId }); break;
          case "/help":       await handlers.help({ chatId }); break;
          case "/live":       await handlers.live({ chatId }); break;
          case "/today":      await handlers.today({ chatId, args }); break;
          case "/next":       await handlers.next({ chatId, args }); break;
          case "/fixtures":   await handlers.fixtures({ chatId, args }); break;
          case "/standings":  await handlers.standings({ chatId, args }); break;
          case "/table":      await handlers.table({ chatId, args }); break;
          case "/odds":       await handlers.odds({ chatId, args }); break;
          default:            await fallbackReply(chatId, line); break;
        }
      }
    } catch (err) {
      console.error("[Worker] loop error:", err.message);
      await sleep(400);
    }
  }
})();
