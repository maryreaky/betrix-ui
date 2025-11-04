/**
 * functions/webhook.js
 * Synchronous-await version: validates optional secret, calls OpenAI, then posts reply to Telegram.
 * Requires OPENAI_API_KEY, BOT_TOKEN, optional WEBHOOK_SECRET in Netlify environment variables.
 */

const fetch = (...args) => import('node-fetch').then(m => m.default(...args));

exports.handler = async (event) => {
  try {
    // Validate secret if present
    const url = require("url");
    const qs = url.parse(event.rawUrl || event.path || "", true).query;
    if (process.env.WEBHOOK_SECRET && qs.secret !== process.env.WEBHOOK_SECRET) {
      console.error("secret mismatch");
      return { statusCode: 403, body: "Forbidden" };
    }

    // Parse update
    let update = {};
    try { update = JSON.parse(event.body || "{}"); } catch (e) { console.error("json parse error", e); }
    console.log("incoming update", JSON.stringify(update).slice(0, 2000));

    const text = update?.message?.text;
    const chatId = update?.message?.chat?.id;
    if (!text || !chatId) {
      console.log("non-text or missing chatId; nothing to do");
      return { statusCode: 200, body: "OK" };
    }

    // Build messages for OpenAI
    const messages = [
      { role: "system", content: "You are a helpful assistant for the BETRIX sports-media platform. Keep replies concise and avoid betting advice." },
      { role: "user", content: text }
    ];

    // Call OpenAI
    if (!process.env.OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY missing");
      return { statusCode: 200, body: "OK" };
    }

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        max_tokens: 300,
        temperature: 0.6
      })
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      console.error("OpenAI error", openaiRes.status, errText);
      return { statusCode: 200, body: "OK" };
    }

    const openaiJson = await openaiRes.json();
    const aiReply = openaiJson?.choices?.[0]?.message?.content?.trim() || "Sorry, I couldn't generate a reply.";

    // Send reply to Telegram
    if (!process.env.BOT_TOKEN) {
      console.error("BOT_TOKEN missing");
      return { statusCode: 200, body: "OK" };
    }

    const telegramRes = await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: aiReply,
        reply_to_message_id: update.message?.message_id
      })
    });

    if (!telegramRes.ok) {
      const telErr = await telegramRes.text();
      console.error("Telegram sendMessage error", telegramRes.status, telErr);
      return { statusCode: 200, body: "OK" };
    }

    console.log("Reply sent to chat", chatId);
    return { statusCode: 200, body: "OK" };

  } catch (err) {
    console.error("handler error", err);
    return { statusCode: 500, body: "Server error" };
  }
};