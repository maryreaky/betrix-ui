/* CHATID_QUEUE_INJECTED */
function resolveTelegramChatId(update){
  if (!update || typeof update !== "object") return undefined;
  if (update.message && update.message.chat && update.message.chat.id) return update.message.chat.id;
  if (update.edited_message && update.edited_message.chat && update.edited_message.chat.id) return update.edited_message.chat.id;
  if (update.callback_query && update.callback_query.message && update.callback_query.message.chat && update.callback_query.message.chat.id) return update.callback_query.message.chat.id;
  if (update.channel_post && update.channel_post.chat && update.channel_post.chat.id) return update.channel_post.chat.id;
  if (update.edited_channel_post && update.edited_channel_post.chat && update.edited_channel_post.chat.id) return update.edited_channel_post.chat.id;
  try {
    const stack = [update];
    while (stack.length){
      const obj = stack.pop();
      if (!obj || typeof obj !== "object") continue;
      if (obj.chat && obj.chat.id && (typeof obj.chat.id === "number" || /^\d+$/.test(String(obj.chat.id)))) return obj.chat.id;
      for (const k of Object.keys(obj)) { if (obj[k] && typeof obj[k] === "object") stack.push(obj[k]); }
    }
  } catch(e){}
  return undefined;
}

function _wrapPayloadWithChatId(payload){
  try {
    const resolved = resolveTelegramChatId(payload || (typeof globalThis !== 'undefined' ? globalThis.__incoming_update__ : undefined));
    // If payload already has chatId, keep it
    if (payload && (payload.chatId !== undefined)) return payload;
    // if payload is a string (stored JSON), attempt parse
    if (typeof payload === 'string') {
      try {
        const obj = JSON.parse(payload);
        if (obj && obj.chatId !== undefined) return payload;
        obj.chatId = resolved;
        return JSON.stringify(obj);
      } catch(e){
        // cannot parse, return original string
        return payload;
      }
    }
    // otherwise merge
    return Object.assign({}, payload || {}, { chatId: resolved });
  } catch(e){
    return payload;
  }
}
/* END_CHATID_QUEUE_INJECTED */
const Redis = require("ioredis");
const { Queue } = require("bullmq");

if (!process.env.REDIS_URL) {
  console.error("[queue] ERROR: REDIS_URL is not set. Aborting.");
  throw new Error("Missing REDIS_URL");
}

const connection = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
console.log('[queue] using REDIS_URL', process.env.REDIS_URL.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:****@'));

function createQueue(name = "betrix-jobs") {
  console.log("[queue] creating Queue with explicit connection:", name);
  return new Queue(name, { connection });
}

module.exports = { connection, createQueue };

