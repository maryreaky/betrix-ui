/**
 * functions/webhook.js
 * Persistent profiles, referrals, rewards (Upstash REST), full command menu.
 *
 * Required environment variables:
 * BOT_TOKEN, BOT_USERNAME, OPENAI_API_KEY, UPSTASH_REST_URL, UPSTASH_REST_TOKEN, ADMIN_USER_IDS (comma list), WEBHOOK_SECRET (optional)
 *
 * NOTE: Do not commit your secrets. Add to Netlify Environment Variables with scope=Functions and mark as Secret.
 */

const fetch = require('node-fetch');

// Simple Upstash REST helpers (KV style)
// UPSTASH_REST_URL and UPSTASH_REST_TOKEN must be set in env
const UPSTASH_URL = process.env.UPSTASH_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REST_TOKEN;
if (!UPSTASH_URL || !UPSTASH_TOKEN) {
  console.error('Upstash vars missing; persistent features will not function.');
}

// Helper: Upstash GET
async function upstashGet(key) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return null;
  const res = await fetch(`${UPSTASH_URL}/get/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
  });
  if (!res.ok) return null;
  const j = await res.json();
  return j?.result ?? null;
}

// Helper: Upstash SET (ttl optional seconds)
async function upstashSet(key, value, ttlSeconds) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return false;
  const body = { key: key, value: value };
  if (ttlSeconds) body.ttl = ttlSeconds;
  const res = await fetch(`${UPSTASH_URL}/set`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${UPSTASH_TOKEN}` },
    body: JSON.stringify(body)
  });
  return res.ok;
}

// Helper: Upstash INCRBY for numeric balances (atomic)
async function upstashIncr(key, delta) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return null;
  const res = await fetch(`${UPSTASH_URL}/incrby`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${UPSTASH_TOKEN}` },
    body: JSON.stringify({ key: key, by: delta })
  });
  if (!res.ok) return null;
  const j = await res.json();
  return j?.result ?? null;
}

// Telegram helpers
const BOT_TOKEN = process.env.BOT_TOKEN;
const BOT_USERNAME = process.env.BOT_USERNAME; // must be like "betrix_bot" (no @)
const ADMIN_IDS = (process.env.ADMIN_USER_IDS || "").split(",").map(s => s.trim()).filter(Boolean).map(Number);

async function sendTelegram(method, payload) {
  if (!BOT_TOKEN) { console.error('BOT_TOKEN missing'); return null; }
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return res;
}

// In-memory context and rate limiter (ephemeral)
const contexts = new Map();
const tokenBuckets = new Map();
const MAX_TOKENS = 2;
const REFILL_INTERVAL_MS = 30 * 1000;
const REFILL_AMOUNT = 1;
const nowMs = () => Date.now();
function takeToken(chatId) {
  const key = String(chatId);
  let bucket = tokenBuckets.get(key);
  const now = nowMs();
  if (!bucket) {
    bucket = { tokens: MAX_TOKENS, lastRefill: now };
    tokenBuckets.set(key, bucket);
  }
  const elapsed = now - bucket.lastRefill;
  const refillCount = Math.floor(elapsed / REFILL_INTERVAL_MS) * REFILL_AMOUNT;
  if (refillCount > 0) {
    bucket.tokens = Math.min(MAX_TOKENS, bucket.tokens + refillCount);
    bucket.lastRefill = bucket.lastRefill + Math.floor(elapsed / REFILL_INTERVAL_MS) * REFILL_INTERVAL_MS;
  }
  if (bucket.tokens > 0) {
    bucket.tokens -= 1;
    return true;
  }
  return false;
}
function pushContext(chatId, role, content) {
  const key = String(chatId);
  const buf = contexts.get(key) || [];
  buf.push({ role, content });
  if (buf.length > 4) buf.splice(0, buf.length - 4);
  contexts.set(key, buf);
}
function getContextMessages(chatId, userText) {
  const key = String(chatId);
  const buf = contexts.get(key) || [];
  const system = { role: "system", content: "You are BETRIX assistant. Friendly, concise, no betting tips." };
  const user = { role: "user", content: userText };
  const tail = buf.slice(-2);
  return [system, ...tail, user];
}

// Referral & profile keys:
// profile:{telegram_id} => JSON profile
// balance:{telegram_id} => integer (reward coins)
// referrals:{telegram_id} => integer (count)
// refcode:{code} => telegram_id (referrer)

function makeRefCode(telegramId) {
  // short ref code: base36 of id + random 3 chars
  const rnd = Math.floor(Math.random() * 46656).toString(36); // up to 36^3
  return `${telegramId.toString(36)}${rnd}`;
}

// simple safe-parse for JSON returned from Upstash result
function safeParse(val) {
  try { return JSON.parse(val); } catch(e) { return null; }
}

// Main handler
exports.handler = async (event) => {
  try {
    const url = require('url');
    const qs = url.parse(event.rawUrl || event.path || "", true).query;
    if (process.env.WEBHOOK_SECRET && qs.secret !== process.env.WEBHOOK_SECRET) {
      console.error('secret mismatch');
      return { statusCode: 403, body: 'Forbidden' };
    }

    let body = {};
    try { body = JSON.parse(event.body || '{}'); } catch(e) { console.error('json parse error', e); }

    // Handle callback_query placeholders if needed (we won't use for profile flows here)
    if (body.callback_query) {
      // For now, acknowledge callback queries generically
      await sendTelegram('answerCallbackQuery', { callback_query_id: body.callback_query.id, text: 'Action received' });
      return { statusCode: 200, body: 'OK' };
    }

    // Process incoming message
    const update = body;
    console.log('incoming update', JSON.stringify(update).slice(0,2000));
    const text = update?.message?.text?.trim();
    const chatId = update?.message?.chat?.id;
    const uid = update?.message?.from?.id;
    const messageId = update?.message?.message_id;

    // If message came from /start with parameter (referral)
    // Telegram sends /start param as message.text like "/start REF"
    if (text && text.startsWith('/start')) {
      const parts = text.split(/\s+/);
      const param = parts[1] || null;
      // create profile stub if missing
      if (uid) {
        const pkey = `profile:${uid}`;
        const existing = await upstashGet(pkey);
        if (!existing) {
          const profile = { telegram_id: uid, username: update?.message?.from?.username || null, created_at: new Date().toISOString(), dob: null, country: null, preferred_sites: [], preferred_sports: [], banned:false };
          await upstashSet(pkey, JSON.stringify(profile));
          await upstashSet(`balance:${uid}`, 0);
          await upstashSet(`referrals:${uid}`, 0);
        }
        // If referral param present, credit referrer
        if (param) {
          const refKey = `refcode:${param}`;
          const refOwner = await upstashGet(refKey);
          if (refOwner && Number(refOwner) !== uid) {
            // credit referrer once per new user
            const referredKey = `referred_by:${uid}`;
            const already = await upstashGet(referredKey);
            if (!already) {
              await upstashSet(referredKey, refOwner);
              // increment referrer count and balance
              await upstashIncr(`referrals:${refOwner}`, 1);
              await upstashIncr(`balance:${refOwner}`, 50); // reward 50 coins
              // give new user a signup bonus
              await upstashIncr(`balance:${uid}`, 20);
              await sendTelegram('sendMessage', { chat_id: refOwner, text: `🎉 You earned 50 BETRIX coins! A new user joined with your referral.`});
            }
          }
        }
      }
      // reply with menu
      const menu = `Welcome to BETRIX ⚡ Use /menu to browse sports, /signin to create a profile, /share to get your referral link, /balance to view coins.`;
      await sendTelegram('sendMessage', { chat_id: chatId, text: menu });
      return { statusCode: 200, body: 'OK' };
    }

    if (!chatId) return { statusCode: 200, body: 'OK' };

    if (!takeToken(chatId)) {
      await sendTelegram('sendMessage', { chat_id: chatId, text: "You're sending messages too fast. Please wait a moment ⏳", reply_to_message_id: messageId });
      return { statusCode: 200, body: 'OK' };
    }

    const lower = (text || "").toLowerCase();

    // /menu - shows quick keyboard and commands
    if (lower === '/menu' || lower === 'menu') {
      const menuText = "BETRIX Menu ⚡\n• /signin — create/update profile\n• /profile — view/edit profile\n• /menu_sports — browse sports & matches\n• /share — get your referral link and earn rewards\n• /balance — view your BETRIX coins\n• /help — responsible play and contact";
      await sendTelegram('sendMessage', { chat_id: chatId, text: menuText });
      return { statusCode: 200, body: 'OK' };
    }

    // /signin -> interactive flow: ask for DOB if missing, then country, then preferred sites
    if (lower === '/signin') {
      const pkey = `profile:${uid}`;
      const existingRaw = await upstashGet(pkey);
      let profile = safeParse(existingRaw) || { telegram_id: uid, username: update?.message?.from?.username || null, created_at: new Date().toISOString(), dob:null, country:null, preferred_sites:[], preferred_sports:[], banned:false };
      // If no dob, prompt user to reply with DOB in YYYY-MM-DD
      if (!profile.dob) {
        await sendTelegram('sendMessage', { chat_id: chatId, text: "To create your profile please send your date of birth in YYYY-MM-DD format (keeps age private)." });
        // store temporary flag for expecting dob
        await upstashSet(`expect_dob:${uid}`, "1", 300);
        return { statusCode: 200, body: 'OK' };
      }
      // If no country
      if (!profile.country) {
        await sendTelegram('sendMessage', { chat_id: chatId, text: "Please reply with your country name or ISO2 code (e.g., KE for Kenya)." });
        await upstashSet(`expect_country:${uid}`, "1", 300);
        return { statusCode: 200, body: 'OK' };
      }
      // otherwise show profile summary and offer edit options
      const summary = `Profile:\nName: ${update?.message?.from?.first_name || ''}\nDOB: ${profile.dob}\nCountry: ${profile.country}\nPreferred sites: ${profile.preferred_sites.map(s=>s.name).join(', ') || 'None'}\nPreferred sports: ${profile.preferred_sports.join(',') || 'None'}`;
      await sendTelegram('sendMessage', { chat_id: chatId, text: summary });
      return { statusCode: 200, body: 'OK' };
    }

    // Expecting DOB reply
    const expectDob = await upstashGet(`expect_dob:${uid}`);
    if (expectDob && text && /^\d{4}-\d{2}-\d{2}$/.test(text)) {
      const pkey = `profile:${uid}`;
      const existingRaw = await upstashGet(pkey);
      let profile = safeParse(existingRaw) || { telegram_id: uid, username: update?.message?.from?.username || null, created_at: new Date().toISOString(), dob:null, country:null, preferred_sites:[], preferred_sports:[], banned:false };
      profile.dob = text;
      await upstashSet(pkey, JSON.stringify(profile));
      await upstashSet(`expect_dob:${uid}`, "", 1);
      await sendTelegram('sendMessage', { chat_id: chatId, text: "DOB saved. Now send your country (name or ISO2 code)." });
      await upstashSet(`expect_country:${uid}`, "1", 300);
      return { statusCode: 200, body: 'OK' };
    }

    // Expecting country reply
    const expectCountry = await upstashGet(`expect_country:${uid}`);
    if (expectCountry && text) {
      const pkey = `profile:${uid}`;
      const existingRaw = await upstashGet(pkey);
      let profile = safeParse(existingRaw) || { telegram_id: uid, username: update?.message?.from?.username || null, created_at: new Date().toISOString(), dob:null, country:null, preferred_sites:[], preferred_sports:[], banned:false };
      profile.country = text;
      await upstashSet(pkey, JSON.stringify(profile));
      await upstashSet(`expect_country:${uid}`, "", 1);
      await sendTelegram('sendMessage', { chat_id: chatId, text: "Country saved. You can now add preferred betting sites with /link_site or view your profile with /profile." });
      return { statusCode: 200, body: 'OK' };
    }

    // /profile - show stored profile
    if (lower === '/profile') {
      const pkey = `profile:${uid}`;
      const existingRaw = await upstashGet(pkey);
      const profile = safeParse(existingRaw);
      if (!profile) {
        await sendTelegram('sendMessage', { chat_id: chatId, text: "No profile found. Create one with /signin." });
        return { statusCode: 200, body: 'OK' };
      }
      const balance = await upstashGet(`balance:${uid}`) || 0;
      const referrals = await upstashGet(`referrals:${uid}`) || 0;
      const summary = `Profile:\nName: ${update?.message?.from?.first_name || ''}\nDOB: ${profile.dob||'Not set'}\nCountry: ${profile.country||'Not set'}\nPreferred sites: ${profile.preferred_sites.map(s=>s.name).join(', ') || 'None'}\nPreferred sports: ${profile.preferred_sports.join(',') || 'None'}\n\nBalance: ${balance} coins\nReferrals: ${referrals}`;
      await sendTelegram('sendMessage', { chat_id: chatId, text: summary });
      return { statusCode: 200, body: 'OK' };
    }

    // /share - provide referral link and create refcode if missing
    if (lower === '/share') {
      if (!uid) {
        await sendTelegram('sendMessage', { chat_id: chatId, text: "Unable to create referral link (missing user id)." });
        return { statusCode: 200, body:'OK' };
      }
      const rcKey = `refcode_for:${uid}`;
      let code = await upstashGet(rcKey);
      if (!code) {
        code = makeRefCode(uid);
        await upstashSet(rcKey, code);
        await upstashSet(`refcode:${code}`, String(uid));
      }
      // Build share link - requires BOT_USERNAME in env
      const botUsername = process.env.BOT_USERNAME || '';
      const link = botUsername ? `https://t.me/${botUsername}?start=${code}` : `Use your bot link with start=${code}`;
      const txt = `Share this link to earn rewards: ${link}\nEarn 50 coins when someone signs up with your link. New users get 20 coins on signup.`;
      await sendTelegram('sendMessage', { chat_id: chatId, text: txt });
      return { statusCode: 200, body: 'OK' };
    }

    // /balance - show balance
    if (lower === '/balance') {
      const bal = await upstashGet(`balance:${uid}`) || 0;
      await sendTelegram('sendMessage', { chat_id: chatId, text: `Your balance: ${bal} coins` });
      return { statusCode: 200, body: 'OK' };
    }

    // /link_site <name>|<url> - quick link add
    if (lower.startsWith('/link_site')) {
      const parts = text.split(/\s+/,2);
      const remainder = text.substring(parts[0].length).trim();
      // expect format: SiteName|https://site.example
      if (!remainder || !remainder.includes('|')) {
        await sendTelegram('sendMessage', { chat_id: chatId, text: "Usage: /link_site SiteName|https://site.url" });
        return { statusCode: 200, body: 'OK' };
      }
      const [name, urlSite] = remainder.split('|').map(s=>s.trim());
      const pkey = `profile:${uid}`;
      const existingRaw = await upstashGet(pkey);
      let profile = safeParse(existingRaw) || { telegram_id: uid, username: update?.message?.from?.username || null, created_at: new Date().toISOString(), dob:null, country:null, preferred_sites:[], preferred_sports:[], banned:false };
      profile.preferred_sites = profile.preferred_sites || [];
      profile.preferred_sites.push({ name, url: urlSite, verified: false });
      await upstashSet(pkey, JSON.stringify(profile));
      await sendTelegram('sendMessage', { chat_id: chatId, text: `Saved site ${name}. Use /profile to view.` });
      return { statusCode: 200, body: 'OK' };
    }

    // /menu_sports -> redirect to existing interactive menu (we keep stubbed STUB_MATCHES)
    if (lower === '/menu_sports') {
      // delegate to a simple text menu for now
      const sports = "Choose a sport: Football, Basketball, Tennis, Volleyball, All\nType /fixtures <sport> or use /menu for main menu.";
      await sendTelegram('sendMessage', { chat_id: chatId, text: sports });
      return { statusCode: 200, body: 'OK' };
    }

    // /fixtures <sport> -> list stubbed matches for sport
    if (lower.startsWith('/fixtures')) {
      const parts = text.split(/\s+/);
      const sport = parts[1] || 'Football';
      // get stubbed list locally (small helper)
      const STUB_MATCHES = [
        { id: "f1", sport: "Football", home: "Team A", away: "Team B", kickoff: "16:00 GMT" },
        { id: "b1", sport: "Basketball", home: "Lakers", away: "Celtics", kickoff: "20:00 GMT" },
        { id: "t1", sport: "Tennis", home: "Player X", away: "Player Y", kickoff: "14:00 GMT" },
        { id: "v1", sport: "Volleyball", home: "Club V1", away: "Club V2", kickoff: "12:30 GMT" }
      ];
      const matches = sport.toLowerCase() === 'all' ? STUB_MATCHES : STUB_MATCHES.filter(m => m.sport.toLowerCase() === sport.toLowerCase());
      if (!matches.length) {
        await sendTelegram('sendMessage', { chat_id: chatId, text: `No matches found for ${sport}.` });
        return { statusCode: 200, body: 'OK' };
      }
      let list = `📅 ${sport} fixtures:\n`;
      matches.forEach(m => { list += `${m.id} • ${m.home} vs ${m.away} — ${m.kickoff}\n`; });
      list += "\nUse /odds <match_id> or /subscribe <match_id>";
      await sendTelegram('sendMessage', { chat_id: chatId, text: list });
      return { statusCode: 200, body: 'OK' };
    }

    // /subscribe <match_id> - stub: persist subscription and confirm
    if (lower.startsWith('/subscribe')) {
      const parts = text.split(/\s+/);
      const mId = parts[1];
      if (!mId) {
        await sendTelegram('sendMessage', { chat_id: chatId, text: "Usage: /subscribe <match_id>" });
        return { statusCode: 200, body: 'OK' };
      }
      // store subscription list in Upstash as a JSON array under subs:{telegram_id}
      const subsKey = `subs:${uid}`;
      const existingRaw = await upstashGet(subsKey);
      let arr = [];
      try { arr = existingRaw ? JSON.parse(existingRaw) : []; } catch(e){ arr = []; }
      if (!arr.includes(mId)) { arr.push(mId); await upstashSet(subsKey, JSON.stringify(arr)); }
      await sendTelegram('sendMessage', { chat_id: chatId, text: `🔔 Subscribed to ${mId}. You will get alerts for this match (demo).` });
      return { statusCode: 200, body: 'OK' };
    }

    // /odds <match_id> -> stubbed reply
    if (lower.startsWith('/odds')) {
      const parts = text.split(/\s+/);
      const mId = parts[1];
      if (!mId) {
        await sendTelegram('sendMessage', { chat_id: chatId, text: "Usage: /odds <match_id>" });
        return { statusCode: 200, body: 'OK' };
      }
      // stub odds
      const oddsText = `📊 Odds for ${mId} (demo): Home 1.9 Draw 3.4 Away 4.2\nUse /share to share and earn rewards.`;
      await sendTelegram('sendMessage', { chat_id: chatId, text: oddsText });
      return { statusCode: 200, body: 'OK' };
    }

    // /help
    if (lower === '/help') {
      const help = "BETRIX help ⚡\nCommands: /menu /signin /profile /share /balance /fixtures <sport> /odds <match_id> /subscribe <match_id>\nResponsible gaming: stake only what you can afford.";
      await sendTelegram('sendMessage', { chat_id: chatId, text: help });
      return { statusCode: 200, body: 'OK' };
    }

    // Admin /userlist (restricted)
    if (lower.startsWith('/userlist')) {
      if (!ADMIN_IDS.includes(uid)) {
        await sendTelegram('sendMessage', { chat_id: chatId, text: "Unauthorized." });
        return { statusCode: 200, body: 'OK' };
      }
      // NOTE: Upstash does not provide a simple list keys in this small script; instruct admin to use Upstash console for exports
      await sendTelegram('sendMessage', { chat_id: chatId, text: "Admin: to list users, use Upstash console or integrate a safe export endpoint (next step)." });
      return { statusCode: 200, body: 'OK' };
    }

    // Fallback: OpenAI conversational
    pushContext(chatId, 'user', text || '');
    const messages = getContextMessages(chatId, text || '');
    let aiReply = "Sorry, I couldn't generate a reply 🤖";
    if (process.env.OPENAI_API_KEY) {
      try {
        const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.OPENAI_API_KEY}` },
          body: JSON.stringify({ model: "gpt-4o-mini", messages, max_tokens: 220, temperature: 0.5 })
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
      console.error('OPENAI_API_KEY missing');
    }
    pushContext(chatId, 'assistant', aiReply);
    await sendTelegram('sendMessage', { chat_id: chatId, text: `💬 ${aiReply}\n\n🔎 Need more? Try /menu or /help.` });

    return { statusCode: 200, body: 'OK' };
  } catch (err) {
    console.error('handler error', err);
    return { statusCode: 500, body: 'Server error' };
  }
};