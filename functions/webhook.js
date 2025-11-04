/**
 * functions/webhook.js
 * Adds:
 * - per-chat rate limiter (token bucket)
 * - ephemeral per-chat context buffer (last 2 msgs)
 * - preserves existing OpenAI + Telegram flow
 *
 * NOTE: Ephemeral storage is in-memory and not persisted across cold starts.
 * For production, replace with Redis/Upstash for persistence across instances.
 */

const fetch = require('node-fetch');

// In-memory stores (ephemeral)
const tokenBuckets = new Map(); // chatId -> { tokens, lastRefill }
const contexts = new Map();     // chatId -> [ {role, content}, ... ]

// Rate limiter config
const MAX_TOKENS = 2;           // burst capacity
const REFILL_INTERVAL_MS = 30 * 1000; // refill 1 token every 30s
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
  // refill
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
  // keep last 2 messages for context (system + latest user)
  if (buf.length > 4) buf.splice(0, buf.length - 4);
  contexts.set(key, buf);
}

function getContextMessages(chatId, userText) {
  const key = String(chatId);
  const buf = contexts.get(key) || [];
  const system = { role: "system", content: "You are a concise assistant for BETRIX — friendly, emoji-savvy, no betting tips." };
  const user = { role: "user", content: userText };
  // include up to last 2 messages + current user message
  const tail = buf.slice(-2);
  return [system, ...tail, user];
}

const sendTelegram = async (token, method, payload) => {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return res;
};

exports.handler = async (event) => {
  try {
    const url = require("url");
    const qs = url.parse(event.rawUrl || event.path || "", true).query;
    if (process.env.WEBHOOK_SECRET && qs.secret !== process.env.WEBHOOK_SECRET) {
      console.error("secret mismatch");
      return { statusCode: 403, body: "Forbidden" };
    }

    let update = {};
    try { update = JSON.parse(event.body || "{}"); } catch (e) { console.error("json parse error", e); }
    console.log("incoming update", JSON.stringify(update).slice(0, 2000));

    const text = update?.message?.text?.trim();
    const chatId = update?.message?.chat?.id;
    const messageId = update?.message?.message_id;

    if (!chatId) {
      console.log("non-text or missing chatId; nothing to do");
      return { statusCode: 200, body: "OK" };
    }

    const token = process.env.BOT_TOKEN;
    if (!token) {
      console.error("BOT_TOKEN missing");
      return { statusCode: 200, body: "OK" };
    }

    // quick command
    if (text && text.startsWith('/start')) {
      const welcome = "Welcome to BETRIX ⚡️\nI can answer questions, summarise matches, and chat — try sending a message now! 🤖";
      await sendTelegram(token, "sendMessage", { chat_id: chatId, text: welcome, reply_to_message_id: messageId });
      // record context
      pushContext(chatId, "assistant", welcome);
      console.log("Handled /start");
      return { statusCode: 200, body: "OK" };
    }

    // Rate limiting per-chat
    if (!takeToken(chatId)) {
      const slowMsg = "You're sending messages too fast. Please wait a moment ⏳";
      await sendTelegram(token, "sendMessage", { chat_id: chatId, text: slowMsg, reply_to_message_id: messageId });
      console.log("Rate limited chat", chatId);
      return { statusCode: 200, body: "OK" };
    }

    // Typing indicator
    try { await sendTelegram(token, "sendChatAction", { chat_id: chatId, action: "typing" }); } catch(e) { console.error("sendChatAction failed", e); }

    // Safety: cap message length
    if (text && text.length > 2000) {
      const msg = "Message too long. Send something shorter (max 2000 chars) ✂️";
      await sendTelegram(token, "sendMessage", { chat_id: chatId, text: msg, reply_to_message_id: messageId });
      return { statusCode: 200, body: "OK" };
    }

    // Build OpenAI messages using context
    const messages = getContextMessages(chatId, text || "");

    if (!process.env.OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY missing");
      await sendTelegram(token, "sendMessage", { chat_id: chatId, text: "Service temporarily unavailable ⚠️", reply_to_message_id: messageId });
      return { statusCode: 200, body: "OK" };
    }

    // Call OpenAI
    let aiReply = "Sorry, I couldn't generate a reply 🤖";
    try {
      const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages,
          max_tokens: 220,
          temperature: 0.5
        })
      });

      if (openaiRes.ok) {
        const openaiJson = await openaiRes.json();
        aiReply = openaiJson?.choices?.[0]?.message?.content?.trim() || aiReply;
      } else {
        const errText = await openaiRes.text();
        console.error("OpenAI error", openaiRes.status, errText);
      }
    } catch (err) {
      console.error("OpenAI call failed", err);
    }

    // Persist assistant + user messages into ephemeral context
    pushContext(chatId, "user", text || "");
    pushContext(chatId, "assistant", aiReply);

    if (aiReply.length > 1000) aiReply = aiReply.slice(0, 1000) + "...";
    const polished = `💬 ${aiReply}\n\n🔎 Need more? Ask follow-up.`;

    const telegramRes = await sendTelegram(token, "sendMessage", {
      chat_id: chatId,
      text: polished,
      reply_to_message_id: messageId,
      disable_web_page_preview: true
    });

    if (!telegramRes.ok) {
      const telErr = await telegramRes.text();
      console.error("Telegram sendMessage error", telegramRes.status, telErr);
    } else {
      console.log("Reply sent to chat", chatId);
    }

    return { statusCode: 200, body: "OK" };

  } catch (err) {
    console.error("handler error", err);
    return { statusCode: 500, body: "Server error" };
  }
};