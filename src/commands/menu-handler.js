/**
 * menu-handler.js
 * Enhanced Betrix menu and AI responder hook.
 * Usage: const { handleCommand } = require("./src/commands/menu-handler.js");
 * Call handleCommand(process.env, job) for each dequeued job or webhook update.
 *
 * Notes:
 * - No emoji characters are used.
 * - Replace aiRespond(...) with your AI orchestrator call in one place.
 */
const fetch = (...a) => import('node-fetch').then(m => m.default(...a));

function safeLog(tag, obj) {
  try { console.error(new Date().toISOString(), tag, obj); } catch(e) {}
}

function textify(x){ return (x||'').toString(); }

async function sendTelegram(token, chatId, text, extra = {}) {
  try {
    const body = Object.assign({ chat_id: chatId, text }, extra);
    const resp = await (await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })).json();
    safeLog('REPLY_SENT', { chatId, ok: !!resp.ok, result: resp && (resp.result && { message_id: resp.result.message_id } ) || null });
    return { ok: !!resp.ok, raw: resp };
  } catch (e) {
    safeLog('REPLY_ERROR', e && (e.stack || e.message));
    return { ok: false, error: e && e.message };
  }
}

// ---------- AI responder stub: replace this with your orchestrator ----------
async function aiRespond(prompt, context = {}) {
  // Replace this single function with your AI call.
  // Example replacement: return await yourOrchestrator.respond(prompt, context);
  const p = textify(prompt).toLowerCase();
  if (p.includes('bet')) return 'To place a bet: /bet <amount> <selection>. Example: /bet 100 arsenal';
  if (p.includes('odds')) return 'Odds command: /odds <market>. Live odds are available via the odds API.';
  if (p.includes('meme')) return 'Meme: WHEN THE ODDS ARE IN YOUR FAVOR: [¯\\_(ツ)_/¯]';
  return "I did not understand that. Use /menu to see options.";
}
// -----------------------------------------------------------------------

const ADMIN_IDS = (process.env.ADMIN_IDS || '').split(',').map(s => s.trim()).filter(Boolean).map(Number);

function isAdmin(id){
  if(!id) return false;
  return ADMIN_IDS.includes(Number(id));
}

function buildMenuText(){
  return [
    '*Betrix Menu*',
    '/start — welcome and quick setup',
    '/menu — show this menu',
    '/help — help and contact',
    '/bet <amount> <selection> — place a bet',
    '/odds <market> — fetch odds for a market',
    '/balance — show your balance (stub)',
    '/deposit — deposit instructions (stub)',
    '/withdraw — withdraw instructions (stub)',
    '/history — show recent activity (stub)',
    '/cancel <id> — cancel a pending bet',
    '',
    'Admin:',
    '/stats — service stats',
    '/flushqueue — remove queued jobs (admin only)',
    '/debug — debug info (admin only)',
    '',
    'Try typing a question like "what are the odds?" or "show me a meme".'
  ].join('\n');
}

function simpleMemeResponder(text){
  const t = textify(text).toLowerCase();
  const memes = [
    'classic-meme: I CAME, I SAW, I PARSED THE ODDS',
    'sports-meme: LATE GOAL ENERGY',
    'reaction-meme: THAT FEELING WHEN YOU WIN THE BET'
  ];
  if (t.includes('meme')) return memes[Math.floor(Math.random()*memes.length)];
  if (t.includes('joke') || t.includes('funny')) return 'joke: Why did the bettor cross the road? To follow the favorite.';
  return null;
}

async function handleCommand(env, jobOrUpdate){
  try {
    const TELEGRAM_TOKEN = env.TELEGRAM_TOKEN || env.TOKEN;
    if(!TELEGRAM_TOKEN) throw new Error('Missing TELEGRAM_TOKEN env');

    const payload = jobOrUpdate.payload || jobOrUpdate;
    const msg = payload.message || payload;
    const chatId = msg?.chat?.id || (msg?.from && msg.from.id);
    const text = textify(msg?.text || payload?.text || '');
    safeLog('COMMAND_RECEIVED', { chatId, text, jobId: jobOrUpdate.jobId || null });

    // admin guard
    const fromId = msg?.from?.id || null;

    // quick routing
    const first = text.trim().split(/\s+/)[0] || '';
    const cmd = first.toLowerCase();

    // built-in commands
    if(cmd === '/start'){
      const welcome = `Welcome to BETRIX. Quick tips: send /menu to see commands.`;
      await sendTelegram(TELEGRAM_TOKEN, chatId, welcome, { parse_mode: 'Markdown' });
      return { ok: true, chatId, reply: welcome };
    }

    if(cmd === '/menu'){
      const m = buildMenuText();
      await sendTelegram(TELEGRAM_TOKEN, chatId, m, { parse_mode: 'Markdown' });
      return { ok: true, chatId, reply: m };
    }

    if(cmd === '/help'){
      const h = 'Help: use /menu. For support, contact the Betrix team.';
      await sendTelegram(TELEGRAM_TOKEN, chatId, h);
      return { ok: true, chatId, reply: h };
    }

    if(cmd === '/bet'){
      const parts = text.split(/\s+/);
      if(parts.length < 3){
        const usage = 'Usage: /bet <amount> <selection>';
        await sendTelegram(TELEGRAM_TOKEN, chatId, usage);
        return { ok: false, chatId, reply: usage };
      }
      const amount = parts[1];
      const selection = parts.slice(2).join(' ');
      // in prod: validate, debit, enqueue bet processor. Here: stubbed response.
      const confirm = `Bet received (stub): amount=${amount} selection=${selection}`;
      await sendTelegram(TELEGRAM_TOKEN, chatId, confirm);
      return { ok: true, chatId, reply: confirm };
    }

    if(cmd === '/odds'){
      const parts = text.split(/\s+/);
      const market = parts[1] || 'general';
      const oddsReply = `Odds for ${market}: 1.5 (stub). Use live odds API for real data.`;
      await sendTelegram(TELEGRAM_TOKEN, chatId, oddsReply);
      return { ok: true, chatId, reply: oddsReply };
    }

    if(cmd === '/balance'){
      const b = 'Balance: KES 0 (stub). Integrate with wallet API to show real balance.';
      await sendTelegram(TELEGRAM_TOKEN, chatId, b);
      return { ok: true, chatId, reply: b };
    }

    if(cmd === '/deposit' || cmd === '/withdraw' || cmd === '/history' || cmd === '/cancel'){
      const r = `${cmd} is stubbed. Connect to payments and bet ledger to enable.`;
      await sendTelegram(TELEGRAM_TOKEN, chatId, r);
      return { ok: true, chatId, reply: r };
    }

    // admin-only commands
    if(cmd === '/stats' && isAdmin(fromId)){
      const s = 'Stats: queue length and uptime are available via infra. (stub)';
      await sendTelegram(TELEGRAM_TOKEN, chatId, s);
      return { ok: true, chatId, reply: s };
    }

    if(cmd === '/flushqueue' && isAdmin(fromId)){
      // admin safety: do not implement destructive action here; return instruction
      const flush = 'Flush queued jobs: please run the admin tool. (protected)';
      await sendTelegram(TELEGRAM_TOKEN, chatId, flush);
      return { ok: true, chatId, reply: flush };
    }

    if(cmd === '/debug' && isAdmin(fromId)){
      const dbg = `Debug info (stub): ENV keys present: ${Object.keys(env).join(',')}`;
      await sendTelegram(TELEGRAM_TOKEN, chatId, dbg);
      return { ok: true, chatId, reply: dbg };
    }

    // meme responder
    const meme = simpleMemeResponder(text);
    if(meme){
      await sendTelegram(TELEGRAM_TOKEN, chatId, meme);
      return { ok: true, chatId, reply: meme };
    }

    // fallback: AI responder
    const aiReply = await aiRespond(text, { chatId, fromId });
    await sendTelegram(TELEGRAM_TOKEN, chatId, aiReply);
    return { ok: true, chatId, reply: aiReply };

  } catch (err) {
    safeLog('COMMAND_HANDLER_ERROR', err && (err.stack || err.message));
    return { ok: false, error: err && err.message };
  }
}

module.exports = { handleCommand };
