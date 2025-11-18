/**
 * menu-handler.js — full-featured Betrix Telegram command handler
 * Usage: const { handleCommand } = require("./src/commands/menu-handler.js");
 * Call with handleCommand(process.env, jobOrUpdate)
 *
 * Features:
 * - Robust command parsing (bot_command entities + text heuristics)
 * - Supports: /start, /menu, /help, /bet, /odds, /balance, /deposit, /withdraw, /history, /cancel
 * - Admin commands: /stats, /flushqueue, /debug (guarded by ADMIN_IDS)
 * - Meme responder with emojis and canned images/text
 * - Single-point AI orchestrator (env YOUR_AI_URL)
 * - Telemetry logs: COMMAND_RECEIVED, HANDLER_OK, HANDLER_FAIL, REPLY_SENT
 * - Safe network calls and timeouts
 */
const fetch = (...a) => import('node-fetch').then(m => m.default(...a));

function safeLog(tag, obj) {
  try { console.error(new Date().toISOString(), tag, obj); } catch(e) {}
}
function textify(x){ return (x===undefined||x===null) ? '' : String(x); }
const ADMIN_IDS = (process.env.ADMIN_IDS || '').split(',').map(s=>s.trim()).filter(Boolean).map(Number);

// small helper: pick chat id from common payload shapes
function extractChatId(payload) {
  const msg = payload.message || payload;
  return msg?.chat?.id || msg?.from?.id || payload?.chat_id || null;
}

// parse bot_command entity if present, otherwise fallback to text heuristics
function parseCommand(payload) {
  const msg = payload.message || payload;
  const text = textify(msg?.text || payload?.text || '').trim();
  // entity-aware parse
  const entities = (msg && msg.entities) || (payload && payload.entities) || [];
  const botCmd = entities.find(e => e.type === 'bot_command');
  if (botCmd && botCmd.offset === 0) {
    // extract the exact command token from text
    const token = text.split(/\s+/)[0] || '';
    const rest = text.slice((token.length)).trim();
    return { raw: text, cmd: token.toLowerCase(), rest };
  }
  // heuristics: /bet100teamname or /bet100 team
  const m = text.match(/^\/([a-zA-Z]+)(.*)$/);
  if (m) {
    const cmd = '/' + m[1].toLowerCase();
    let rest = (m[2] || '').trim();
    // split if rest crammed with numbers: /bet100teamname => amount=100
    if (cmd === '/bet') {
      const ran = rest.match(/^(\d+)(?:\s+(.+))?$/);
      if (ran) { rest = (ran[1] || '') + ' ' + (ran[2] || ''); rest = rest.trim(); }
      else {
        // also handle /bet100team where no space after command
        const combined = text.match(/^\/bet(\d+)(.+)$/i);
        if (combined) { rest = `${combined[1]} ${combined[2].trim()}`; }
      }
    }
    return { raw: text, cmd, rest };
  }
  // no explicit command -> fallback
  return { raw: text, cmd: null, rest: text };
}

// safe fetch with timeout
async function fetchWithTimeout(url, opts = {}, timeout = 7000) {
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(), timeout);
  try {
    const res = await fetch(url, Object.assign({}, opts, { signal: controller.signal }));
    clearTimeout(timer);
    return res;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

// single-point send
async function sendTelegram(token, chatId, text, extra = {}) {
  try {
    const body = Object.assign({ chat_id: chatId, text }, extra);
    const resp = await fetchWithTimeout(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }, 8000);
    const json = await resp.json();
    safeLog('REPLY_SENT', { chatId, ok: !!json.ok, snippet: text.slice(0,200) });
    return { ok: !!json.ok, raw: json };
  } catch(e) {
    safeLog('REPLY_ERROR', e && (e.stack||e.message));
    return { ok: false, error: e && e.message };
  }
}

// Meme responder (text + emoji)
function memeResponder(text) {
  const t = textify(text).toLowerCase();
  const memes = [
    'When live odds flip last minute 😅 — HOLD TIGHT',
    'That feeling when your underdog scores ⚡️🔥',
    'Late winner energy 🏆 — celebrate responsibly'
  ];
  if (t.includes('meme') || t.includes('joke')) return memes[Math.floor(Math.random() * memes.length)];
  if (t.includes('hi') || t.includes('hello') || t.includes('👋')) return 'Hey! 👋 I am BETRIX — say /menu to see what I can do.';
  return null;
}

// AI orchestrator hook (single place to replace)
async function aiOrchestrator(prompt, context = {}) {
  const url = process.env.YOUR_AI_URL || process.env.AI_URL;
  if (!url) {
    // deterministic fallback
    if (/odds/i.test(prompt)) return 'Live odds: stubbed. Use /odds <market> to request market-specific odds.';
    return "I can help with bets and odds. Try /menu to see commands.";
  }
  try {
    const resp = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, context })
    }, 8000);
    const j = await resp.json();
    // try common shapes
    return j && (j.reply || j.text || j.result) || 'AI returned no text';
  } catch(e) {
    safeLog('AI_ERROR', e && (e.stack || e.message));
    return 'AI unavailable right now. Try again later.';
  }
}

// Main handler
async function handleCommand(env, jobOrUpdate) {
  try {
    const TELEGRAM_TOKEN = env.TELEGRAM_TOKEN || env.TOKEN;
    if (!TELEGRAM_TOKEN) throw new Error('Missing TELEGRAM_TOKEN');
    const payload = jobOrUpdate.payload || jobOrUpdate;
    const chatId = extractChatId(payload);
    const parsed = parseCommand(payload);
    safeLog('COMMAND_RECEIVED', { chatId, parsed });
    const fromId = (payload.message && payload.message.from && payload.message.from.id) || null;

    // admin check helper
    const isAdmin = id => ADMIN_IDS.includes(Number(id));

    // explicit command routing
    const cmd = parsed.cmd;
    const rest = parsed.rest || '';

    if (!cmd) {
      // no explicit command: try meme responder, then AI fallback
      const meme = memeResponder(rest);
      if (meme) {
        const s = await sendTelegram(TELEGRAM_TOKEN, chatId, meme);
        return { ok: s.ok, chatId, sent: s };
      }
      const ai = await aiOrchestrator(rest, { chatId, fromId });
      const s = await sendTelegram(TELEGRAM_TOKEN, chatId, ai);
      return { ok: s.ok, chatId, sent: s };
    }

    switch (cmd) {
      case '/start': {
        const reply = `Welcome to BETRIX 🎯\nUse /menu to see available commands. Manage bets, check odds, or ask me for a meme.`;
        const s = await sendTelegram(TELEGRAM_TOKEN, chatId, reply);
        return { ok: s.ok, chatId, reply };
      }

      case '/menu': {
        const menu = [
          '📋 *Betrix Menu*',
          '/start — quick intro',
          '/menu — this menu',
          '/help — help & contact',
          '/bet <amount> <selection> — place a bet (example: /bet 100 Arsenal)',
          '/odds <market> — show odds for a market',
          '/balance — show your balance (stub)',
          '/deposit — deposit instructions (stub)',
          '/withdraw — withdraw instructions (stub)',
          '/history — recent activity (stub)',
          '/cancel <id> — cancel pending bet (stub)',
          '',
          'Admin: /stats, /flushqueue, /debug (admin only)',
          '',
          'Type a question (e.g., "What are the odds for tonight?") or say "meme" for fun.'
        ].join('\n');
        const s = await sendTelegram(TELEGRAM_TOKEN, chatId, menu, { parse_mode: 'Markdown' });
        return { ok: s.ok, chatId, reply: menu };
      }

      case '/help': {
        const h = 'Help: use /menu to see commands. For account or payment help contact support@betrix.example (stub).';
        const s = await sendTelegram(TELEGRAM_TOKEN, chatId, h);
        return { ok: s.ok, chatId, reply: h };
      }

      case '/bet': {
        // expect "amount selection"
        const parts = rest.split(/\s+/).filter(Boolean);
        if (parts.length < 2) {
          const usage = 'Usage: /bet <amount> <selection>\nExample: /bet 100 Arsenal';
          const s = await sendTelegram(TELEGRAM_TOKEN, chatId, usage);
          return { ok: false, chatId, reply: usage };
        }
        const amount = parts[0];
        const selection = parts.slice(1).join(' ');
        // Basic validation
        if (!/^\d+$/.test(amount)) {
          const err = 'Invalid amount. Please enter a whole number amount in KES.';
          await sendTelegram(TELEGRAM_TOKEN, chatId, err);
          return { ok: false, chatId, error: 'invalid_amount' };
        }
        // In production: enqueue bet processing, check balance, debit, persist.
        const confirmation = `✅ Bet placed (stub)\nAmount: ${amount}\nSelection: ${selection}\nReference: bet_stub_${Date.now()}`;
        const s = await sendTelegram(TELEGRAM_TOKEN, chatId, confirmation);
        return { ok: s.ok, chatId, reply: confirmation };
      }

      case '/odds': {
        const market = rest.split(/\s+/).filter(Boolean)[0] || 'general';
        // in prod call odds API; here we call AI orchestrator to create a friendly odds reply, or fallback stub
        const ai = await aiOrchestrator(`odds for ${market}`, { market, chatId });
        const s = await sendTelegram(TELEGRAM_TOKEN, chatId, `📊 Odds for *${market}*:\n${ai}`, { parse_mode: 'Markdown' });
        return { ok: s.ok, chatId, reply: ai };
      }

      case '/balance': {
        const reply = 'Balance: KES 0.00 (stub). Connect wallet API to show real balance.';
        const s = await sendTelegram(TELEGRAM_TOKEN, chatId, reply);
        return { ok: s.ok, chatId, reply };
      }

      case '/deposit':
      case '/withdraw':
      case '/history':
      case '/cancel': {
        const r = `${cmd} is stubbed. Integrate payments/ledger to enable this feature.`;
        const s = await sendTelegram(TELEGRAM_TOKEN, chatId, r);
        return { ok: s.ok, chatId, reply: r };
      }

      case '/stats': {
        if (!isAdmin(fromId)) { const x='Unauthorized'; await sendTelegram(TELEGRAM_TOKEN, chatId, x); return { ok:false, chatId, error:'unauthorized' }; }
        const stats = 'Stats (stub): queue length and uptime not implemented in handler. Add metrics exporter for real stats.';
        const s = await sendTelegram(TELEGRAM_TOKEN, chatId, stats);
        return { ok: s.ok, chatId, reply: stats };
      }

      case '/flushqueue': {
        if (!isAdmin(fromId)) { const x='Unauthorized'; await sendTelegram(TELEGRAM_TOKEN, chatId, x); return { ok:false, chatId, error:'unauthorized' }; }
        const flush = 'Flush queue protected. Use admin CLI to flush. (stub)';
        const s = await sendTelegram(TELEGRAM_TOKEN, chatId, flush);
        return { ok: s.ok, chatId, reply: flush };
      }

      case '/debug': {
        if (!isAdmin(fromId)) { const x='Unauthorized'; await sendTelegram(TELEGRAM_TOKEN, chatId, x); return { ok:false, chatId, error:'unauthorized' }; }
        const dbg = `Debug: ENV keys present: ${Object.keys(env || {}).slice(0,50).join(',')}`;
        const s = await sendTelegram(TELEGRAM_TOKEN, chatId, dbg);
        return { ok: s.ok, chatId, reply: dbg };
      }

      default: {
        // fallback: try meme responder, then AI orchestrator
        const meme = memeResponder(parsed.raw || rest);
        if (meme) {
          const s = await sendTelegram(TELEGRAM_TOKEN, chatId, meme);
          return { ok: s.ok, chatId, reply: meme };
        }
        const ai = await aiOrchestrator(parsed.raw || rest, { chatId, fromId });
        const s = await sendTelegram(TELEGRAM_TOKEN, chatId, ai);
        return { ok: s.ok, chatId, reply: ai };
      }
    }
  } catch (err) {
    safeLog('COMMAND_HANDLER_ERROR', err && (err.stack || err.message));
    return { ok: false, error: err && err.message };
  }
}

module.exports = { handleCommand };

async function handleFixedBet(env, job) {
  try {
    const payload = job.payload || job;
    const msg = payload.message || payload;
    const chatId = msg.chat.id;
    const fromId = msg.from.id;
    const parsed = parseCommand(payload);
    const rest = (parsed.rest || "").trim();
    const parts = rest.split(/\s+/);
    if (parts.length < 3) {
      await sendTelegram(env.TELEGRAM_TOKEN, chatId, "Usage: /fixed_bet <marketId> <selectionId> <amount>");
      return { ok:false, error:"invalid_args" };
    }
    const marketId = parts[0], selectionId = parts[1], amount = parts[2];
    if (!/^\d+$/.test(amount)) { await sendTelegram(env.TELEGRAM_TOKEN, chatId, "Amount must be an integer."); return { ok:false, error:"invalid_amount" }; }
    // simple odds lookup stub
    const odds = 2.0;
    const potential = Number(amount) * odds;
    const betRef = `bet_${Date.now()}_${Math.floor(Math.random()*10000)}`;
    // reserve funds
    const reserveRes = await walletAdapter.reserve(fromId, Number(amount), betRef);
    // persist bet (PG)
    const client = await pgClient();
    try {
      await client.query('INSERT INTO bets(bet_ref, user_id, market_id, selection_id, stake_bigint, odds_decimal, potential_payout_bigint, reserve_id, status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[betRef, fromId, marketId, selectionId, Number(amount), odds, Math.round(potential), reserveRes.reserveId, 'PLACED']);
      await client.query('INSERT INTO bet_events(bet_ref, event_type, actor, meta) VALUES($1,$2,$3,$4)', [betRef, 'PLACED', 'bot', JSON.stringify({reserveId: reserveRes.reserveId})]);
    } finally {
      await client.end();
    }
    const reply = `✅ Fixed Bet placed (stub)\nRef: ${betRef}\nMarket: ${marketId}\nSelection: ${selectionId}\nStake: ${amount}\nOdds: ${odds}\nPotential: ${potential}`;
    await sendTelegram(env.TELEGRAM_TOKEN, chatId, reply);
    return { ok:true, betRef };
  } catch(e){
    safeLog('FIXED_BET_ERROR', e && (e.stack || e.message));
    return { ok:false, error: e && e.message };
  }
}
