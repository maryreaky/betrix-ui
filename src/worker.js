// src/worker.js
import Redis from "ioredis";
import fetch from "node-fetch";

// ---------- Environment validation ----------
const {
  REDIS_URL,
  TELEGRAM_TOKEN,
  RAPIDAPI_KEY,
  SOFASCORE_API_BASE,     // e.g. https://api.sofascore.com
  PERFORM_API_BASE,       // e.g. https://api.perform.com
  SPORTSBOOK_API_BASE,    // e.g. https://api.yourbook.com
  OPENAI_API_KEY          // optional, for free-form chat fallback
} = process.env;

const requiredEnvs = { REDIS_URL, TELEGRAM_TOKEN };
for (const [k, v] of Object.entries(requiredEnvs)) {
  if (!v) {
    console.error(`[FATAL] Missing required env ${k}`);
    process.exit(1);
  }
}

// ---------- Utilities ----------
const redis = new Redis(REDIS_URL);
redis.on("error", err => console.error("[Redis] error:", err));

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

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
  const body = {
    chat_id: chatId,
    text,
    parse_mode: "Markdown",
    ...opts
  };
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  const res = await safeFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }, "sendMessage");
  console.log("[Telegram] reply:", res?.result?.text ?? text);
  return res;
}

// ---------- Adapters (configure endpoints in env) ----------
const SofaScore = {
  async live() {
    if (!SOFASCORE_API_BASE || !RAPIDAPI_KEY) return { ok: false, reason: "SofaScore not configured" };
    const url = `${SOFASCORE_API_BASE}/live`;
    return safeFetch(url, {
      headers: { "X-RapidAPI-Key": RAPIDAPI_KEY }
    }, "SofaScore.live");
  },
  async fixtures({ league, date }) {
    if (!SOFASCORE_API_BASE || !RAPIDAPI_KEY) return { ok: false, reason: "SofaScore not configured" };
    const qs = new URLSearchParams({ league: league ?? "", date: date ?? "" }).toString();
    const url = `${SOFASCORE_API_BASE}/fixtures?${qs}`;
    return safeFetch(url, {
      headers: { "X-RapidAPI-Key": RAPIDAPI_KEY }
    }, "SofaScore.fixtures");
  },
  async standings({ league }) {
    if (!SOFASCORE_API_BASE || !RAPIDAPI_KEY) return { ok: false, reason: "SofaScore not configured" };
    const url = `${SOFASCORE_API_BASE}/standings?league=${encodeURIComponent(league ?? "")}`;
    return safeFetch(url, {
      headers: { "X-RapidAPI-Key": RAPIDAPI_KEY }
    }, "SofaScore.standings");
  },
  async odds({ matchId }) {
    if (!SOFASCORE_API_BASE || !RAPIDAPI_KEY) return { ok: false, reason: "SofaScore not configured" };
    const url = `${SOFASCORE_API_BASE}/odds?matchId=${encodeURIComponent(matchId ?? "")}`;
    return safeFetch(url, {
      headers: { "X-RapidAPI-Key": RAPIDAPI_KEY }
    }, "SofaScore.odds");
  }
};

const Perform = {
  async matchOdds({ matchId }) {
    if (!PERFORM_API_BASE) return { ok: false, reason: "Perform not configured" };
    const url = `${PERFORM_API_BASE}/odds/match/${encodeURIComponent(matchId ?? "")}`;
    return safeFetch(url, {}, "Perform.matchOdds");
  },
  async schedule({ league, date }) {
    if (!PERFORM_API_BASE) return { ok: false, reason: "Perform not configured" };
    const qs = new URLSearchParams({ league: league ?? "", date: date ?? "" }).toString();
    const url = `${PERFORM_API_BASE}/schedule?${qs}`;
    return safeFetch(url, {}, "Perform.schedule");
  }
};

const Sportsbook = {
  async markets({ matchId }) {
    if (!SPORTSBOOK_API_BASE) return { ok: false, reason: "Sportsbook not configured" };
    const url = `${SPORTSBOOK_API_BASE}/markets/${encodeURIComponent(matchId ?? "")}`;
    return safeFetch(url, {}, "Sportsbook.markets");
  },
  async price({ matchId, market }) {
    if (!SPORTSBOOK_API_BASE) return { ok: false, reason: "Sportsbook not configured" };
    const qs = new URLSearchParams({ market: market ?? "" }).toString();
    const url = `${SPORTSBOOK_API_BASE}/price/${encodeURIComponent(matchId ?? "")}?${qs}`;
    return safeFetch(url, {}, "Sportsbook.price");
  }
};

// ---------- Command parsing ----------
function parseArgs(text) {
  const parts = text.trim().split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);
  return { cmd, args };
}

function fmtList(title, rows) {
  if (!rows?.length) return `${title}: none`;
  return `*${title}:*\n` + rows.map((r, i) => `- ${r}`).join("\n");
}

// ---------- Command handlers ----------
const handlers = {
  async start({ chatId }) {
    return sendTelegram(chatId,
      "Welcome to BETRIX — your AI sports assistant.\n\n" +
      "Try:\n" +
      "- /help\n" +
      "- /live\n" +
      "- /fixtures EPL\n" +
      "- /standings EPL\n" +
      "- /odds 12345\n" +
      "- /betslip 12345 1X2");
  },

  async help({ chatId }) {
    return sendTelegram(chatId,
      "*Commands:*\n" +
      "- /start — welcome\n" +
      "- /help — list commands\n" +
      "- /live — live matches (SofaScore)\n" +
      "- /fixtures <league|date> — upcoming fixtures\n" +
      "- /standings <league> — table\n" +
      "- /odds <matchId> — market odds\n" +
      "- /betslip <matchId> <market> — price from Sportsbook");
  },

  async live({ chatId }) {
    const data = await SofaScore.live().catch(err => ({ ok: false, error: err.message }));
    if (data?.ok === false) return sendTelegram(chatId, `Live unavailable: ${data.reason ?? data.error}`);
    const items = (data?.events ?? data?.matches ?? [])
      .slice(0, 10)
      .map(m => `${m?.home?.name ?? m?.homeTeam} vs ${m?.away?.name ?? m?.awayTeam} — ${m?.status ?? "LIVE"}`);
    return sendTelegram(chatId, fmtList("Live now", items));
  },

  async fixtures({ chatId, args }) {
    const [a1] = args;
    const param = a1 && /\d{4}-\d{2}-\d{2}/.test(a1) ? { date: a1 } : { league: a1 };
    const data = await SofaScore.fixtures(param).catch(err => ({ ok: false, error: err.message }));
    if (data?.ok === false) return sendTelegram(chatId, `Fixtures unavailable: ${data.reason ?? data.error}`);
    const items = (data?.fixtures ?? data?.events ?? [])
      .slice(0, 10)
      .map(f => `${f?.date ?? f?.kickoff} — ${f?.home?.name ?? f?.home} vs ${f?.away?.name ?? f?.away}`);
    return sendTelegram(chatId, fmtList("Upcoming fixtures", items));
  },

  async standings({ chatId, args }) {
    const league = args[0];
    if (!league) return sendTelegram(chatId, "Usage: /standings <league>");
    const data = await SofaScore.standings({ league }).catch(err => ({ ok: false, error: err.message }));
    if (data?.ok === false) return sendTelegram(chatId, `Standings unavailable: ${data.reason ?? data.error}`);
    const table = (data?.standings ?? data?.table ?? []).slice(0, 10).map(
      r => `${r?.rank ?? r?.position}. ${r?.team?.name ?? r?.team} (${r?.points ?? "-"})`
    );
    return sendTelegram(chatId, fmtList(`Standings ${league}`, table));
  },

  async odds({ chatId, args }) {
    const matchId = args[0];
    if (!matchId) return sendTelegram(chatId, "Usage: /odds <matchId>");
    // Try Perform first, then SofaScore
    const perform = await Perform.matchOdds({ matchId }).catch(() => null);
    const sofa = !perform ? await SofaScore.odds({ matchId }).catch(() => null) : null;

    const markets = perform?.markets ?? sofa?.markets ?? [];
    if (!markets.length) return sendTelegram(chatId, `No odds found for match ${matchId}`);
    const rows = markets.slice(0, 10).map(m => `${m?.name}: ${m?.prices?.map(p => `${p.outcome} ${p.odds}`).join(" | ")}`);
    return sendTelegram(chatId, fmtList(`Odds for ${matchId}`, rows));
  },

  async betslip({ chatId, args }) {
    const [matchId, market] = args;
    if (!matchId || !market) return sendTelegram(chatId, "Usage: /betslip <matchId> <market>");
    const price = await Sportsbook.price({ matchId, market }).catch(err => ({ ok: false, error: err.message }));
    if (price?.ok === false) return sendTelegram(chatId, `Sportsbook unavailable: ${price.reason ?? price.error}`);
    const rows = (price?.prices ?? price?.offers ?? []).map(p => `${p.outcome}: ${p.odds}`);
    if (!rows.length) return sendTelegram(chatId, `No prices for ${market} on match ${matchId}`);
    return sendTelegram(chatId, fmtList(`BetSlip ${market} — ${matchId}`, rows));
  }
};

// ---------- Fallback: generative or graceful ----------
async function fallbackReply(chatId, text) {
  if (OPENAI_API_KEY) {
    try {
      const body = {
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are BETRIX, an AI sports assistant. Be concise, helpful, and accurate." },
          { role: "user", content: text }
        ]
      };
      const res = await safeFetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      }, "openai.chat");
      const reply = res?.choices?.[0]?.message?.content?.trim();
      if (reply) return sendTelegram(chatId, reply);
    } catch (err) {
      console.warn("[OpenAI] fallback failed:", err.message);
    }
  }
  return sendTelegram(chatId, `Unknown command: ${text}\nTry /help`);
}

// ---------- Main worker loop ----------
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
        payload = parsed.payload ?? parsed; // handle both shapes
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

      // Route commands
      switch (cmd) {
        case "/start":       await handlers.start({ chatId }); break;
        case "/help":        await handlers.help({ chatId }); break;
        case "/live":        await handlers.live({ chatId }); break;
        case "/fixtures":    await handlers.fixtures({ chatId, args }); break;
        case "/standings":   await handlers.standings({ chatId, args }); break;
        case "/odds":        await handlers.odds({ chatId, args }); break;
        case "/betslip":     await handlers.betslip({ chatId, args }); break;
        default:             await fallbackReply(chatId, text); break;
      }
    } catch (err) {
      console.error("[Worker] loop error:", err.message);
      await sleep(400);
    }
  }
})();
