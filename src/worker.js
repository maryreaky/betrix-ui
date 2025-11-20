// src/worker.js
import Redis from "ioredis";
import fetch from "node-fetch";

// -------- Env --------
const env = {
  REDIS_URL: process.env.REDIS_URL,
  TELEGRAM_TOKEN: process.env.TELEGRAM_TOKEN,
  RAPIDAPI_KEY: process.env.RAPIDAPI_KEY,

  SOFASCORE_API_BASE: process.env.SOFASCORE_API_BASE,
  SOFASCORE_LIVE_PATH: process.env.SOFASCORE_LIVE_PATH,
  SOFASCORE_FIXTURES_PATH: process.env.SOFASCORE_FIXTURES_PATH,
  SOFASCORE_STANDINGS_PATH: process.env.SOFASCORE_STANDINGS_PATH,
  SOFASCORE_ODDS_PATH: process.env.SOFASCORE_ODDS_PATH,

  PERFORM_API_BASE: process.env.PERFORM_API_BASE,
  PERFORM_MATCH_ODDS_PATH: process.env.PERFORM_MATCH_ODDS_PATH,

  SPORTSBOOK_API_BASE: process.env.SPORTSBOOK_API_BASE,
  SPORTSBOOK_MARKETS_PATH: process.env.SPORTSBOOK_MARKETS_PATH,
  SPORTSBOOK_PRICE_PATH: process.env.SPORTSBOOK_PRICE_PATH,

  OPENAI_API_KEY: process.env.OPENAI_API_KEY
};

["REDIS_URL", "TELEGRAM_TOKEN"].forEach(k => {
  if (!env[k]) { console.error(`[FATAL] Missing env ${k}`); process.exit(1); }
});

// -------- Core utils --------
const redis = new Redis(env.REDIS_URL);
redis.on("error", err => console.error("[Redis] error:", err));

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function buildUrl(base, path, params) {
  if (!base || !path) return null;
  let p = path;
  if (params && typeof params === "object") {
    for (const [k,v] of Object.entries(params)) {
      p = p.replace(`{${k}}`, encodeURIComponent(v ?? ""));
    }
  }
  if (p.includes("?")) return `${base}${p}`;
  return `${base}${p}`;
}

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
  const url = `https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendMessage`;
  const res = await safeFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }, "sendMessage");
  console.log("[Telegram] reply:", res?.result?.text ?? text);
  return res;
}

// -------- Adapters --------
const SofaScore = {
  async live() {
    if (!env.SOFASCORE_API_BASE || !env.SOFASCORE_LIVE_PATH || !env.RAPIDAPI_KEY)
      return { ok: false, reason: "SofaScore.live not configured" };
    const url = buildUrl(env.SOFASCORE_API_BASE, env.SOFASCORE_LIVE_PATH);
    return safeFetch(url, {
      headers: { "X-RapidAPI-Key": env.RAPIDAPI_KEY }
    }, "SofaScore.live");
  },
  async fixtures({ league, date }) {
    if (!env.SOFASCORE_API_BASE || !env.SOFASCORE_FIXTURES_PATH || !env.RAPIDAPI_KEY)
      return { ok: false, reason: "SofaScore.fixtures not configured" };
    let path = env.SOFASCORE_FIXTURES_PATH;
    const qs = new URLSearchParams();
    if (league) qs.append("league", league);
    if (date) qs.append("date", date);
    if (qs.toString()) path = `${path}?${qs.toString()}`;
    const url = buildUrl(env.SOFASCORE_API_BASE, path);
    return safeFetch(url, {
      headers: { "X-RapidAPI-Key": env.RAPIDAPI_KEY }
    }, "SofaScore.fixtures");
  },
  async standings({ leagueId }) {
    if (!env.SOFASCORE_API_BASE || !env.SOFASCORE_STANDINGS_PATH || !env.RAPIDAPI_KEY)
      return { ok: false, reason: "SofaScore.standings not configured" };
    const url = buildUrl(env.SOFASCORE_API_BASE, env.SOFASCORE_STANDINGS_PATH, { leagueId });
    return safeFetch(url, {
      headers: { "X-RapidAPI-Key": env.RAPIDAPI_KEY }
    }, "SofaScore.standings");
  },
  async odds({ matchId }) {
    if (!env.SOFASCORE_API_BASE || !env.SOFASCORE_ODDS_PATH || !env.RAPIDAPI_KEY)
      return { ok: false, reason: "SofaScore.odds not configured" };
    const url = buildUrl(env.SOFASCORE_API_BASE, env.SOFASCORE_ODDS_PATH, { matchId });
    return safeFetch(url, {
      headers: { "X-RapidAPI-Key": env.RAPIDAPI_KEY }
    }, "SofaScore.odds");
  }
};

const Perform = {
  async matchOdds({ matchId }) {
    if (!env.PERFORM_API_BASE || !env.PERFORM_MATCH_ODDS_PATH)
      return { ok: false, reason: "Perform.matchOdds not configured" };
    const url = buildUrl(env.PERFORM_API_BASE, env.PERFORM_MATCH_ODDS_PATH, { matchId });
    return safeFetch(url, {}, "Perform.matchOdds");
  }
};

const Sportsbook = {
  async markets({ matchId }) {
    if (!env.SPORTSBOOK_API_BASE || !env.SPORTSBOOK_MARKETS_PATH)
      return { ok: false, reason: "Sportsbook.markets not configured" };
    const url = buildUrl(env.SPORTSBOOK_API_BASE, env.SPORTSBOOK_MARKETS_PATH, { matchId });
    return safeFetch(url, {}, "Sportsbook.markets");
  },
  async price({ matchId, market }) {
    if (!env.SPORTSBOOK_API_BASE || !env.SPORTSBOOK_PRICE_PATH)
      return { ok: false, reason: "Sportsbook.price not configured" };
    let path = env.SPORTSBOOK_PRICE_PATH.replace("{matchId}", encodeURIComponent(matchId ?? ""));
    if (market) {
      const hasQs = path.includes("?");
      const qsJoin = hasQs ? "&" : "?";
      path = `${path}${qsJoin}market=${encodeURIComponent(market)}`;
    }
    const url = buildUrl(env.SPORTSBOOK_API_BASE, path);
    return safeFetch(url, {}, "Sportsbook.price");
  }
};

// -------- Format helpers --------
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

// -------- Handlers --------
const handlers = {
  async start({ chatId }) {
    return sendTelegram(chatId,
      "Welcome to BETRIX — your AI sports assistant.\n\n" +
      "Try:\n- /help\n- /live\n- /fixtures EPL\n- /standings 17   (example leagueId)\n- /odds 12345     (example matchId)\n- /betslip 12345 1X2");
  },

  async help({ chatId }) {
    return sendTelegram(chatId,
      "*Commands:*\n" +
      "- /start — welcome\n" +
      "- /help — list commands\n" +
      "- /live — live matches\n" +
      "- /fixtures <league|date> — upcoming fixtures\n" +
      "- /standings <leagueId> — table\n" +
      "- /odds <matchId> — market odds\n" +
      "- /betslip <matchId> <market> — sportsbook price");
  },

  async live({ chatId }) {
    const data = await SofaScore.live().catch(err => ({ ok: false, error: err.message }));
    if (data?.ok === false) return sendTelegram(chatId, `Live unavailable: ${data.reason ?? data.error}`);
    const items = (data?.events ?? data?.matches ?? [])
      .slice(0, 10)
      .map(m => `${m?.homeTeam?.name ?? m?.home?.name ?? m?.home} vs ${m?.awayTeam?.name ?? m?.away?.name ?? m?.away} — ${m?.status?.description ?? m?.status ?? "LIVE"}`);
    return sendTelegram(chatId, fmtList("Live now", items));
  },

  async fixtures({ chatId, args }) {
    const [a1] = args;
    const param = a1 && /\d{4}-\d{2}-\d{2}/.test(a1) ? { date: a1 } : { league: a1 };
    const data = await SofaScore.fixtures(param).catch(err => ({ ok: false, error: err.message }));
    if (data?.ok === false) return sendTelegram(chatId, `Fixtures unavailable: ${data.reason ?? data.error}`);
    const items = (data?.fixtures ?? data?.events ?? [])
      .slice(0, 10)
      .map(f => `${f?.date ?? f?.startTimestamp ?? f?.kickoff} — ${f?.homeTeam?.name ?? f?.home?.name ?? f?.home} vs ${f?.awayTeam?.name ?? f?.away?.name ?? f?.away}`);
    return sendTelegram(chatId, fmtList("Upcoming fixtures", items));
  },

  async standings({ chatId, args }) {
    const leagueId = args[0];
    if (!leagueId) return sendTelegram(chatId, "Usage: /standings <leagueId>");
    const data = await SofaScore.standings({ leagueId }).catch(err => ({ ok: false, error: err.message }));
    if (data?.ok === false) return sendTelegram(chatId, `Standings unavailable: ${data.reason ?? data.error}`);
    const table = (data?.standings?.rows ?? data?.standings ?? data?.table ?? [])
      .slice(0, 10)
      .map(r => `${r?.position ?? r?.rank}. ${r?.team?.name ?? r?.team} (${r?.points ?? "-"})`);
    return sendTelegram(chatId, fmtList(`Standings ${leagueId}`, table));
  },

  async odds({ chatId, args }) {
    const matchId = args[0];
    if (!matchId) return sendTelegram(chatId, "Usage: /odds <matchId>");
    const perform = await Perform.matchOdds({ matchId }).catch(() => null);
    const sofa = !perform ? await SofaScore.odds({ matchId }).catch(() => null) : null;

    const markets = perform?.markets ?? sofa?.markets ?? sofa?.bookmakers?.[0]?.markets ?? [];
    if (!markets.length) return sendTelegram(chatId, `No odds found for match ${matchId}`);
    const rows = markets.slice(0, 10).map(m => {
      const prices = m?.prices ?? m?.outcomes ?? [];
      const line = prices.map(p => `${p?.outcome ?? p?.name}: ${p?.odds ?? p?.price}`).join(" | ");
      return `${m?.name ?? m?.marketName}: ${line}`;
    });
    return sendTelegram(chatId, fmtList(`Odds for ${matchId}`, rows));
  },

  async betslip({ chatId, args }) {
    const [matchId, market] = args;
    if (!matchId || !market) return sendTelegram(chatId, "Usage: /betslip <matchId> <market>");
    const price = await Sportsbook.price({ matchId, market }).catch(err => ({ ok: false, error: err.message }));
    if (price?.ok === false) return sendTelegram(chatId, `Sportsbook unavailable: ${price.reason ?? price.error}`);
    const rows = (price?.prices ?? price?.offers ?? price?.data ?? []).slice(0, 10).map(p => `${p?.outcome ?? p?.name}: ${p?.odds ?? p?.price}`);
    if (!rows.length) return sendTelegram(chatId, `No prices for ${market} on match ${matchId}`);
    return sendTelegram(chatId, fmtList(`BetSlip ${market} — ${matchId}`, rows));
  }
};

// -------- Fallback (optional OpenAI) --------
async function fallbackReply(chatId, text) {
  if (env.OPENAI_API_KEY) {
    try {
      const res = await safeFetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are BETRIX, an AI sports assistant. Be concise, helpful, and accurate." },
            { role: "user", content: text }
          ]
        })
      }, "openai.chat");
      const reply = res?.choices?.[0]?.message?.content?.trim();
      if (reply) return sendTelegram(chatId, reply);
    } catch (err) {
      console.warn("[OpenAI] fallback failed:", err.message);
    }
  }
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
        payload = parsed.payload ?? parsed; // support both shapes
      } catch (err) {
        console.error("[Parse] invalid job payload:", err.message, raw?.slice?.(0, 400) ?? "");
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
        case "/betslip":   await handlers.betslip({ chatId, args }); break;
        default:           await fallbackReply(chatId, text); break;
      }
    } catch (err) {
      console.error("[Worker] loop error:", err.message);
      await sleep(400);
    }
  }
})();
