/**
// Injected by hotfix: use TELEGRAM_BOT_TOKEN from env
const token = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || process.env.TELEGRAM_TOKEN;
const apiMethod = apiMethod || 'sendMessage';

 * functions/webhook.js
 * BETRIX production-ready patch:
 * - Upstash-backed per-chat rate limiter + persistent subscriptions
 * - TheOddsAPI integration for live fixtures/odds when THEODDS_API_KEY is present
 * - Interactive sport/menu/match flow
 * - Preserves profiles/referrals/rewards and OpenAI conversational fallback
 *
 * Required env vars (set in Netlify):
 * BOT_TOKEN, BOT_USERNAME, OPENAI_API_KEY /* (deprecated; calls now routed to utils/openai.ask) */, UPSTASH_REST_URL, UPSTASH_REST_TOKEN, ADMIN_USER_IDS
 * Optional: THEODDS_API_KEY, REWARD_SIGNUP_AMOUNT, REWARD_REFERRER_AMOUNT, MINIMUM_AGE
 *
 * Behavior:
 * - If Upstash vars missing: falls back to in-memory stores (logs warning)
 * - If THEODDS_API_KEY missing: uses stubbed matches; still provides UI and subscriptions
 */

const fetch = require('node-fetch');

const { ask } = require('../utils/openai');
// Env
const BOT_TOKEN = process.env.BOT_TOKEN;
const BOT_USERNAME = process.env.BOT_USERNAME || "";
const OPENAI_API_KEY /* (deprecated; calls now routed to utils/openai.ask) */ = process.env.OPENAI_API_KEY /* (deprecated; calls now routed to utils/openai.ask) */;
const UPSTASH_REST_URL = process.env.UPSTASH_REST_URL;
const UPSTASH_REST_TOKEN = process.env.UPSTASH_REST_TOKEN;
const THEODDS_API_KEY = process.env.THEODDS_API_KEY || "";
const ADMIN_IDS = (process.env.ADMIN_USER_IDS || "").split(",").map(s => s.trim()).filter(Boolean).map(Number);

// Config
const RATE_LIMIT_PER_MINUTE = parseInt(process.env.RATE_LIMIT_PER_MINUTE || "12", 10);
const BURST_CAPACITY = parseInt(process.env.BURST_CAPACITY || "6", 10);
const RATE_REFILL_SECONDS = parseInt(process.env.RATE_REFILL_SECONDS || "10", 10);
const REWARD_SIGNUP_AMOUNT = parseInt(process.env.REWARD_SIGNUP_AMOUNT || "20", 10);
const REWARD_REFERRER_AMOUNT = parseInt(process.env.REWARD_REFERRER_AMOUNT || "50", 10);
const MINIMUM_AGE = parseInt(process.env.MINIMUM_AGE || "18", 10);

// Upstash helpers (REST)
async function upstashCmd(path, body) {
  if (!UPSTASH_REST_URL || !UPSTASH_REST_TOKEN) return null;
  const url = `${UPSTASH_REST_URL}${path}`;
  const res = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${UPSTASH_REST_TOKEN}` },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    console.error('Upstash error', res.status, await res.text());
    return null;
  }
  return await res.json();
}
async function upstashGet(key) {
  const j = await upstashCmd(`/get/${encodeURIComponent(key)}`);
  return j?.result ?? null;
}
async function upstashSet(key, value, ttlSeconds) {
  const body = { key, value };
  if (ttlSeconds) body.ttl = ttlSeconds;
  const j = await upstashCmd('/set', body);
  return !!j;
}
async function upstashIncr(key, by) {
  const j = await upstashCmd('/incrby', { key, by });
  return j?.result ?? null;
}

// Fallback in-memory stores if Upstash unavailable
const inMemory = {
  rateBuckets: new Map(),
  contexts: new Map(),
  subs: new Map(),
  profiles: new Map(),
  balances: new Map(),
  referrals: new Map(),
  refcodes: new Map()
};

// Token-bucket logic using Upstash for persistence or memory if not available
const REFILL_AMOUNT = Math.max(1, Math.floor(RATE_LIMIT_PER_MINUTE / (60 / RATE_REFILL_SECONDS)));
const intervalMs = RATE_REFILL_SECONDS * 1000;

async function takeTokenPersistent(chatId) {
  const key = `rate:${chatId}`;
  if (!UPSTASH_REST_URL || !UPSTASH_REST_TOKEN) {
    // in-memory fallback
    const now = Date.now();
    let b = inMemory.rateBuckets.get(chatId);
    if (!b) { b = { tokens: BURST_CAPACITY, lastRefill: now }; inMemory.rateBuckets.set(chatId, b); }
    const elapsed = now - b.lastRefill;
    const refillCount = Math.floor(elapsed / intervalMs) * REFILL_AMOUNT;
    if (refillCount > 0) { b.tokens = Math.min(BURST_CAPACITY, b.tokens + refillCount); b.lastRefill = b.lastRefill + Math.floor(elapsed / intervalMs) * intervalMs; }
    if (b.tokens > 0) { b.tokens -= 1; return true; }
    return false;
  }
  // Upstash-backed bucket stored as JSON under key
  try {
    const raw = await upstashGet(key);
    let bucket = raw ? JSON.parse(raw) : { tokens: BURST_CAPACITY, lastRefill: Date.now() };
    const now = Date.now();
    const elapsed = now - bucket.lastRefill;
    const refillCount = Math.floor(elapsed / intervalMs) * REFILL_AMOUNT;
    if (refillCount > 0) {
      bucket.tokens = Math.min(BURST_CAPACITY, bucket.tokens + refillCount);
      bucket.lastRefill = bucket.lastRefill + Math.floor(elapsed / intervalMs) * intervalMs;
    }
    if (bucket.tokens > 0) {
      bucket.tokens -= 1;
      await upstashSet(key, JSON.stringify(bucket), 3600);
      return true;
    }
    // persist unchanged bucket
    await upstashSet(key, JSON.stringify(bucket), 3600);
    return false;
  } catch (e) {
    console.error('rate token error', e);
    return false;
  }
}

// Profile, balance, referrals using Upstash or memory
async function getProfile(uid) {
  const key = `profile:${uid}`;
  if (!UPSTASH_REST_URL || !UPSTASH_REST_TOKEN) {
    return inMemory.profiles.get(uid) || null;
  }
  const raw = await upstashGet(key);
  return raw ? JSON.parse(raw) : null;
}
async function saveProfile(uid, profile) {
  const key = `profile:${uid}`;
  if (!UPSTASH_REST_URL || !UPSTASH_REST_TOKEN) {
    inMemory.profiles.set(uid, profile);
    return true;
  }
  return await upstashSet(key, JSON.stringify(profile));
}
async function getBalance(uid) {
  if (!UPSTASH_REST_URL || !UPSTASH_REST_TOKEN) {
    return inMemory.balances.get(uid) || 0;
  }
  const v = await upstashGet(`balance:${uid}`);
  return v ? Number(v) : 0;
}
async function incrBalance(uid, amount) {
  if (!UPSTASH_REST_URL || !UPSTASH_REST_TOKEN) {
    const cur = inMemory.balances.get(uid) || 0;
    const next = cur + amount; inMemory.balances.set(uid, next); return next;
  }
  const res = await upstashIncr(`balance:${uid}`, amount);
  return res;
}
async function incrReferrals(uid, amount) {
  if (!UPSTASH_REST_URL || !UPSTASH_REST_TOKEN) {
    const cur = inMemory.referrals.get(uid) || 0; const next = cur + amount; inMemory.referrals.set(uid, next); return next;
  }
  const res = await upstashIncr(`referrals:${uid}`, amount);
  return res;
}
async function getReferrerByCode(code) {
  if (!UPSTASH_REST_URL || !UPSTASH_REST_TOKEN) {
    return inMemory.refcodes.get(code) || null;
  }
  const v = await upstashGet(`refcode:${code}`);
  return v ? Number(v) : null;
}
async function setRefcodeForUser(uid, code) {
  if (!UPSTASH_REST_URL || !UPSTASH_REST_TOKEN) {
    inMemory.refcodes.set(code, uid); return true;
  }
  await upstashSet(`refcode_for:${uid}`, code);
  await upstashSet(`refcode:${code}`, String(uid));
  return true;
}
async function getRefcodeForUser(uid) {
  if (!UPSTASH_REST_URL || !UPSTASH_REST_TOKEN) {
    // reverse lookup
    for (const [k,v] of inMemory.refcodes) { if (v === uid) return k; } return null;
  }
  const c = await upstashGet(`refcode_for:${uid}`);
  return c || null;
}

// TheOddsAPI helpers (graceful when key absent)
const THEODDS_BASE = "https://api.the-odds-api.com/v4";
async function fetchSportsList() {
  if (!THEODDS_API_KEY) return null;
  const res = await fetch(`${THEODDS_BASE}/sports?apiKey=${THEODDS_API_KEY}`);
  if (!res.ok) { console.error('TheOdds sports list error', await res.text()); return null; }
  return await res.json();
}
async function fetchEventsForSport(sportKey) {
  if (!THEODDS_API_KEY) return null;
  const regions = "uk,eu,us";
  const markets = "h2h,spreads";
  const res = await fetch(`${THEODDS_BASE}/sports/${sportKey}/odds?regions=${regions}&markets=${markets}&oddsFormat=decimal&dateFormat=iso&apiKey=${THEODDS_API_KEY}`);
  if (!res.ok) { console.error('TheOdds events error', await res.text()); return null; }
  return await res.json();
}
// Map common sport names to TheOdds sport_keys (best-effort)
const SPORT_MAP = {
  football: "soccer",
  basketball: "basketball_nba",
  tennis: "tennis_atp",
  volleyball: "volleyball"
};

// Stub matches when no live feed available
const STUB_MATCHES = [
  { id: "f1", sport: "Football", home: "Team A", away: "Team B", kickoff: "16:00 GMT", odds: { home:1.9, draw:3.4, away:4.2 } },
  { id: "b1", sport: "Basketball", home: "Lakers", away: "Celtics", kickoff: "20:00 GMT", odds: { home:1.6, away:2.3 } },
  { id: "t1", sport: "Tennis", home: "Player X", away: "Player Y", kickoff: "14:00 GMT", odds: { home:1.4, away:2.8 } },
  { id: "v1", sport: "Volleyball", home: "Club V1", away: "Club V2", kickoff: "12:30 GMT", odds: { home:1.8, away:2.0 } }
];

function mapEventsToMatches(events, sportLabel) {
  if (!events) return [];
  return events.map(e => {
    const id = e.id || (e.home_team ? `${e.home_team}_${e.away_team}_${e.commence_time}` : Math.random().toString(36).slice(2,9));
    return {
      id,
      sport: sportLabel || (e.sport_key || "Unknown"),
      home: e.home_team || e.teams?.[0] || "Home",
      away: e.away_team || e.teams?.[1] || "Away",
      kickoff: e.commence_time || e.start_time || "TBD",
      odds: (e.bookmakers && e.bookmakers[0] && e.bookmakers[0].markets && e.bookmakers[0].markets[0]) ? 
        parseOddsFromMarket(e.bookmakers[0].markets[0]) : {}
    };
  });
}
function parseOddsFromMarket(market) {
  // simple H2H parsing
  if (!market) return {};
  if (market.key === 'h2h' && market.outcomes) {
    const out = {};
    market.outcomes.forEach(o => {
      // label home/away/draw as best-effort
      out[o.name.toLowerCase().includes('draw') || o.name.toLowerCase()==='draw' ? 'draw' : (o.name.toLowerCase().includes('home') ? 'home' : 'away')] = o.price;
    });
    return out;
  }
  return {};
}

// Telegram helpers
async function sendTelegram(method, payload) {
  if (!BOT_TOKEN) { console.error('BOT_TOKEN missing'); return null; }
  const res = await await (async function(){ const start = Date.now(); const url = `https://api.telegram.org/bot${token}/${apiMethod}`; console.log("T-OUTGOING: url=", url, "method=", apiMethod); const controller = new AbortController(); const to = setTimeout(()=>controller.abort(), 15000); let res; try { res = await fetch(url
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload, Object.assign({}, { signal: controller.signal } )); const elapsed = Date.now()-start; clearTimeout(to); let bodyText = null; try { bodyText = await res.text(); } catch(e) { bodyText = "<no-body>"; } console.log("T-OUTGOING-RESP: method=", apiMethod, "status=", res.status, "elapsed_ms=", elapsed, "body=", bodyText); return { status: res.status, body: bodyText }; } catch(err) { clearTimeout(to); console.error("T-OUTGOING-ERROR: method=", apiMethod, err && err.stack || err); throw err; } })()
  });
  return res;
}

// Inline keyboards
function mkSportsKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "Football ?", callback_data: "sport:Football" }, { text: "Basketball ??", callback_data: "sport:Basketball" }],
      [{ text: "Tennis ??", callback_data: "sport:Tennis" }, { text: "Volleyball ??", callback_data: "sport:Volleyball" }],
      [{ text: "All sports ??", callback_data: "sport:All" }]
    ]
  };
}
function mkMatchesKeyboard(matches) {
  const rows = matches.slice(0,10).map(m => [{ text: `${m.home} vs ${m.away} — ${shortKickoff(m.kickoff)}`, callback_data: `match:${m.id}` }]);
  rows.push([{ text: "Back to sports ??", callback_data: "menu:sports" }]);
  return { inline_keyboard: rows };
}
function mkMatchActionsKeyboard(matchId) {
  return {
    inline_keyboard: [
      [{ text: "View Odds ??", callback_data: `action:odds:${matchId}` }],
      [{ text: "Subscribe ??", callback_data: `action:subscribe:${matchId}` }],
      [{ text: "Back to matches ??", callback_data: "menu:sports" }]
    ]
  };
}
function shortKickoff(k) { try { return k.split('T')[0] + ' ' + (k.split('T')[1]||''); } catch(e){ return k; } }

// Main handler
exports.handler = async (event) => {
  try {
    const url = require('url');
const { ask } = require('../utils/openai');
    const qs = url.parse(event.rawUrl || event.path || "", true).query;
    if (process.env.WEBHOOK_SECRET && qs.secret !== process.env.WEBHOOK_SECRET) {
      console.error('secret mismatch');
      return { statusCode: 403, body: 'Forbidden' };
    }

    let body = {};
    try { body = JSON.parse(event.body || '{}'); } catch(e){ console.error('json parse error', e); }

    // Callback query handling (inline keyboards)
    if (body.callback_query) {
      const cb = body.callback_query;
      const data = cb.data || "";
      const chatId = cb.message.chat.id;
      console.log('callback', data);

      if (data.startsWith('sport:')) {
        const sport = data.split(':')[1];
        // fetch matches
        let matches = [];
        if (THEODDS_API_KEY) {
          try {
            const key = SPORT_MAP[(sport||"").toLowerCase()] || sport.toLowerCase();
            const events = await fetchEventsForSport(key);
            matches = mapEventsToMatches(events, sport);
          } catch(e) { console.error('fetch events error', e); matches = []; }
        }
        if (!matches.length) matches = STUB_MATCHES.filter(m => sport==='All' ? true : m.sport.toLowerCase()===sport.toLowerCase());

        const text = matches.length ? `?? ${sport} matches:` : `No upcoming ${sport} matches found.`;
        await sendTelegram('editMessageText', {
          chat_id: chatId,
          message_id: cb.message.message_id,
          text,
          reply_markup: JSON.stringify(mkMatchesKeyboard(matches))
        });
        return { statusCode: 200, body: 'OK' };
      }

      if (data.startsWith('match:')) {
        const matchId = data.split(':')[1];
        // try fetch from Upstash subs store or stub
        let match = STUB_MATCHES.find(m=>m.id===matchId);
        // If TheOdds present try to find in fetched events
        if (THEODDS_API_KEY) {
          // naive: search across common sports
          for (const sk of Object.values(SPORT_MAP)) {
            try {
              const events = await fetchEventsForSport(sk);
              const mapped = mapEventsToMatches(events);
              const found = mapped.find(m=>m.id===matchId);
              if (found) { match = found; break; }
            } catch(e) { }
          }
        }
        if (!match) {
          await sendTelegram('answerCallbackQuery', { callback_query_id: cb.id, text: 'Match not found' });
          return { statusCode: 200, body: 'OK' };
        }
        const text = `?? ${match.home} vs ${match.away}\n? ${match.kickoff}\nSport: ${match.sport}`;
        await sendTelegram('editMessageText', {
          chat_id: chatId,
          message_id: cb.message.message_id,
          text,
          reply_markup: JSON.stringify(mkMatchActionsKeyboard(matchId))
        });
        return { statusCode: 200, body: 'OK' };
      }

      if (data.startsWith('action:')) {
        const [, verb, matchId] = data.split(':');
        // find match
        let match = STUB_MATCHES.find(m=>m.id===matchId);
        if (THEODDS_API_KEY) {
          for (const sk of Object.values(SPORT_MAP)) {
            try {
              const events = await fetchEventsForSport(sk);
              const mapped = mapEventsToMatches(events);
              const found = mapped.find(m=>m.id===matchId);
              if (found) { match = found; break; }
            } catch(e){}
          }
        }
        if (!match) {
          await sendTelegram('answerCallbackQuery', { callback_query_id: cb.id, text: 'Match not found' });
          return { statusCode: 200, body: 'OK' };
        }
        if (verb === 'odds') {
          let oddsText = `?? Odds for ${match.home} vs ${match.away}\n`;
          if (match.odds.home) oddsText += `Home: ${match.odds.home}\n`;
          if (match.odds.draw) oddsText += `Draw: ${match.odds.draw}\n`;
          if (match.odds.away) oddsText += `Away: ${match.odds.away}\n`;
          await sendTelegram('answerCallbackQuery', { callback_query_id: cb.id, text: 'Showing odds' });
          await sendTelegram('sendMessage', { chat_id: chatId, text: oddsText });
          return { statusCode: 200, body: 'OK' };
        }
        if (verb === 'subscribe') {
          // persist subscription in Upstash: subs:{uid} => JSON array
          const uid = cb.from.id;
          const subsKey = `subs:${uid}`;
          try {
            let existing = await upstashGet(subsKey);
            let arr = existing ? JSON.parse(existing) : [];
            if (!arr.includes(matchId)) { arr.push(matchId); await upstashSet(subsKey, JSON.stringify(arr)); }
            await sendTelegram('answerCallbackQuery', { callback_query_id: cb.id, text: 'Subscribed (demo)' });
            await sendTelegram('sendMessage', { chat_id: chatId, text: `?? Subscribed to ${match.home} vs ${match.away}` });
          } catch(e) {
            console.error('subscribe error', e);
            await sendTelegram('answerCallbackQuery', { callback_query_id: cb.id, text: 'Subscription failed' });
          }
          return { statusCode: 200, body: 'OK' };
        }
      }

      await sendTelegram('answerCallbackQuery', { callback_query_id: cb.id, text: 'Action received' });
      return { statusCode: 200, body: 'OK' };
    }

    // Message handling
    const update = body;
    console.log('incoming update', JSON.stringify(update).slice(0,2000));
    const text = update?.message?.text?.trim();
    const chatId = update?.message?.chat?.id;
    const uid = update?.message?.from?.id;
    const messageId = update?.message?.message_id;

    if (!chatId) return { statusCode: 200, body: 'OK' };

    // Rate limiter check (persistent)
    const allowed = await takeTokenPersistent(chatId);
    if (!allowed) {
      await sendTelegram('sendMessage', { chat_id: chatId, text: "You're sending messages too fast. Please wait a moment ?", reply_to_message_id: messageId });
      console.log('rate limited', chatId);
      return { statusCode: 200, body: 'OK' };
    }

    const lower = (text || "").toLowerCase();

    // /menu
    if (lower === '/menu' || lower === 'menu') {
      const menuText = "BETRIX Menu ?\n• /signin — create/update profile\n• /profile — view/edit profile\n• /menu_sports — browse sports & matches\n• /share — referral link & rewards\n• /balance — view your BETRIX coins\n• /help — responsible play and contact";
      await sendTelegram('sendMessage', { chat_id: chatId, text: menuText });
      return { statusCode: 200, body: 'OK' };
    }

    // /menu_sports -> show inline sports keyboard
    if (lower === '/menu_sports') {
      await sendTelegram('sendMessage', { chat_id: chatId, text: "Choose a sport:", reply_markup: JSON.stringify(mkSportsKeyboard()) });
      return { statusCode: 200, body: 'OK' };
    }

    // /fixtures <sport>
    if (lower.startsWith('/fixtures')) {
      const parts = text.split(/\s+/);
      const sport = parts[1] || 'Football';
      let matches = [];
      if (THEODDS_API_KEY) {
        try {
          const sk = SPORT_MAP[sport.toLowerCase()] || SPORT_MAP['football'];
          const events = await fetchEventsForSport(sk);
          matches = mapEventsToMatches(events, sport);
        } catch(e){ console.error('fixtures fetch error', e); matches = []; }
      }
      if (!matches.length) matches = STUB_MATCHES.filter(m => sport.toLowerCase() === 'all' ? true : m.sport.toLowerCase() === sport.toLowerCase());
      let list = `?? ${sport} fixtures:\n`;
      matches.forEach(m => { list += `${m.id} • ${m.home} vs ${m.away} — ${shortKickoff(m.kickoff)}\n`; });
      list += "\nUse /odds <match_id> or /subscribe <match_id>";
      await sendTelegram('sendMessage', { chat_id: chatId, text: list });
      return { statusCode: 200, body: 'OK' };
    }

    // /odds <match_id>
    if (lower.startsWith('/odds')) {
      const parts = text.split(/\s+/);
      const mId = parts[1];
      if (!mId) { await sendTelegram('sendMessage', { chat_id: chatId, text: "Usage: /odds <match_id>" }); return { statusCode: 200, body: 'OK' }; }
      // try to find match from TheOdds if available
      let match = STUB_MATCHES.find(m=>m.id===mId);
      if (THEODDS_API_KEY) {
        for (const sk of Object.values(SPORT_MAP)) {
          try {
            const events = await fetchEventsForSport(sk);
            const mapped = mapEventsToMatches(events);
            const found = mapped.find(m=>m.id===mId);
            if (found) { match = found; break; }
          } catch(e){}
        }
      }
      if (!match) { await sendTelegram('sendMessage', { chat_id: chatId, text: "Match not found. Use /menu_sports to browse." }); return { statusCode: 200, body: 'OK' }; }
      let oddsText = `?? Odds for ${match.home} vs ${match.away}\n`;
      if (match.odds.home) oddsText += `Home: ${match.odds.home}\n`;
      if (match.odds.draw) oddsText += `Draw: ${match.odds.draw}\n`;
      if (match.odds.away) oddsText += `Away: ${match.odds.away}\n`;
      await sendTelegram('sendMessage', { chat_id: chatId, text: oddsText });
      return { statusCode: 200, body: 'OK' };
    }

    // /subscribe <match_id>
    if (lower.startsWith('/subscribe')) {
      const parts = text.split(/\s+/);
      const mId = parts[1];
      if (!mId) { await sendTelegram('sendMessage', { chat_id: chatId, text: "Usage: /subscribe <match_id>" }); return { statusCode: 200, body: 'OK' }; }
      const subsKey = `subs:${uid}`;
      try {
        let existing = await upstashGet(subsKey);
        let arr = existing ? JSON.parse(existing) : [];
        if (!arr.includes(mId)) { arr.push(mId); await upstashSet(subsKey, JSON.stringify(arr)); }
        await sendTelegram('sendMessage', { chat_id: chatId, text: `?? Subscribed to ${mId}.` });
      } catch(e) {
        console.error('subscribe error', e);
        await sendTelegram('sendMessage', { chat_id: chatId, text: 'Subscription failed' });
      }
      return { statusCode: 200, body: 'OK' };
    }

    // /signin starts profile creation (DOB -> country)
    if (lower === '/signin') {
      const p = await getProfile(uid);
      if (!p || !p.dob) {
        await sendTelegram('sendMessage', { chat_id: chatId, text: "Send your DOB in YYYY-MM-DD to create your profile (keeps age private)." });
        await upstashSet ? upstashSet(`expect_dob:${uid}`, "1", 300) : upstashSetFallback(`expect_dob:${uid}`); // best-effort
        return { statusCode: 200, body: 'OK' };
      }
      if (!p.country) {
        await sendTelegram('sendMessage', { chat_id: chatId, text: "Send your country name or ISO2 code now." });
        await upstashSet ? upstashSet(`expect_country:${uid}`, "1", 300) : upstashSetFallback(`expect_country:${uid}`);
        return { statusCode: 200, body: 'OK' };
      }
      const summary = `Profile:\nDOB: ${p.dob}\nCountry: ${p.country}\nPreferred sites: ${p.preferred_sites?.map(s=>s.name).join(', ') || 'None'}`;
      await sendTelegram('sendMessage', { chat_id: chatId, text: summary });
      return { statusCode: 200, body: 'OK' };
    }

    // handle expect_dob and expect_country
    const expectDob = await upstashGet ? upstashGet(`expect_dob:${uid}`) : null;
    if (expectDob && text && /^\d{4}-\d{2}-\d{2}$/.test(text)) {
      const profile = await getProfile(uid) || { telegram_id: uid, username: update?.message?.from?.username || null, created_at: new Date().toISOString(), preferred_sites:[], preferred_sports:[] };
      profile.dob = text;
      await saveProfile(uid, profile);
      await upstashSet ? upstashSet(`expect_dob:${uid}`, "", 1) : null;
      await sendTelegram('sendMessage', { chat_id: chatId, text: "DOB saved. Now send your country (name or ISO2 code)." });
      await upstashSet ? upstashSet(`expect_country:${uid}`, "1", 300) : null;
      return { statusCode: 200, body: 'OK' };
    }
    const expectCountry = await upstashGet ? upstashGet(`expect_country:${uid}`) : null;
    if (expectCountry && text) {
      const profile = await getProfile(uid) || { telegram_id: uid, username: update?.message?.from?.username || null, created_at: new Date().toISOString(), preferred_sites:[], preferred_sports:[] };
      profile.country = text;
      await saveProfile(uid, profile);
      await upstashSet ? upstashSet(`expect_country:${uid}`, "", 1) : null;
      await sendTelegram('sendMessage', { chat_id: chatId, text: "Country saved. Use /profile to view." });
      return { statusCode: 200, body: 'OK' };
    }

    // /profile
    if (lower === '/profile') {
      const p = await getProfile(uid);
      if (!p) { await sendTelegram('sendMessage', { chat_id: chatId, text: "No profile found. Use /signin." }); return { statusCode: 200, body: 'OK' }; }
      const bal = await getBalance(uid);
      const refs = await upstashGet ? await upstashGet(`referrals:${uid}`) : (inMemory.referrals.get(uid) || 0);
      const summary = `Profile:\nDOB: ${p.dob||'Not set'}\nCountry: ${p.country||'Not set'}\nPreferred sites: ${p.preferred_sites?.map(s=>s.name).join(', ') || 'None'}\nBalance: ${bal}\nReferrals: ${refs||0}`;
      await sendTelegram('sendMessage', { chat_id: chatId, text: summary });
      return { statusCode: 200, body: 'OK' };
    }

    // /share referral
    if (lower === '/share') {
      if (!uid) { await sendTelegram('sendMessage', { chat_id: chatId, text: "Unable to create referral link." }); return { statusCode: 200, body: 'OK' }; }
      let code = await getRefcodeForUser(uid);
      if (!code) {
        code = `${uid.toString(36)}${Math.random().toString(36).slice(2,5)}`;
        await setRefcodeForUser(uid, code);
      }
      const link = BOT_USERNAME ? `https://t.me/${BOT_USERNAME}?start=${code}` : `Use /start ${code}`;
      const txt = `Share this link to earn ${REWARD_REFERRER_AMOUNT} coins when someone signs up with your link. New users get ${REWARD_SIGNUP_AMOUNT} coins on signup:\n${link}`;
      await sendTelegram('sendMessage', { chat_id: chatId, text: txt });
      return { statusCode: 200, body: 'OK' };
    }

    // /balance
    if (lower === '/balance') {
      const bal = await getBalance(uid);
      await sendTelegram('sendMessage', { chat_id: chatId, text: `Your balance: ${bal} coins` });
      return { statusCode: 200, body: 'OK' };
    }

    // /help
    if (lower === '/help') {
      const help = "BETRIX help ?\nCommands: /menu /signin /profile /share /balance /menu_sports /fixtures <sport> /odds <match_id> /subscribe <match_id>\nResponsible gaming: stake only what you can afford.";
      await sendTelegram('sendMessage', { chat_id: chatId, text: help });
      return { statusCode: 200, body: 'OK' };
    }

    // Default: conversational fallback via OpenAI
    pushContext(chatId, 'user', text || '');
    const messages = (function(){ const buf = inMemory.contexts.get(chatId) || []; const system = { role: "system", content: "You are BETRIX assistant. Friendly, concise, no betting tips." }; return [system, ...buf.slice(-2), { role: "user", content: text || "" }]; })();
    let aiReply = "Sorry, I couldn't generate a reply ??";
    if (OPENAI_API_KEY /* (deprecated; calls now routed to utils/openai.ask) */) {
      try {
        const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_API_KEY /* (deprecated; calls now routed to utils/openai.ask) */}` },
          body: JSON.stringify({ model: "gpt-4o-mini", messages, max_tokens: 260, temperature: 0.5 })
        });
        if (openaiRes.ok) {
          const openaiJson = await openaiRes.json();
          aiReply = openaiJson?.choices?.[0]?.message?.content?.trim() || aiReply;
        } else {
          const errText = await openaiRes.text();
          console.error('OpenAI error', openaiRes.status, errText);
        }
      } catch (err) {
        console.error('OpenAI call failed', err);
      }
    } else {
      console.error('OPENAI_API_KEY /* (deprecated; calls now routed to utils/openai.ask) */ missing');
    }
    await sendTelegram('sendMessage', { chat_id: chatId, text: `?? ${aiReply}\n\n?? Need more? Try /menu or /help.` });

    return { statusCode: 200, body: 'OK' };
  } catch (err) {
    console.error('handler error', err);
    return { statusCode: 500, body: 'Server error' };
  }
};





