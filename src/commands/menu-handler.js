/**
 * menu-handler.js
 * Minimal Betrix menu and AI responder hook.
 * Safe, synchronous handler: call handleUpdate(update) from your worker/webhook processor.
 */
const fetch = (...a) => import('node-fetch').then(m=>m.default(...a));

function fmtText(text){
  return (text||'').toString();
}

async function sendTelegram(token, chatId, text){
  try {
    const resp = await (await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' })
    })).json();
    console.error(new Date().toISOString(), 'REPLY_SENT', { chatId, ok: !!resp.ok });
    return resp;
  } catch(e){
    console.error(new Date().toISOString(), 'REPLY_ERROR', e && (e.stack||e.message));
    throw e;
  }
}

// Simple AI stub: replace with your AI orchestration call
async function aiRespondStub(prompt){
  // deterministic short replies for now
  if(/bet/i.test(prompt)) return 'To place a bet, send /bet <stake> <selection>. Example: /bet 100 Lakers';
  if(/odds/i.test(prompt)) return 'Odds are dynamic. Use /odds <market> to get live odds.';
  return 'Sorry, I did not understand that. Use /menu to see options.';
}

async function handleCommand(env, jobOrUpdate){
  try {
    const TELEGRAM_TOKEN = env.TELEGRAM_TOKEN || env.TOKEN;
    if(!TELEGRAM_TOKEN) throw new Error('Missing TELEGRAM_TOKEN env');
    const payload = jobOrUpdate.payload || jobOrUpdate;
    const msg = payload.message || payload;
    const chatId = msg?.chat?.id || (msg?.from && msg.from.id);
    const text = fmtText(msg?.text || payload?.text || '');
    console.error(new Date().toISOString(), 'COMMAND_RECEIVED', { chatId, text });

    // Basic routing
    let reply = '';
    const lower = text.trim().split(' ')[0].toLowerCase();

    switch(lower){
      case '/start':
        reply = "Welcome to BETRIX. Use /menu to see available commands.";
        break;
      case '/menu':
        reply = [
          '*Betrix Menu*',
          '/start — welcome',
          '/menu — this menu',
          '/bet <amt> <selection> — place a bet',
          '/odds <market> — show odds',
          '/help — help'
        ].join('\n');
        break;
      case '/help':
        reply = 'Help: send /menu to see options or type your question.';
        break;
      case '/bet':
        // lightweight parsing; hand off to AI or bet processor in production
        const parts = text.split(/\s+/);
        if(parts.length < 3){ reply = 'Usage: /bet <amount> <selection>'; break; }
        reply = `Placing bet: amount=${parts[1]} selection=${parts.slice(2).join(' ')} — (stubbed)`;
        break;
      case '/odds':
        reply = 'Fetching odds... (stubbed). Try /odds football';
        break;
      default:
        // fallback to AI responder
        reply = await aiRespondStub(text);
    }

    await sendTelegram(TELEGRAM_TOKEN, chatId, reply);
    return { ok: true, chatId, reply };
  } catch(err){
    console.error(new Date().toISOString(), 'COMMAND_HANDLER_ERROR', err && (err.stack || err.message));
    return { ok: false, error: err && err.message };
  }
}

module.exports = { handleCommand };
