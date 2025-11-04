/**
 * functions/webhook.js
 * Responsive Telegram webhook with emojis and quick UX touches.
 * - Shows typing action before generating reply
 * - Handles /start with emoji welcome
 * - Uses OpenAI for message generation for other texts
 * - Requires OPENAI_API_KEY, BOT_TOKEN, optional WEBHOOK_SECRET
 */

const fetch = require('node-fetch');

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

    // Quick command handling (immediate user feedback)
    if (text && text.startsWith('/start')) {
      const welcome = "Welcome to BETRIX ⚡️\nI can answer questions, summarise matches, and chat — try sending a message now! 🤖";
      await sendTelegram(token, "sendMessage", { chat_id: chatId, text: welcome, reply_to_message_id: messageId });
      console.log("Handled /start");
      return { statusCode: 200, body: "OK" };
    }

    // Show typing action to improve perceived responsiveness
    try {
      await sendTelegram(token, "sendChatAction", { chat_id: chatId, action: "typing" });
    } catch (e) {
      console.error("sendChatAction failed", e);
    }

    // Safety: short circuit very long messages
    if (text && text.length > 2000) {
      const msg = "Whoa — that message is too long. Please send a shorter question (max 2000 chars) ✂️";
      await sendTelegram(token, "sendMessage", { chat_id: chatId, text: msg, reply_to_message_id: messageId });
      return { statusCode: 200, body: "OK" };
    }

    // Build OpenAI messages
    const messages = [
      { role: "system", content: "You are a concise assistant for BETRIX — friendly, emoji-savvy, no betting tips, concise replies." },
      { role: "user", content: text || "User sent empty message" }
    ];

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
          max_tokens: 250,
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

    // Add emoji polish and length guard
    if (aiReply.length > 1000) aiReply = aiReply.slice(0, 1000) + "...";
    const polished = `💬 ${aiReply}\n\n🔎 Need more? Ask follow-up.`;

    // Send reply
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