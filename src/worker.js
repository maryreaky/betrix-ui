// src/worker.js
// BETRIX — Smooth-as-butter, launch-ready worker
// Vision: ethical, clear, one-stop assistant for fixtures, standings, neutral odds, insights, and curated digests.
// Highlights:
// - Futuristic welcome + menu with grouped commands and concise intents
// - Command normalization (strip mentions, zero-width)
// - Robust HTML escaping, safe chunking, pagination with Prev/Next + Refresh + Back
// - Match data: live/today/next/league fixtures, standings
// - Inline actions: Analyze / Odds / Lineups
// - Payments: Member & VVIP tiers, M-Pesa (Paybill/Till + STK-ready placeholders), Bitcoin, SWIFT
// - Signup flow (/signup) that routes users smoothly into /pay
// - Referrals: deep link, points, leaderboard, guard against self-referrals
// - Account status: role, expiry, referrals, points, last payment
// - Free tier perk: /free_odds gives 2 neutral odds snapshots daily
// - Strategy module: /strategy rotates neutral, discipline-based tips
// - Friendly errors, consistent disclaimers, ethical guardrails
// - Admin tools: approve, force_role, audit (stubs)
// - Scheduler stubs for VVIP morning digest & expiry reminders (manual trigger placeholders)

import Redis from "ioredis";
import fetch from "node-fetch";

// ---------- Env ----------
const {
  REDIS_URL,
  TELEGRAM_TOKEN,
  API_FOOTBALL_KEY,
  API_FOOTBALL_BASE,
  TELEGRAM_SAFE_CHUNK,
  ADMIN_TELEGRAM_ID,
  SERVICE_NAME,
  BOT_USERNAME,

  // Payment details (fill these for real integrations)
  MPESA_PAYBILL,         // e.g., "123456"
  MPESA_TILL,            // optional: "123456"
  MPESA_ACCOUNT,         // e.g., "BETRIX"
  BTC_ADDRESS,           // e.g., "bc1qexample..."
  SWIFT_BANK_NAME,       // e.g., "Example Bank"
  SWIFT_ACCOUNT_NAME,    // e.g., "BETRIX LTD"
  SWIFT_IBAN,            // e.g., "XX00 XXXX XXXX XXXX ..."
  SWIFT_SWIFT,           // e.g., "ABCD1234"
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

const PAGE_SIZE = 5;
const MAX_TABLE_ROWS = 20;
const MAX_AGG_ROWS = 30;
const FREE_ODDS_DAILY_LIMIT = 2;

// Pricing and roles
const SIGNUP_FEE_KES = 150;
const SIGNUP_FEE_USD = 1;

const VVIP_DAILY_KES = 200;
const VVIP_WEEKLY_KES = 800;
const VVIP_MONTHLY_KES = 2500;

const VVIP_DAILY_USD = 2;
const VVIP_WEEKLY_USD = 6;
const VVIP_MONTHLY_USD = 20;

const ROLE_FREE = "free";
const ROLE_MEMBER = "member";
const ROLE_VVIP = "vvip";

// VVIP durations (ms)
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const MONTH_MS = 30 * DAY_MS;

// League mapping
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

// ---------- Emojis & UI ----------
const ICONS = {
  brand: "🚀",
  live: "🔴",
  today: "📅",
  next: "⏭️",
  fixtures: "📜",
  standings: "📊",
  odds: "🎲",
  tips: "🧠",
  analysis: "🔍",
  lineups: "🧾",
  h2h: "⚔️",
  news: "🗞️",
  pricing: "💵",
  pay: "💳",
  status: "🧩",
  support: "🛠️",
  menu: "🧭",
  vvip: "💎",
  rules: "🛡️",
  about: "ℹ️",
  contact: "✉️",
  refer: "👥",
  rewards: "🏆",
  leaderboard: "🥇",
  pagePrev: "◀️",
  pageNext: "▶️",
  pageInfo: "🔢",
  refresh: "🔄",
  back: "⬅️",
  signup: "📝",
  strategy: "📐",
  free: "🎁"
};
const MEMES = [
  "⚡ Neutral insights only. No hype, just signal.",
  "🧠 Smart is calm. Calm is profitable (in time).",
  "🎯 Process over luck. Every day.",
  "🛰️ Futuristic menu, grounded ethics."
];
const STRATEGY_TIPS = [
  "Bankroll discipline: stake small, consistent amounts; never chase losses.",
  "Specialize: focus on one league/market to reduce noise and improve context.",
  "Use multiple lenses: standings + form + neutral odds for a fuller picture.",
  "Time boundaries: set daily limits; this is entertainment, not pressure.",
  "Treat odds as information, not guarantees; avoid overconfidence.",
  "Prefer clarity: if a match feels chaotic, skip it and enjoy the game."
];

// ---------- Redis ----------
const redis = new Redis(REDIS_URL);
redis.on("error", err => console.error("[Redis] error:", err));

// ---------- Utils ----------
const sleep = ms => new Promise(r => setTimeout(r, ms));

function normalizeTextSpaces(text) {
  // Remove zero-width and non-breaking spaces
  return String(text).replace(/\u200B|\u200C|\u200D|\u2060|\u00A0/g, "");
}
function normalizeCmd(text) {
  const t = normalizeTextSpaces(text).trim();
  const first = t.split(/\s+/)[0];
  return first.replace(/@[\w_]+$/, "").toLowerCase();
}
function parseArgs(text) {
  const cleaned = normalizeTextSpaces(text).trim();
  const parts = cleaned.split(/\s+/);
  const rawCmd = parts[0];
  const cmd = rawCmd.replace(/@[\w_]+$/, "").toLowerCase();
  const args = parts.slice(1);
  return { cmd, args };
}

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

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
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
    const suffix = chunks.length > 1 ? `\n\nPage ${i + 1}/${chunks.length}` : "";
    const body = {
      chat_id: chatId,
      text: chunks[i] + suffix,
      parse_mode: "HTML",
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

async function editMessageText(chatId, messageId, text, replyMarkup = undefined) {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/editMessageText`;
  const body = {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {})
  };
  await safeFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }, "editMessageText");
}

async function answerCallbackQuery(callbackQueryId, text = "") {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`;
  const body = { callback_query_id: callbackQueryId, text, show_alert: false };
  await safeFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }, "answerCallbackQuery");
}

function fmtList(title, rows) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return `<b>${escapeHtml(title)}:</b> none`;
  return `<b>${escapeHtml(title)}:</b>\n` + list.map(r => `- ${escapeHtml(r)}`).join("\n");
}

function fmtDate(iso) {
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  } catch {
    return iso;
  }
}

function defaultSeason() {
  const d = new Date();
  const m = d.getUTCMonth() + 1;
  const y = d.getUTCFullYear();
  return m >= 7 ? y : y - 1;
}

function pickOne(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function usage(str) {
  return str.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function friendlyError(err, prefix) {
  const msg = typeof err === "string" ? err : (err?.message || "Unknown error");
  return `${prefix} temporarily unavailable. Please try again shortly.\nDetails: ${escapeHtml(msg)}`;
}

// ---------- Cache helpers ----------
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

// ---------- User storage, referrals, roles ----------
async function getUser(userId) {
  const key = `user:${userId}`;
  const raw = await redis.get(key);
  return raw ? JSON.parse(raw) : null;
}
async function putUser(userId, data) {
  const key = `user:${userId}`;
  const current = await getUser(userId) || {};
  const next = { ...current, ...data };
  await redis.set(key, JSON.stringify(next));
  return next;
}
function isPaid(user) { return Boolean(user?.paid_at); }
function isVVIP(user) {
  if (user?.role !== ROLE_VVIP) return false;
  if (!user?.vvip_expires_at) return true;
  return Date.now() < Number(user.vvip_expires_at);
}

function makeReferralCode(userId) {
  const base = Buffer.from(String(userId)).toString("base64").replace(/=+/g, "");
  const rand = Math.random().toString(36).slice(2, 6);
  return `${base}-${rand}`;
}
async function getOrCreateReferral(userId) {
  let user = await getUser(userId);
  if (!user?.referral_code) {
    const code = makeReferralCode(userId);
    user = await putUser(userId, { referral_code: code, referrals_count: 0, rewards_points: 0 });
  }
  return user.referral_code;
}
async function applyReferral(code, newUserId) {
  const base = (code || "").split("-")[0];
  let referrerId;
  try {
    referrerId = Buffer.from(base, "base64").toString("utf8");
  } catch { return null; }
  if (!/^\d+$/.test(referrerId)) return null;

  // prevent self-referrals counting to leaderboard
  if (String(referrerId) !== String(newUserId)) {
    const refUser = await getUser(referrerId) || {};
    const count = Number(refUser.referrals_count || 0) + 1;
    const points = Number(refUser.rewards_points || 0) + 10;
    await putUser(referrerId, { referrals_count: count, rewards_points: points });
    await redis.zincrby("leaderboard:referrals", 1, String(referrerId));
  }
  await putUser(newUserId, { referred_by: referrerId, referral_used: code });
  return referrerId;
}

// ---------- Gating ----------
function gateFreeCommands(cmd) {
  const free = new Set([
    "/start", "/menu", "/help", "/status", "/pricing", "/about", "/rules",
    "/contact", "/support", "/news", "/tips", "/refer", "/rewards", "/leaderboard",
    "/live", "/today", "/next", "/fixtures", "/standings",
    "/signup", "/pay",
    "/free_odds", "/strategy",
    "/fixed"
  ]);
  return free.has(cmd);
}
function gateMemberCommands(cmd) {
  const member = new Set([
    "/odds", "/analysis", "/form", "/headtohead", "/lineups", "/injuries", "/markets", "/schedule"
  ]);
  return member.has(cmd);
}
function gateVVIPCommands(cmd) {
  const vvip = new Set([
    "/vvip", "/vvip_today", "/vvip_matches", "/vvip_digest"
  ]);
  return vvip.has(cmd);
}

// ---------- API-Football ----------
const ApiFootball = {
  async live() {
    const key = `fixtures:live:${TZ}`;
    const hit = await cacheGet(key);
    if (hit) return hit;
    const url = `${API_FOOTBALL_BASE}/fixtures?live=all&timezone=${encodeURIComponent(TZ)}`;
    const data = await safeFetch(url, { headers: HEADERS }, "ApiFootball.live");
    await cacheSet(key, data, 30);
    return data;
  },

  async fixtures({ league, season }) {
    const key = `fixtures:league:${league}:season:${season}:${TZ}`;
    const hit = await cacheGet(key);
    if (hit) return hit;
    const url = `${API_FOOTBALL_BASE}/fixtures?league=${encodeURIComponent(league)}&season=${encodeURIComponent(season)}&timezone=${encodeURIComponent(TZ)}`;
    const data = await safeFetch(url, { headers: HEADERS }, "ApiFootball.fixtures");
    await cacheSet(key, data, 300);
    return data;
  },

  async fixturesByDate(date, { league } = {}) {
    const key = `fixtures:date:${date}:league:${league || "all"}:${TZ}`;
    const hit = await cacheGet(key);
    if (hit) return hit;
    const url = `${API_FOOTBALL_BASE}/fixtures?date=${encodeURIComponent(date)}${league ? `&league=${encodeURIComponent(league)}` : ""}&timezone=${encodeURIComponent(TZ)}`;
    const data = await safeFetch(url, { headers: HEADERS }, "ApiFootball.fixturesByDate");
    await cacheSet(key, data, 300);
    return data;
  },

  async nextFixtures({ count = 10, league }) {
    const key = `fixtures:next:${count}:league:${league || "all"}:${TZ}`;
    const hit = await cacheGet(key);
    if (hit) return hit;
    const url = `${API_FOOTBALL_BASE}/fixtures?next=${Number(count)}${league ? `&league=${encodeURIComponent(league)}` : ""}&timezone=${encodeURIComponent(TZ)}`;
    const data = await safeFetch(url, { headers: HEADERS }, "ApiFootball.fixturesNext");
    await cacheSet(key, data, 300);
    return data;
  },

  async standings({ league, season }) {
    const key = `standings:${league}:${season}`;
    const hit = await cacheGet(key);
    if (hit) return hit;
    const url = `${API_FOOTBALL_BASE}/standings?league=${encodeURIComponent(league)}&season=${encodeURIComponent(season)}`;
    const data = await safeFetch(url, { headers: HEADERS }, "ApiFootball.standings");
    await cacheSet(key, data, 21600);
    return data;
  },

  async odds({ fixture }) {
    const key = `odds:fixture:${fixture}:${TZ}`;
    const hit = await cacheGet(key);
    if (hit) return hit;
    const url = `${API_FOOTBALL_BASE}/odds?fixture=${encodeURIComponent(fixture)}&timezone=${encodeURIComponent(TZ)}`;
    const data = await safeFetch(url, { headers: HEADERS }, "ApiFootball.odds");
    await cacheSet(key, data, 120);
    return data;
  },

  async oddsByDate(date, { league } = {}) {
    const key = `odds:date:${date}:league:${league || "all"}:${TZ}`;
    const hit = await cacheGet(key);
    if (hit) return hit;
    const url = `${API_FOOTBALL_BASE}/odds?date=${encodeURIComponent(date)}${league ? `&league=${encodeURIComponent(league)}` : ""}&timezone=${encodeURIComponent(TZ)}`;
    const data = await safeFetch(url, { headers: HEADERS }, "ApiFootball.oddsByDate");
    await cacheSet(key, data, 120);
    return data;
  }
};

// ---------- Format helpers ----------
function fmtFixtureItem(f) {
  const date = escapeHtml(fmtDate(f?.fixture?.date));
  const home = escapeHtml(f?.teams?.home?.name ?? "Home");
  const away = escapeHtml(f?.teams?.away?.name ?? "Away");
  const fid = escapeHtml(f?.fixture?.id ?? "N/A");
  return `${date} — ${home} vs ${away} (ID: ${fid})`;
}

function listLive(title, arr, page, totalPages) {
  const start = page * PAGE_SIZE;
  const slice = (arr ?? []).slice(start, start + PAGE_SIZE);
  const items = slice.map(f => {
    const home = escapeHtml(f?.teams?.home?.name ?? "Home");
    const away = escapeHtml(f?.teams?.away?.name ?? "Away");
    const hs = escapeHtml(f?.goals?.home ?? 0);
    const as = escapeHtml(f?.goals?.away ?? 0);
    const status = escapeHtml(f?.fixture?.status?.short ?? "LIVE");
    const fid = escapeHtml(f?.fixture?.id ?? "N/A");
    return `${home} vs ${away} — ${hs}:${as} (${status}) (ID: ${fid})`;
  });
  const header = `${ICONS.live} ${title} ${ICONS.pageInfo} Page ${page + 1}/${totalPages}`;
  return fmtList(header, items);
}

function listFixtures(title, arr, page, totalPages) {
  const start = page * PAGE_SIZE;
  const slice = (arr ?? []).slice(start, start + PAGE_SIZE);
  const items = slice.map(fmtFixtureItem);
  const header = `${ICONS.fixtures} ${title} ${ICONS.pageInfo} Page ${page + 1}/${totalPages}`;
  return fmtList(header, items);
}

function listStandings(title, arr) {
  const rows = (arr ?? []).slice(0, MAX_TABLE_ROWS).map(r =>
    `${escapeHtml(r?.rank)}. ${escapeHtml(r?.team?.name)} — ${escapeHtml(r?.points)} pts (W${escapeHtml(r?.all?.win)}-D${escapeHtml(r?.all?.draw)}-L${escapeHtml(r?.all?.lose)})`
  );
  return fmtList(`${ICONS.standings} ${title}`, rows);
}

// ---------- Pagination state ----------
async function setPage(chatId, context, page) {
  const key = `page:${chatId}:${context}`;
  await redis.set(key, String(page), "EX", 600);
}
async function getPage(chatId, context) {
  const key = `page:${chatId}:${context}`;
  const raw = await redis.get(key);
  return raw ? Number(raw) : 0;
}
async function setList(chatId, context, list) {
  const key = `list:${chatId}:${context}`;
  await redis.set(key, JSON.stringify(list || []), "EX", 600);
}
async function getList(chatId, context) {
  const key = `list:${chatId}:${context}`;
  const raw = await redis.get(key);
  return raw ? JSON.parse(raw) : [];
}

// ---------- Inline keyboards ----------
function kbForFixtures(fixtures, page, totalPages, contextTag = "FX") {
  const slice = (fixtures ?? []).slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const rows = slice.map(f => {
    const fid = String(f?.fixture?.id ?? "");
    return [
      { text: "🔍 Analyze", callback_data: `ANALYZE:${fid}` },
      { text: "🎲 Odds",    callback_data: `ODDS:${fid}` },
      { text: "🧾 Lineups", callback_data: `LINEUPS:${fid}` }
    ];
  });

  const nav = [];
  if (page > 0) nav.push({ text: `${ICONS.pagePrev} Prev`, callback_data: `PAGENAV:${contextTag}:${page - 1}` });
  if (page + 1 < totalPages) nav.push({ text: `${ICONS.pageNext} Next`, callback_data: `PAGENAV:${contextTag}:${page + 1}` });
  if (nav.length) rows.push(nav);

  rows.push([{ text: `${ICONS.refresh} Refresh`, callback_data: `REFRESH:${contextTag}:${page}` }]);
  rows.push([{ text: `🧭 Back to menu`, callback_data: "SHOW_MENU" }]);

  return { inline_keyboard: rows };
}

function universalNav(page, totalPages, contextTag) {
  const navRow = [
    ...(page > 0 ? [{ text: `${ICONS.pagePrev} Prev`, callback_data: `PAGENAV:${contextTag}:${page - 1}` }] : []),
    ...(page + 1 < totalPages ? [{ text: `${ICONS.pageNext} Next`, callback_data: `PAGENAV:${contextTag}:${page + 1}` }] : [])
  ];
  const rows = [];
  if (navRow.length) rows.push(navRow);
  rows.push([{ text: `${ICONS.refresh} Refresh`, callback_data: `REFRESH:${contextTag}:${page}` }]);
  rows.push([{ text: `🧭 Back to menu`, callback_data: "SHOW_MENU" }]);
  return { inline_keyboard: rows };
}

// ---------- Payment pipeline ----------
async function showSignup(chatId) {
  const text =
    `${ICONS.signup} <b>Signup</b>\n` +
    `Choose your path:\n` +
    `- Member: KES ${SIGNUP_FEE_KES} / USD ${SIGNUP_FEE_USD}\n` +
    `- VVIP Daily: KES ${VVIP_DAILY_KES} / USD ${VVIP_DAILY_USD}\n` +
    `- VVIP Weekly: KES ${VVIP_WEEKLY_KES} / USD ${VVIP_WEEKLY_USD}\n` +
    `- VVIP Monthly: KES ${VVIP_MONTHLY_KES} / USD ${VVIP_MONTHLY_USD}\n\n` +
    `Next: select a tier below, then choose your payment method.`;

  const kb = {
    inline_keyboard: [
      [{ text: `Member — KES ${SIGNUP_FEE_KES}`, callback_data: "PAY:member:kES" },
       { text: `Member — USD ${SIGNUP_FEE_USD}`, callback_data: "PAY:member:USD" }],
      [{ text: `VVIP Daily — KES ${VVIP_DAILY_KES}`, callback_data: "PAY:vvip:daily:kes" },
       { text: `VVIP Daily — USD ${VVIP_DAILY_USD}`, callback_data: "PAY:vvip:daily:usd" }],
      [{ text: `VVIP Weekly — KES ${VVIP_WEEKLY_KES}`, callback_data: "PAY:vvip:weekly:kes" },
       { text: `VVIP Weekly — USD ${VVIP_WEEKLY_USD}`, callback_data: "PAY:vvip:weekly:usd" }],
      [{ text: `VVIP Monthly — KES ${VVIP_MONTHLY_KES}`, callback_data: "PAY:vvip:monthly:kes" },
       { text: `VVIP Monthly — USD ${VVIP_MONTHLY_USD}`, callback_data: "PAY:vvip:monthly:usd" }],
      [{ text: "Pay via M-Pesa (KES)", callback_data: "PAY:mpesa:kes" },
       { text: "Pay via Bitcoin (USD)", callback_data: "PAY:bitcoin:usd" }],
      [{ text: "Pay via SWIFT (USD/EUR)", callback_data: "PAY:swift:usd" }],
      [{ text: `🧭 Back to menu`, callback_data: "SHOW_MENU" }]
    ]
  };
  return sendTelegram(chatId, text, { reply_markup: kb });
}

async function showPaymentOptions(chatId) {
  const text =
    `${ICONS.pay} <b>Payment options</b>\n` +
    `Member signup: KES ${SIGNUP_FEE_KES} / USD ${SIGNUP_FEE_USD}\n` +
    `VVIP tiers:\n` +
    `- Daily: KES ${VVIP_DAILY_KES} / USD ${VVIP_DAILY_USD}\n` +
    `- Weekly: KES ${VVIP_WEEKLY_KES} / USD ${VVIP_WEEKLY_USD}\n` +
    `- Monthly: KES ${VVIP_MONTHLY_KES} / USD ${VVIP_MONTHLY_USD}\n\n` +
    `Select a tier and payment method. After payment, redeem with /redeem &lt;receipt&gt; [daily|weekly|monthly].`;

  const kb = {
    inline_keyboard: [
      [{ text: `Member — KES ${SIGNUP_FEE_KES}`, callback_data: "PAY:member:kES" },
       { text: `Member — USD ${SIGNUP_FEE_USD}`, callback_data: "PAY:member:USD" }],
      [{ text: `VVIP Daily — KES ${VVIP_DAILY_KES}`, callback_data: "PAY:vvip:daily:kes" },
       { text: `VVIP Daily — USD ${VVIP_DAILY_USD}`, callback_data: "PAY:vvip:daily:usd" }],
      [{ text: `VVIP Weekly — KES ${VVIP_WEEKLY_KES}`, callback_data: "PAY:vvip:weekly:kes" },
       { text: `VVIP Weekly — USD ${VVIP_WEEKLY_USD}`, callback_data: "PAY:vvip:weekly:usd" }],
      [{ text: `VVIP Monthly — KES ${VVIP_MONTHLY_KES}`, callback_data: "PAY:vvip:monthly:kes" },
       { text: `VVIP Monthly — USD ${VVIP_MONTHLY_USD}`, callback_data: "PAY:vvip:monthly:usd" }],
      [{ text: "Pay via M-Pesa (KES)", callback_data: "PAY:mpesa:kes" },
       { text: "Pay via Bitcoin (USD)", callback_data: "PAY:bitcoin:usd" }],
      [{ text: "Pay via SWIFT (USD/EUR)", callback_data: "PAY:swift:usd" }],
      [{ text: `🧭 Back to menu`, callback_data: "SHOW_MENU" }]
    ]
  };
  return sendTelegram(chatId, text, { reply_markup: kb });
}

async function handlePaySelect(chatId, callbackQueryId, selection, userId) {
  await answerCallbackQuery(callbackQueryId, "Payment selected.");

  // Payment methods (M-Pesa / BTC / SWIFT)
  if (selection.startsWith("mpesa")) {
    const text =
      `${ICONS.pay} <b>M-Pesa Payment</b>\n` +
      `Paybill: ${escapeHtml(MPESA_PAYBILL || "—")}${MPESA_TILL ? ` | Till: ${escapeHtml(MPESA_TILL)}` : ""}\n` +
      `Account: ${escapeHtml(MPESA_ACCOUNT || "—")}\n` +
      `Amount: KES ${SIGNUP_FEE_KES} (member) or your chosen VVIP tier\n\n` +
      `After payment, reply:\n` +
      `/redeem &lt;M-Pesa transaction code&gt; [daily|weekly|monthly]\n\n` +
      `Note: STK Push & auto-verification will be enabled via webhook; for now, manual verification applies.`;
    return sendTelegram(chatId, text);
  }
  if (selection.startsWith("bitcoin")) {
    const text =
      `${ICONS.pay} <b>Bitcoin Payment</b>\n` +
      `Wallet: ${escapeHtml(BTC_ADDRESS || "—")}\n` +
      `Amount: USD equivalent for selected tier\n\n` +
      `After sending, reply:\n` +
      `/redeem &lt;tx-hash&gt; [daily|weekly|monthly]\n\n` +
      `Note: Auto-verification will be enabled via on-chain webhook; manual for now.`;
    return sendTelegram(chatId, text);
  }
  if (selection.startsWith("swift")) {
    const text =
      `${ICONS.pay} <b>SWIFT Payment</b>\n` +
      `Bank: ${escapeHtml(SWIFT_BANK_NAME || "—")}\n` +
      `Beneficiary: ${escapeHtml(SWIFT_ACCOUNT_NAME || "—")}\n` +
      `IBAN: ${escapeHtml(SWIFT_IBAN || "—")}\n` +
      `SWIFT: ${escapeHtml(SWIFT_SWIFT || "—")}\n` +
      `Amount: USD/EUR equivalent\n\n` +
      `After transfer, reply:\n` +
      `/redeem &lt;reference&gt; [daily|weekly|monthly]\n\n` +
      `Note: SWIFT can take 1–3 days; verification is manual unless bank webhook is connected.`;
    return sendTelegram(chatId, text);
  }

  // Tiers
  let text = "";
  if (selection.startsWith("member")) {
    const fee = selection.endsWith("kES") ? `KES ${SIGNUP_FEE_KES}` : `USD ${SIGNUP_FEE_USD}`;
    text =
      `${ICONS.pay} <b>Member payment</b>\n` +
      `Amount: ${fee}\n\n` +
      `Steps:\n` +
      `1) Complete payment via your chosen method\n` +
      `2) Reply here with: /redeem &lt;receipt-code&gt;\n` +
      `3) Admin verifies (or auto-verifies when integrated) and activates your role.\n\n` +
      `Tip: Use /status to check your role.`;
  } else {
    const parts = selection.split(":"); // vvip:daily|weekly|monthly:kes|usd
    const tier = parts[1];
    let tierText = "";
    if (tier === "daily") tierText = `Daily — KES ${VVIP_DAILY_KES} / USD ${VVIP_DAILY_USD}`;
    else if (tier === "weekly") tierText = `Weekly — KES ${VVIP_WEEKLY_KES} / USD ${VVIP_WEEKLY_USD}`;
    else tierText = `Monthly — KES ${VVIP_MONTHLY_KES} / USD ${VVIP_MONTHLY_USD}`;
    text =
      `${ICONS.vvip} <b>VVIP payment</b>\n` +
      `Tier: ${tierText}\n\n` +
      `Steps:\n` +
      `1) Complete payment via your chosen method\n` +
      `2) Reply here with: /redeem &lt;receipt-code&gt; ${tier}\n` +
      `3) Admin verifies (or auto-verifies when integrated) and activates VVIP with expiry.\n\n` +
      `Tip: Use /status to check expiry.`;
  }
  return sendTelegram(chatId, text);
}

// Mock redemption — replace with real webhook verification later
async function redeemFlow(chatId, args, fromId) {
  // /redeem <code> [daily|weekly|monthly]
  const [code, tier] = args;
  if (!code) {
    return sendTelegram(chatId, usage(`${ICONS.pay} Usage: /redeem <receipt-code> [daily|weekly|monthly]`));
  }
  const now = Date.now();

  // Record last payment reference for /status
  await putUser(fromId, { last_payment_ref: code, last_payment_at: now });

  if (!tier) {
    await putUser(fromId, { role: ROLE_MEMBER, paid_at: now });
    return sendTelegram(chatId, `${ICONS.status} Member activated. Welcome! Use /menu to explore member commands.`);
  }

  let delta = MONTH_MS;
  if (tier === "daily") delta = DAY_MS;
  else if (tier === "weekly") delta = WEEK_MS;
  else if (tier === "monthly") delta = MONTH_MS;

  await putUser(fromId, { role: ROLE_VVIP, paid_at: now, vvip_expires_at: now + delta });
  return sendTelegram(chatId, `${ICONS.vvip} VVIP activated (${escapeHtml(tier)}). Expires: ${new Date(now + delta).toLocaleDateString()}`);
}

// ---------- Handlers ----------
const handlers = {
  async start({ chatId }) {
    const meme = pickOne(MEMES);
    const fee = `KES ${SIGNUP_FEE_KES} / USD ${SIGNUP_FEE_USD}`;
    const tiers =
      `Daily KES ${VVIP_DAILY_KES} / USD ${VVIP_DAILY_USD} • ` +
      `Weekly KES ${VVIP_WEEKLY_KES} / USD ${VVIP_WEEKLY_USD} • ` +
      `Monthly KES ${VVIP_MONTHLY_KES} / USD ${VVIP_MONTHLY_USD}`;

    const text =
      `<b>${ICONS.brand} BETRIX</b> — your ethical, AI-powered football assistant.\n` +
      `One clean place for fixtures, standings, neutral odds, and curated digests.\n` +
      `No predictions or “fixed matches” — just signal.\n\n` +
      `${ICONS.pricing} Member: ${fee}\n` +
      `${ICONS.vvip} VVIP: ${tiers}\n` +
      `${ICONS.pay} Pay seamlessly via M-Pesa, Bitcoin, or SWIFT.\n\n` +
      `Open the Futuristic Menu below to begin.\n\n` +
      `${meme}`;
    const kb = { inline_keyboard: [[{ text: "🧭 Open menu", callback_data: "SHOW_MENU" }]] };
    return sendTelegram(chatId, text, { reply_markup: kb });
  },

  async menu({ chatId }) {
    const text =
      `<b>${ICONS.menu} Futuristic menu</b>\n` +
      `\n<b>Match data</b>\n` +
      `${ICONS.live} /live — Live matches (scores, status, quick actions)\n` +
      `${ICONS.today} /today [league] — Today’s fixtures (paginated)\n` +
      `${ICONS.next} /next [count] [league] — Upcoming fixtures\n` +
      `${ICONS.fixtures} /fixtures &lt;league|id&gt; &lt;season?&gt; — League fixtures\n` +
      `${ICONS.standings} /standings &lt;league|id&gt; &lt;season?&gt; — League table\n` +
      `\n<b>Insights (members)</b>\n` +
      `${ICONS.odds} /odds [fixtureId] — Neutral odds (paginated markets)\n` +
      `${ICONS.analysis} /analysis [league season] — Standings-based context\n` +
      `${ICONS.h2h} /headtohead &lt;home&gt; &lt;away&gt; — Neutral H2H\n` +
      `${ICONS.lineups} /lineups &lt;fixtureId&gt; — Lineups (coming soon)\n` +
      `\n<b>Free perks</b>\n` +
      `${ICONS.free} /free_odds — 2 neutral odds snapshots daily\n` +
      `${ICONS.strategy} /strategy — Winning discipline (neutral tips)\n` +
      `\n<b>Account & payments</b>\n` +
      `${ICONS.signup} /signup — Become Member or go VVIP\n` +
      `${ICONS.pricing} /pricing — Transparent tiers\n` +
      `${ICONS.pay} /pay — M-Pesa / Bitcoin / SWIFT + tiers\n` +
      `${ICONS.status} /status — Role, expiry, referrals, points, last payment\n` +
      `${ICONS.refer} /refer — Referral link\n` +
      `${ICONS.rewards} /rewards — Rewards status\n` +
      `${ICONS.leaderboard} /leaderboard — Top referrers\n` +
      `\n<b>Trust & info</b>\n` +
      `${ICONS.rules} /rules — Ethical guardrails\n` +
      `${ICONS.about} /about — About BETRIX\n` +
      `${ICONS.contact} /contact — Contact & support\n\n` +
      `Note: “Fixed matches” are refused. Use /fixed for details.`;
    return sendTelegram(chatId, text);
  },

  async help({ chatId }) {
    const text =
      `<b>${ICONS.menu} Help</b>\n` +
      `Use ${ICONS.pagePrev} Prev / ${ICONS.pageNext} Next to navigate, ${ICONS.refresh} Refresh for latest data, and 🧭 Back to menu everywhere.\n` +
      `League shortcuts: <i>epl</i>, <i>laliga</i>, <i>seriea</i>, <i>bundesliga</i>, <i>ligue1</i>, <i>ucl</i> or numeric IDs.\n` +
      `Members unlock neutral odds and analysis. VVIP gets curated digests.`;
    return sendTelegram(chatId, text);
  },

  async about({ chatId }) {
    return sendTelegram(chatId,
      `${ICONS.about} <b>About BETRIX</b>\n` +
      `Neutral football context with ethical guardrails. No predictions or guarantees, no “fixed matches”.`);
  },

  async rules({ chatId }) {
    return sendTelegram(chatId,
      `${ICONS.rules} <b>Rules & Ethics</b>\n` +
      `- Respectful use\n` +
      `- Neutral information only\n` +
      `- No “fixed matches”\n` +
      `- Avoid financial harm`);
  },

  async contact({ chatId }) {
    return sendTelegram(chatId,
      `${ICONS.contact} <b>Contact</b>\n` +
      `Use /support for assistance. Admin approval requires manual review if enabled.`);
  },

  async support({ chatId }) {
    return sendTelegram(chatId,
      `${ICONS.support} <b>Support</b>\n` +
      `- /menu for commands\n` +
      `- /signup to choose tiers\n` +
      `- /pay to complete payment\n` +
      `- /status to check role, expiry, referrals, points`);
  },

  async pricing({ chatId }) {
    const text =
      `${ICONS.pricing} <b>Pricing</b>\n` +
      `Member (signup): KES ${SIGNUP_FEE_KES} / USD ${SIGNUP_FEE_USD}\n` +
      `VVIP tiers:\n` +
      `- Daily: KES ${VVIP_DAILY_KES} / USD ${VVIP_DAILY_USD}\n` +
      `- Weekly: KES ${VVIP_WEEKLY_KES} / USD ${VVIP_WEEKLY_USD}\n` +
      `- Monthly: KES ${VVIP_MONTHLY_KES} / USD ${VVIP_MONTHLY_USD}\n\n` +
      `Access levels:\n` +
      `- Free: schedules, standings, info + 2 free odds daily\n` +
      `- Member: neutral odds, analysis, form, H2H, lineups\n` +
      `- VVIP: curated digest and personalized dashboards (neutral only)`;
    return sendTelegram(chatId, text);
  },

  async signup({ chatId }) {
    return showSignup(chatId);
  },

  async pay({ chatId }) {
    return showPaymentOptions(chatId);
  },

  async status({ chatId, user }) {
    const role = user?.role || ROLE_FREE;
    const paid = isPaid(user) ? `Yes (since ${new Date(user.paid_at).toLocaleDateString()})` : "No";
    const vvipExp = user?.vvip_expires_at ? new Date(user.vvip_expires_at).toLocaleDateString() : "N/A";
    const lastPayment = user?.last_payment_ref ? `Ref: ${escapeHtml(user.last_payment_ref)} (${new Date(user.last_payment_at).toLocaleDateString()})` : "None";
    const freeOddsUsed = Number(user?.free_odds_count || 0);
    const text =
      `${ICONS.status} <b>Account status</b>\n` +
      `- Role: ${escapeHtml(role)}\n` +
      `- Paid member: ${escapeHtml(paid)}\n` +
      `- VVIP active: ${isVVIP(user) ? "Yes" : "No"}\n` +
      `- VVIP expires: ${escapeHtml(vvipExp)}\n` +
      `- Free odds used today: ${escapeHtml(String(freeOddsUsed))}/${FREE_ODDS_DAILY_LIMIT}\n` +
      `- Referrals: ${escapeHtml(String(user?.referrals_count || 0))}\n` +
      `- Rewards points: ${escapeHtml(String(user?.rewards_points || 0))}\n` +
      `- Last payment: ${lastPayment}\n\n` +
      `Use /pricing, /signup and /pay to upgrade.`;
    return sendTelegram(chatId, text);
  },

  async refer({ chatId, user, fromId }) {
    const code = await getOrCreateReferral(fromId);
    const bot = escapeHtml(BOT_USERNAME || "BETRIXXXXX_bot");
    const link = `https://t.me/${bot}?start=${escapeHtml(code)}`;
    const text =
      `${ICONS.refer} <b>Your referral link</b>\n` +
      `Share: ${link}\n\n` +
      `Rewards:\n` +
      `- +10 points per activated referral\n` +
      `- Points can be redeemed later for perks (e.g., VVIP discounts)`;
    return sendTelegram(chatId, text);
  },

  async rewards({ chatId, user }) {
    const text =
      `${ICONS.rewards} <b>Your rewards</b>\n` +
      `Referrals: ${escapeHtml(String(user?.referrals_count || 0))}\n` +
      `Points: ${escapeHtml(String(user?.rewards_points || 0))}\n\n` +
      `Redeem: Coming soon (apply points towards VVIP tiers).`;
    return sendTelegram(chatId, text);
  },

  async leaderboard({ chatId, fromId }) {
    const entries = await redis.zrevrange("leaderboard:referrals", 0, 9, "WITHSCORES").catch(() => []);
    const rows = [];
    let yourRankLine = null;

    // calculate your rank if present
    const yourScore = await redis.zscore("leaderboard:referrals", String(fromId)).catch(() => null);
    if (yourScore !== null) {
      const rank = await redis.zrevrank("leaderboard:referrals", String(fromId)).catch(() => null);
      if (rank !== null) {
        yourRankLine = `Your rank: #${rank + 1} with ${yourScore} referrals`;
      }
    }

    for (let i = 0; i < entries.length; i += 2) {
      const userId = entries[i];
      const score = entries[i + 1];
      rows.push(`#${i / 2 + 1} — User ${escapeHtml(userId)}: ${escapeHtml(String(score))} referrals`);
    }
    const list = rows.length ? rows : ["No referrals yet. Be the first!"];
    const text = fmtList(`${ICONS.leaderboard} Top referrers`, yourRankLine ? [yourRankLine, ...list] : list);
    return sendTelegram(chatId, text);
  },

  // Admin approvals
  async approve({ chatId, args }) {
    if (!ADMIN_TELEGRAM_ID || String(chatId) !== String(ADMIN_TELEGRAM_ID)) {
      return sendTelegram(chatId, `Admin-only command.`);
    }
    const [userId, role] = args;
    if (!userId) return sendTelegram(chatId, usage(`Usage: /approve <telegramUserId> <role=member|vvip>`));
    const validRole = (role === ROLE_VVIP) ? ROLE_VVIP : ROLE_MEMBER;
    const now = Date.now();
    const patch = validRole === ROLE_MEMBER
      ? { role: ROLE_MEMBER, paid_at: now }
      : { role: ROLE_VVIP, paid_at: now, vvip_expires_at: now + MONTH_MS };
    await putUser(userId, patch);
    return sendTelegram(chatId, `Approved user ${escapeHtml(userId)} as ${escapeHtml(validRole)}.`);
  },

  async approvevvip({ chatId, args }) {
    if (!ADMIN_TELEGRAM_ID || String(chatId) !== String(ADMIN_TELEGRAM_ID)) {
      return sendTelegram(chatId, `Admin-only command.`);
    }
    const [userId, tier] = args;
    if (!userId || !tier) return sendTelegram(chatId, usage(`Usage: /approvevvip <telegramUserId> <daily|weekly|monthly>`));
    const now = Date.now();
    let delta = MONTH_MS;
    if (tier === "daily") delta = DAY_MS;
    else if (tier === "weekly") delta = WEEK_MS;
    else if (tier === "monthly") delta = MONTH_MS;
    await putUser(userId, { role: ROLE_VVIP, paid_at: now, vvip_expires_at: now + delta });
    return sendTelegram(chatId, `VVIP approved — user ${escapeHtml(userId)}, tier ${escapeHtml(tier)}, expires ${new Date(now + delta).toLocaleDateString()}.`);
  },

  async force_role({ chatId, args }) {
    if (!ADMIN_TELEGRAM_ID || String(chatId) !== String(ADMIN_TELEGRAM_ID)) {
      return sendTelegram(chatId, `Admin-only command.`);
    }
    const [userId, role] = args;
    if (!userId || !role) return sendTelegram(chatId, usage(`Usage: /force_role <telegramUserId> <free|member|vvip>`));
    const patch = { role };
    await putUser(userId, patch);
    return sendTelegram(chatId, `Forced role for ${escapeHtml(userId)} to ${escapeHtml(role)}.`);
  },

  async audit({ chatId, args }) {
    if (!ADMIN_TELEGRAM_ID || String(chatId) !== String(ADMIN_TELEGRAM_ID)) {
      return sendTelegram(chatId, `Admin-only command.`);
    }
    const [userId] = args;
    if (!userId) return sendTelegram(chatId, usage(`Usage: /audit <telegramUserId>`));
    const user = await getUser(userId);
    return sendTelegram(chatId, `<b>Audit</b>\n${escapeHtml(JSON.stringify(user || {}, null, 2))}`);
  },

  async redeem({ chatId, args, fromId }) {
    return redeemFlow(chatId, args, fromId);
  },

  async live({ chatId }) {
    const data = await ApiFootball.live().catch(err => ({ error: err }));
    if (data.error) return sendTelegram(chatId, friendlyError(data.error, ICONS.live + " Live"));

    const rows = (data?.response ?? []);
    const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    const page = 0;

    await setList(chatId, "LIVE", rows);
    await setPage(chatId, "LIVE", page);

    const text = listLive("Live now", rows, page, totalPages);
    const kb = kbForFixtures(rows, page, totalPages, "LIVE");
    return sendTelegram(chatId, text, { reply_markup: kb });
  },

  async today({ chatId, args }) {
    const leagueToken = args[0];
    const league = normLeagueId(leagueToken);
    const todayStr = new Date().toISOString().slice(0, 10);

    const data = await ApiFootball.fixturesByDate(todayStr, { league }).catch(err => ({ error: err }));
    if (data.error) return sendTelegram(chatId, friendlyError(data.error, ICONS.today + " Fixtures"));

    const rows = (data?.response ?? []);
    const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    const page = 0;

    await setList(chatId, "TODAY", rows);
    await setPage(chatId, "TODAY", page);

    const title = `Today’s fixtures${league ? ` (league ${league})` : ""}`;
    const text = listFixtures(title, rows, page, totalPages);
    const kb = kbForFixtures(rows, page, totalPages, "TODAY");
    return sendTelegram(chatId, text, { reply_markup: kb });
  },

  async next({ chatId, args }) {
    const count = /^\d+$/.test(args[0]) ? Number(args[0]) : 10;
    const leagueToken = args.find(a => isNaN(Number(a)));
    const league = normLeagueId(leagueToken);

    const data = await ApiFootball.nextFixtures({ count, league }).catch(err => ({ error: err }));
    if (data.error) return sendTelegram(chatId, friendlyError(data.error, ICONS.next + " Fixtures"));

    const rows = (data?.response ?? []);
    const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    const page = 0;

    await setList(chatId, "NEXT", rows);
    await setPage(chatId, "NEXT", page);

    const title = `Upcoming fixtures${league ? ` (league ${league})` : ""}, count ${count}`;
    const text = listFixtures(title, rows, page, totalPages);
    const kb = kbForFixtures(rows, page, totalPages, "NEXT");
    return sendTelegram(chatId, text, { reply_markup: kb });
  },

  async fixtures({ chatId, args }) {
    const [leagueToken, seasonArg] = args;
    if (!leagueToken) {
      return sendTelegram(chatId, usage(`${ICONS.fixtures} Usage: /fixtures <leagueId|name> <season?>\nExample: /fixtures epl 2024`));
    }
    const league = normLeagueId(leagueToken);
    if (!league) return sendTelegram(chatId, `${ICONS.fixtures} Unknown league: ${escapeHtml(leagueToken)}. Try epl, laliga, seriea, bundesliga, ligue1, ucl or a numeric ID.`);
    const season = seasonArg || defaultSeason();

    const data = await ApiFootball.fixtures({ league, season }).catch(err => ({ error: err }));
    if (data.error) return sendTelegram(chatId, friendlyError(data.error, ICONS.fixtures + " Fixtures"));

    const rows = (data?.response ?? []);
    const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    const page = 0;

    await setList(chatId, "FIXT", rows);
    await setPage(chatId, "FIXT", page);

    const text = listFixtures(`Fixtures league ${league} season ${season}`, rows, page, totalPages);
    const kb = kbForFixtures(rows, page, totalPages, "FIXT");
    return sendTelegram(chatId, text, { reply_markup: kb });
  },

  async standings({ chatId, args }) {
    const [leagueToken, seasonArg] = args;
    if (!leagueToken) return sendTelegram(chatId, usage(`${ICONS.standings} Usage: /standings <leagueId|name> <season?>\nExample: /standings epl 2024`));
    const league = normLeagueId(leagueToken);
    if (!league) return sendTelegram(chatId, `${ICONS.standings} Unknown league: ${escapeHtml(leagueToken)}. Try epl, laliga, seriea, bundesliga, ligue1, ucl or a numeric ID.`);
    const season = seasonArg || defaultSeason();

    const data = await ApiFootball.standings({ league, season }).catch(err => ({ error: err }));
    if (data.error) return sendTelegram(chatId, friendlyError(data.error, ICONS.standings + " Standings"));

    const table = (data?.response?.[0]?.league?.standings?.[0] ?? []);
    const text = listStandings(`League ${league} season ${season}`, table);
    return sendTelegram(chatId, text);
  },

  // Free perks
  async free_odds({ chatId, user }) {
    // limit 2 per day per user; reset daily via date key
    const todayKey = `free_odds:${user?.id || "anon"}:${new Date().toISOString().slice(0, 10)}`;
    let count = Number(await redis.get(todayKey) || 0);
    if (count >= FREE_ODDS_DAILY_LIMIT) {
      return sendTelegram(chatId, `${ICONS.free} Free odds limit reached for today (${FREE_ODDS_DAILY_LIMIT}/${FREE_ODDS_DAILY_LIMIT}). Upgrade for unlimited odds via /signup.`);
    }

    const today = new Date().toISOString().slice(0, 10);
    const fx = await ApiFootball.fixturesByDate(today).catch(err => ({ error: err }));
    if (fx.error) return sendTelegram(chatId, friendlyError(fx.error, ICONS.odds + " Free odds"));

    const fixtures = (fx?.response ?? []).slice(0, 10);
    if (!fixtures.length) return sendTelegram(chatId, `${ICONS.free} No fixtures found for today.`);

    // pick up to 2 fixtures for odds snapshot
    const picks = fixtures.slice(0, 2);
    const lines = [];
    for (const f of picks) {
      const fid = f?.fixture?.id;
      const home = escapeHtml(f?.teams?.home?.name || "Home");
      const away = escapeHtml(f?.teams?.away?.name || "Away");
      lines.push(`${home} vs ${away} — fixture ${escapeHtml(String(fid))}`);
    }
    const text =
      `${ICONS.free} <b>Free odds snapshots (2/day)</b>\n` +
      lines.map(l => `- ${l}`).join("\n") + `\n\n` +
      `Use /odds &lt;fixtureId&gt; for detailed markets (members).\n` +
      `Tip: ${pickOne(STRATEGY_TIPS)}\n` +
      `Neutral context only — no predictions or guarantees.`;
    // increment counters
    count += 1;
    await redis.set(todayKey, String(count), "EX", 24 * 60 * 60);
    const uCount = Number(user?.free_odds_count || 0) + 1;
    await putUser(user?.id || chatId, { free_odds_count: uCount });

    return sendTelegram(chatId, text);
  },

  async strategy({ chatId }) {
    const tip = pickOne(STRATEGY_TIPS);
    const text =
      `${ICONS.strategy} <b>Winning discipline (neutral)</b>\n` +
      `- ${escapeHtml(tip)}\n\n` +
      `Pair discipline with context: standings + form + neutral odds.\n` +
      `Neutral context only — no predictions or guarantees.`;
    return sendTelegram(chatId, text);
  },

  // Members-only neutral odds view
  async odds({ chatId, args, user }) {
    if (!isPaid(user)) {
      return sendTelegram(chatId, `${ICONS.odds} Members-only. Signup: KES ${SIGNUP_FEE_KES} / USD ${SIGNUP_FEE_USD}. See /signup or /pay.`);
    }

    // Single fixture odds
    if (args.length) {
      const [fixture] = args;
      const data = await ApiFootball.odds({ fixture }).catch(err => ({ error: err }));
      if (data.error) return sendTelegram(chatId, friendlyError(data.error, ICONS.odds + " Odds"));

      const markets = (data?.response?.[0]?.bookmakers ?? []).flatMap(b =>
        (b?.bets ?? []).map(m => {
          const line = `${b?.name} — ${m?.name}: ${(m?.values ?? []).map(v => `${v?.value} ${v?.odd}`).join(" | ")}`;
          return escapeHtml(line);
        })
      );

      if (!markets.length) return sendTelegram(chatId, `${ICONS.odds} No odds found for fixture ${escapeHtml(fixture)}`);

      const totalPages = Math.max(1, Math.ceil(markets.length / PAGE_SIZE));
      const page = 0;
      await setList(chatId, `ODDS:${fixture}`, markets);
      await setPage(chatId, `ODDS:${fixture}`, page);

      const header = `${ICONS.odds} Neutral odds for fixture ${escapeHtml(fixture)} ${ICONS.pageInfo} Page ${page + 1}/${totalPages}`;
      const slice = markets.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
      const text = fmtList(header, slice) + `\n\nNeutral context only — no predictions or guarantees.`;
      const kb = {
        inline_keyboard: [
          [{ text: "🔍 Analyze", callback_data: `ANALYZE:${fixture}` }],
          [{ text: "🧾 Lineups", callback_data: `LINEUPS:${fixture}` }],
          [
            ...(page > 0 ? [{ text: `${ICONS.pagePrev} Prev`, callback_data: `PAGENAV:ODDS-${fixture}:${page - 1}` }] : []),
            ...(page + 1 < totalPages ? [{ text: `${ICONS.pageNext} Next`, callback_data: `PAGENAV:ODDS-${fixture}:${page + 1}` }] : [])
          ],
          [{ text: `🧭 Back to menu`, callback_data: "SHOW_MENU" }]
        ]
      };
      return sendTelegram(chatId, text, { reply_markup: kb });
    }

    // Aggregate odds for today (snapshot)
    const today = new Date().toISOString().slice(0, 10);
    const fx = await ApiFootball.fixturesByDate(today).catch(err => ({ error: err }));
    if (fx.error) return sendTelegram(chatId, friendlyError(fx.error, ICONS.odds + " Odds"));

    const od = await ApiFootball.oddsByDate(today).catch(err => ({ error: err }));
    if (od.error) return sendTelegram(chatId, friendlyError(od.error, ICONS.odds + " Odds"));

    const fixtureMap = new Map(
      (fx?.response ?? []).map(f => [f?.fixture?.id, {
        home: f?.teams?.home?.name,
        away: f?.teams?.away?.name
      }])
    );

    const rows = [];
    for (const entry of (od?.response ?? [])) {
      const fid = entry?.fixture?.id;
      const names = fixtureMap.get(fid) || {};
      const home = escapeHtml(entry?.teams?.home?.name ?? names.home ?? "Home");
      const away = escapeHtml(entry?.teams?.away?.name ?? names.away ?? "Away");

      for (const b of (entry?.bookmakers ?? [])) {
        for (const m of (b?.bets ?? [])) {
          const values = (m?.values ?? []).map(v => `${v?.value}: ${v?.odd}`).join(" | ");
          rows.push(`${home} vs ${away} — ${escapeHtml(b?.name)} ${escapeHtml(m?.name)}: ${escapeHtml(values)}`);
          if (rows.length >= MAX_AGG_ROWS) break;
        }
        if (rows.length >= MAX_AGG_ROWS) break;
      }
      if (rows.length >= MAX_AGG_ROWS) break;
    }

    if (!rows.length) return sendTelegram(chatId, `${ICONS.odds} Neutral odds snapshot: none found for today.`);

    const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    const page = 0;

    await setList(chatId, "ODDS_TODAY", rows);
    await setPage(chatId, "ODDS_TODAY", page);

    const header = `${ICONS.odds} Neutral odds snapshot for today ${ICONS.pageInfo} Page ${page + 1}/${totalPages}`;
    const slice = rows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
    const text = fmtList(header, slice) + `\n\nNeutral context only — no predictions or guarantees.`;
    const kb = universalNav(page, totalPages, "ODDS_TODAY");
    return sendTelegram(chatId, text, { reply_markup: kb });
  },

  // Members-only neutral analysis
  async analysis({ chatId, args, user }) {
    if (!isPaid(user)) {
      return sendTelegram(chatId, `${ICONS.analysis} Members-only. Signup: KES ${SIGNUP_FEE_KES} / USD ${SIGNUP_FEE_USD}. See /signup or /pay.`);
    }

    const [leagueToken, seasonArg] = args.length >= 1 ? args : ["epl", defaultSeason()];
    const league = normLeagueId(leagueToken) || 39;
    const season = seasonArg || defaultSeason();

    const st = await ApiFootball.standings({ league, season }).catch(err => ({ error: err }));
    if (st.error) return sendTelegram(chatId, friendlyError(st.error, ICONS.analysis + " Analysis"));

    const table = (st?.response?.[0]?.league?.standings?.[0] ?? []).slice(0, 10);
    const pointsRange = table.length ? `${table[0]?.points}–${table[table.length - 1]?.points}` : "N/A";

    const lines = [
      `League ${escapeHtml(String(league))}, season ${escapeHtml(String(season))}`,
      `Top-10 points range: ${escapeHtml(pointsRange)}`
    ].concat(table.map(r => `${escapeHtml(r.rank)}. ${escapeHtml(r.team?.name)} — ${escapeHtml(r.points)} pts (GD ${escapeHtml(r.goalsDiff)})`));
    const text = fmtList(`${ICONS.analysis} Neutral analysis`, lines) + `\n\nNeutral context only — no predictions or guarantees.`;
    return sendTelegram(chatId, text);
  },

  async form({ chatId, args, user }) {
    if (!isPaid(user)) {
      return sendTelegram(chatId, `${ICONS.tips} Members-only. Signup: KES ${SIGNUP_FEE_KES} / USD ${SIGNUP_FEE_USD}. See /signup or /pay.`);
    }
    const teamName = args.join(" ");
    if (!teamName) return sendTelegram(chatId, usage(`${ICONS.tips} Usage: /form <team name>`));

    return sendTelegram(chatId,
      `${ICONS.tips} Form (neutral):\n` +
      `Use /fixtures &lt;league&gt; &lt;season&gt; and scan recent matches for ${escapeHtml(teamName)}.\n` +
      `Advanced form view will be added post-AI integration.\n\n` +
      `Neutral context only — no predictions or guarantees.`);
  },

  async headtohead({ chatId, args, user }) {
    if (!isPaid(user)) {
      return sendTelegram(chatId, `${ICONS.h2h} Members-only. Signup: KES ${SIGNUP_FEE_KES} / USD ${SIGNUP_FEE_USD}. See /signup or /pay.`);
    }
    const [home, away] = args;
    if (!home || !away) return sendTelegram(chatId, usage(`${ICONS.h2h} Usage: /headtohead <home> <away>`));
    return sendTelegram(chatId,
      `${ICONS.h2h} Head-to-head (neutral):\n` +
      `Historical H2H will be added later with safe summaries.\n\n` +
      `Neutral context only — no predictions or guarantees.`);
  },

  async lineups({ chatId, args, user }) {
    if (!isPaid(user)) {
      return sendTelegram(chatId, `${ICONS.lineups} Members-only. Signup: KES ${SIGNUP_FEE_KES} / USD ${SIGNUP_FEE_USD}. See /signup or /pay.`);
    }
    const [fixture] = args;
    if (!fixture) return sendTelegram(chatId, usage(`${ICONS.lineups} Usage: /lineups <fixtureId>`));
    return sendTelegram(chatId,
      `${ICONS.lineups} Lineups for fixture ${escapeHtml(String(fixture))} will be integrated later. Use /live meanwhile.\n\n` +
      `Neutral context only — no predictions or guarantees.`);
  },

  async news({ chatId }) {
    const text =
      `${ICONS.news} <b>News</b>\n` +
      `Neutral digest coming soon.\n` +
      `${pickOne(MEMES)}`;
    return sendTelegram(chatId, text);
  },

  async tips({ chatId }) {
    const points = [
      "Focus on verified schedules and official statuses.",
      "Review standings and recent performance without assuming outcomes.",
      "Avoid chasing losses; set time boundaries.",
      "Treat odds as information, not guarantees.",
      "Prefer enjoyable viewing angles over expectations."
    ];
    const text = fmtList(`${ICONS.tips} Neutral tips`, points) + `\n\nNeutral context only — no predictions or guarantees.`;
    return sendTelegram(chatId, text);
  },

  // VVIP overview (non-promotional, neutral)
  async vvip({ chatId, user }) {
    if (!isVVIP(user)) {
      return sendTelegram(chatId, `${ICONS.vvip} VVIP-only. Upgrade via /signup and /pay (daily/weekly/monthly).`);
    }
    const text =
      `${ICONS.vvip} <b>VVIP overview</b>\n` +
      `- Personalized dashboards (neutral summaries)\n` +
      `- Daily digest\n` +
      `- Priority support\n\n` +
      `Neutral context only — no predictions or “fixed matches”.`;
    return sendTelegram(chatId, text);
  },

  async vvip_today({ chatId, user }) {
    if (!isVVIP(user)) {
      return sendTelegram(chatId, `${ICONS.vvip} VVIP-only. Upgrade via /signup and /pay.`);
    }
    const today = new Date().toISOString().slice(0, 10);
    const data = await ApiFootball.fixturesByDate(today).catch(err => ({ error: err }));
    if (data.error) return sendTelegram(chatId, friendlyError(data.error, ICONS.vvip + " Digest"));

    const rows = (data?.response ?? []);
    const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    const page = 0;

    await setList(chatId, "VVIP_TODAY", rows);
    await setPage(chatId, "VVIP_TODAY", page);

    const text = listFixtures("VVIP digest — today’s fixtures (neutral)", rows, page, totalPages);
    const kb = kbForFixtures(rows, page, totalPages, "VVIP_TODAY");
    return sendTelegram(chatId, text, { reply_markup: kb });
  },

  async vvip_matches({ chatId, user }) {
    if (!isVVIP(user)) {
      return sendTelegram(chatId, `${ICONS.vvip} VVIP-only. Upgrade via /signup and /pay.`);
    }
    return sendTelegram(chatId, `${ICONS.vvip} VVIP matches: curated list will appear here post-AI integration.`);
  },

  async vvip_digest({ chatId, user }) {
    if (!isVVIP(user)) {
      return sendTelegram(chatId, `${ICONS.vvip} VVIP-only. Upgrade via /signup and /pay.`);
    }
    return sendTelegram(chatId, `${ICONS.vvip} VVIP digest: daily neutral highlights coming soon.`);
  },

  async fixed({ chatId }) {
    return sendTelegram(chatId,
      `${ICONS.rules} We do not provide “fixed matches”.\n` +
      `Ethical and safety constraints apply. Use /analysis and /tips for neutral context.`);
  },

  // ---------- Callback handlers ----------
  async analyzeFixture({ chatId, fixture, user, callbackQueryId }) {
    await answerCallbackQuery(callbackQueryId, "Analyzing fixture…");
    const league = 39; // sample league (EPL)
    const season = defaultSeason();
    const st = await ApiFootball.standings({ league, season }).catch(() => null);
    const top = st?.response?.[0]?.league?.standings?.[0]?.slice(0, 10) ?? [];
    const text =
      `${ICONS.analysis} <b>Neutral analysis</b>\n` +
      `Fixture ID: ${escapeHtml(String(fixture))}\n` +
      `League sample: EPL top-10 snapshot:\n` +
      top.map(r => `- ${escapeHtml(r.team?.name)} (${escapeHtml(String(r.points))} pts)`).join("\n") +
      `\nNeutral context only — no predictions or guarantees.`;
    return sendTelegram(chatId, text);
  },

  async oddsFixture({ chatId, fixture, user, callbackQueryId }) {
    if (!isPaid(user)) {
      await answerCallbackQuery(callbackQueryId, "Members-only: complete signup.");
      return sendTelegram(chatId, `${ICONS.odds} Members-only. Signup via /signup or /pay.`);
    }
    await answerCallbackQuery(callbackQueryId, "Fetching neutral odds…");
    const data = await ApiFootball.odds({ fixture }).catch(err => ({ error: err }));
    if (data.error) return sendTelegram(chatId, friendlyError(data.error, ICONS.odds + " Odds"));

    const markets = (data?.response?.[0]?.bookmakers ?? []).flatMap(b =>
      (b?.bets ?? []).map(m => {
        const line = `${b?.name} — ${m?.name}: ${(m?.values ?? []).map(v => `${v?.value} ${v?.odd}`).join(" | ")}`;
        return escapeHtml(line);
      })
    );
    if (!markets.length) return sendTelegram(chatId, `${ICONS.odds} No odds found for fixture ${escapeHtml(String(fixture))}`);

    const totalPages = Math.max(1, Math.ceil(markets.length / PAGE_SIZE));
    const page = 0;
    await setList(chatId, `ODDS:${fixture}`, markets);
    await setPage(chatId, `ODDS:${fixture}`, page);

    const header = `${ICONS.odds} Neutral odds for fixture ${escapeHtml(String(fixture))} ${ICONS.pageInfo} Page ${page + 1}/${totalPages}`;
    const slice = markets.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
    const text = fmtList(header, slice) + `\n\nNeutral context only — no predictions or guarantees.`;
    const kb = universalNav(page, totalPages, `ODDS-${fixture}`);
    return sendTelegram(chatId, text, { reply_markup: kb });
  },

  async lineupsFixture({ chatId, fixture, user, callbackQueryId }) {
    if (!isPaid(user)) {
      await answerCallbackQuery(callbackQueryId, "Members-only: complete signup.");
      return sendTelegram(chatId, `${ICONS.lineups} Members-only. Signup via /signup or /pay.`);
    }
    await answerCallbackQuery(callbackQueryId, "Lineups coming soon…");
    return sendTelegram(chatId, `${ICONS.lineups} Lineups for fixture ${escapeHtml(String(fixture))} will be integrated later. Use /live meanwhile.`);
  }
};

// ---------- Router with gating ----------
async function routeCommand({ chatId, text, user, fromId }) {
  const { cmd, args } = parseArgs(text);

  // Admin-only
  if (cmd === "/approve") return handlers.approve({ chatId, args });
  if (cmd === "/approvevvip") return handlers.approvevvip({ chatId, args });
  if (cmd === "/force_role") return handlers.force_role({ chatId, args });
  if (cmd === "/audit") return handlers.audit({ chatId, args });

  const paid = isPaid(user);
  const vvip = isVVIP(user);

  console.log("[Route]", { chatId, cmd, role: user?.role || ROLE_FREE });

  const known = new Set([
    "/start", "/menu", "/help", "/about", "/rules", "/contact", "/support",
    "/pricing", "/signup", "/pay", "/status", "/redeem",
    "/live", "/today", "/next", "/fixtures", "/standings",
    "/odds", "/analysis", "/form", "/headtohead", "/lineups", "/news", "/tips",
    "/vvip", "/vvip_today", "/vvip_matches", "/vvip_digest",
    "/refer", "/rewards", "/leaderboard",
    "/free_odds", "/strategy",
    "/fixed"
  ]);

  if (!known.has(cmd)) {
    return fallbackReply(chatId, text);
  }

  if (gateFreeCommands(cmd)) {
    switch (cmd) {
      case "/start":       return handlers.start({ chatId });
      case "/menu":        return handlers.menu({ chatId });
      case "/help":        return handlers.help({ chatId });
      case "/about":       return handlers.about({ chatId });
      case "/rules":       return handlers.rules({ chatId });
      case "/contact":     return handlers.contact({ chatId });
      case "/support":     return handlers.support({ chatId });
      case "/pricing":     return handlers.pricing({ chatId });
      case "/signup":      return handlers.signup({ chatId });
      case "/pay":         return handlers.pay({ chatId });
      case "/status":      return handlers.status({ chatId, user });
      case "/live":        return handlers.live({ chatId });
      case "/today":       return handlers.today({ chatId, args });
      case "/next":        return handlers.next({ chatId, args });
      case "/fixtures":    return handlers.fixtures({ chatId, args });
      case "/standings":   return handlers.standings({ chatId, args });
      case "/news":        return handlers.news({ chatId });
      case "/tips":        return handlers.tips({ chatId });
      case "/refer":       return handlers.refer({ chatId, user, fromId });
      case "/rewards":     return handlers.rewards({ chatId, user });
      case "/leaderboard": return handlers.leaderboard({ chatId, fromId });
      case "/free_odds":   return handlers.free_odds({ chatId, user: { ...user, id: fromId } });
      case "/strategy":    return handlers.strategy({ chatId });
      case "/fixed":       return handlers.fixed({ chatId });
      default:             return fallbackReply(chatId, text);
    }
  }

  if (cmd === "/redeem") {
    return handlers.redeem({ chatId, args, fromId });
  }

  if (gateMemberCommands(cmd)) {
    if (!paid) {
      return sendTelegram(chatId, `${ICONS.pricing} Members-only. Signup: KES ${SIGNUP_FEE_KES} / USD ${SIGNUP_FEE_USD}. See /signup or /pay.`);
    }
    switch (cmd) {
      case "/odds":        return handlers.odds({ chatId, args, user });
      case "/analysis":    return handlers.analysis({ chatId, args, user });
      case "/form":        return handlers.form({ chatId, args, user });
      case "/headtohead":  return handlers.headtohead({ chatId, args, user });
      case "/lineups":     return handlers.lineups({ chatId, args, user });
      case "/markets":     return handlers.odds({ chatId, args, user });
      case "/schedule":    return handlers.today({ chatId, args });
      case "/injuries":    return sendTelegram(chatId, `${ICONS.lineups} Injuries: integrated later. Use /lineups or /live for current context.`);
      default:             return fallbackReply(chatId, text);
    }
  }

  if (gateVVIPCommands(cmd)) {
    if (!vvip) {
      return sendTelegram(chatId, `${ICONS.vvip} VVIP-only. Upgrade via /signup and /pay.`);
    }
    switch (cmd) {
      case "/vvip":          return handlers.vvip({ chatId, user });
      case "/vvip_today":    return handlers.vvip_today({ chatId, user });
      case "/vvip_matches":  return handlers.vvip_matches({ chatId, user });
      case "/vvip_digest":   return handlers.vvip_digest({ chatId, user });
      default:               return fallbackReply(chatId, text);
    }
  }

  return fallbackReply(chatId, text);
}

// ---------- Callback router ----------
async function routeCallback({ callbackQuery, user }) {
  const id = callbackQuery.id;
  const chatId = callbackQuery.message?.chat?.id;
  const messageId = callbackQuery.message?.message_id;
  const data = String(callbackQuery.data || "");
  if (!chatId || !data) {
    return answerCallbackQuery(id, "No data.");
  }

  // Payment selection
  if (data.startsWith("PAY:")) {
    const selection = data.replace("PAY:", "");
    await handlePaySelect(chatId, id, selection, callbackQuery.from?.id);
    return;
  }

  // Back to menu
  if (data === "SHOW_MENU") {
    await answerCallbackQuery(id, "Opening menu…");
    await handlers.menu({ chatId });
    return;
  }

  // Refresh lists
  if (data.startsWith("REFRESH:")) {
    const [_, contextTag, pageStr] = data.split(":");
    const page = Number(pageStr);
    await answerCallbackQuery(id, "Refreshing…");

    let rows = [];
    try {
      if (contextTag === "LIVE") {
        const d = await ApiFootball.live();
        rows = d?.response ?? [];
      } else if (contextTag === "TODAY") {
        const today = new Date().toISOString().slice(0, 10);
        const d = await ApiFootball.fixturesByDate(today);
        rows = d?.response ?? [];
      } else if (contextTag === "NEXT") {
        const d = await ApiFootball.nextFixtures({ count: 10 });
        rows = d?.response ?? [];
      } else if (contextTag === "FIXT") {
        rows = await getList(chatId, "FIXT"); // re-fetch requires league+season
      } else if (contextTag === "VVIP_TODAY") {
        const today = new Date().toISOString().slice(0, 10);
        const d = await ApiFootball.fixturesByDate(today);
        rows = d?.response ?? [];
      } else if (contextTag === "ODDS_TODAY") {
        const today = new Date().toISOString().slice(0, 10);
        const d = await ApiFootball.oddsByDate(today);
        rows = (d?.response ?? []).slice(0, MAX_AGG_ROWS).map(o => escapeHtml(JSON.stringify(o))).slice(0, MAX_AGG_ROWS);
      }
    } catch (err) {
      await editMessageText(chatId, messageId, friendlyError(err, "Refresh"), undefined);
      return;
    }

    const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    const safePage = Math.max(0, Math.min(page, totalPages - 1));
    await setList(chatId, contextTag, rows);
    await setPage(chatId, contextTag, safePage);

    let text;
    let kb;
    if (contextTag === "LIVE") {
      text = listLive("Live now", rows, safePage, totalPages);
      kb = kbForFixtures(rows, safePage, totalPages, "LIVE");
    } else {
      const titles = {
        TODAY: "Today’s fixtures",
        NEXT: "Upcoming fixtures",
        FIXT: "Fixtures league view",
        VVIP_TODAY: "VVIP digest — today’s fixtures (neutral)",
        ODDS_TODAY: "Neutral odds snapshot (refresh)"
      };
      text = listFixtures(titles[contextTag] || "Fixtures", rows, safePage, totalPages);
      kb = kbForFixtures(rows, safePage, totalPages, contextTag);
    }
    await editMessageText(chatId, messageId, text, kb);
    return;
  }

  // Pagination navigation
  if (data.startsWith("PAGENAV:")) {
    const [_, contextTag, pageStr] = data.split(":");
    const page = Number(pageStr);
    await answerCallbackQuery(id, `Navigating to page ${page + 1}…`);

    if (contextTag.startsWith("ODDS-")) {
      const fixture = contextTag.split("-")[1];
      const list = await getList(chatId, `ODDS:${fixture}`);
      const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
      const safePage = Math.max(0, Math.min(page, totalPages - 1));
      await setPage(chatId, `ODDS:${fixture}`, safePage);

      const header = `${ICONS.odds} Neutral odds for fixture ${escapeHtml(String(fixture))} ${ICONS.pageInfo} Page ${safePage + 1}/${totalPages}`;
      const slice = list.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
      const text = fmtList(header, slice) + `\n\nNeutral context only — no predictions or guarantees.`;
      const kb = universalNav(safePage, totalPages, `ODDS-${fixture}`);
      await editMessageText(chatId, messageId, text, kb);
      return;
    }

    const list = await getList(chatId, contextTag);
    const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    const safePage = Math.max(0, Math.min(page, totalPages - 1));
    await setPage(chatId, contextTag, safePage);

    let text;
    let kb;
    if (contextTag === "LIVE") {
      text = listLive("Live now", list, safePage, totalPages);
      kb = kbForFixtures(list, safePage, totalPages, "LIVE");
    } else {
      const titles = {
        TODAY: "Today’s fixtures",
        NEXT: "Upcoming fixtures",
        FIXT: "Fixtures league view",
        VVIP_TODAY: "VVIP digest — today’s fixtures (neutral)"
      };
      text = listFixtures(titles[contextTag] || "Fixtures", list, safePage, totalPages);
      kb = kbForFixtures(list, safePage, totalPages, contextTag);
    }
    await editMessageText(chatId, messageId, text, kb);
    return;
  }

  // Fixture actions
  const [action, arg] = data.split(":");
  if (!action || !arg) {
    return answerCallbackQuery(id, "Invalid action.");
  }

  switch (action) {
    case "ANALYZE":
      return handlers.analyzeFixture({ chatId, fixture: arg, user, callbackQueryId: id });
    case "ODDS":
      return handlers.oddsFixture({ chatId, fixture: arg, user, callbackQueryId: id });
    case "LINEUPS":
      return handlers.lineupsFixture({ chatId, fixture: arg, user, callbackQueryId: id });
    default:
      return answerCallbackQuery(id, "Unsupported action.");
  }
}

// ---------- Fallback ----------
async function fallbackReply(chatId, text) {
  const msg =
    `${ICONS.menu} Unknown or unsupported command: ${escapeHtml(text)}\n` +
    `Use /menu for the icon guide or /help.\n` +
    `Note: We refuse “fixed matches” requests.`;
  return sendTelegram(chatId, msg);
}

// ---------- Main loop ----------
console.log(`${SERVICE_NAME || "Worker"} connected to Redis, waiting for jobs...`);

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

      // Handle callback queries for inline buttons
      const cb = payload?.callback_query ?? null;
      if (cb) {
        const fromId = cb.from?.id;
        let user = await getUser(fromId);
        if (!user) {
          user = await putUser(fromId, { role: ROLE_FREE, created_at: Date.now() });
        }
        await routeCallback({ callbackQuery: cb, user });
        continue;
      }

      // Handle messages (text and edited text)
      const msg = payload?.message ?? payload?.edited_message ?? null;
      if (!msg?.chat?.id || !msg?.text) {
        console.warn("[Skip] missing chat/text in payload");
        continue;
      }

      const chatId = msg.chat.id;
      const fromId = msg.from?.id || chatId;

      // Referral deep link: /start <code>
      const entities = msg.entities || [];
      const hasBotCommand = entities.some(e => e.type === "bot_command");
      if (hasBotCommand && msg.text.startsWith("/start ")) {
        const code = normalizeTextSpaces(msg.text).split(" ").slice(1).join(" ").trim();
        if (code) {
          await applyReferral(code, fromId);
        }
      }

      let user = await getUser(fromId);
      if (!user) {
        user = await putUser(fromId, { role: ROLE_FREE, created_at: Date.now() });
      }

      const text = msg.text.trim();
      console.log("Telegram update received:", {
        update_id: payload.update_id,
        message: { message_id: msg.message_id, chat: msg.chat, date: msg.date, text: msg.text, entities: msg.entities }
      });

      // Support multiple commands per message (newline-separated)
      const lines = normalizeTextSpaces(text).split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      for (const line of lines) {
        await routeCommand({ chatId, text: line, user, fromId });
      }
    } catch (err) {
      console.error("[Worker] loop error:", err.message);
      await sleep(400);
    }
  }
})();
