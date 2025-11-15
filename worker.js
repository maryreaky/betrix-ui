/**
 * worker.js
 * Minimal worker using BullMQ. Requires REDIS_URL, OPENAI_API_KEY and TELEGRAM_BOT_TOKEN env vars.
 * Run: node worker.js
 */
const { Worker } = require("bullmq");
const { connection } = require("./src/server/queue");
const { sendTelegramV2 } = require("./src/server/telegramSendV2");

// Minimal AI call - replace with your provider integration
async function callAiWithTimeoutAndRetries(prompt, opts = {}) {
  // simple fetch to OpenAI Chat completions (example). Replace or extend as needed.
  const fetch = require("node-fetch");
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");
  const controller = new AbortController();
  const timeout = setTimeout(()=>controller.abort(), 20000);
  try {
    const payload = {
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: "You are a concise assistant." }, { role: "user", content: prompt }],
      max_tokens: 400
    };
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type":"application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeout);
    const txt = await res.text();
    try { const j = JSON.parse(txt); return (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || null; } catch(e) { return txt; }
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

const worker = new Worker("jobs", async job => {
  if (job.name !== "telegram-update") return;
  const update = job.data.update;
  try {
    // determine chat and prompt
    const chatId = update.message && update.message.chat && update.message.chat.id;
    const text = update.message && update.message.text ? update.message.text : "";
    const prompt = `User message: ${text}\nRespond concisely as a helpful assistant.`;
    console.log("JOB-START: chatId=", chatId, "prompt_preview=", (text||"").slice(0,200));
    let aiReply = null;
    try {
      aiReply = await callAiWithTimeoutAndRetries(prompt);
      console.log("DEBUG: aiReply preview:", (typeof aiReply === "string" ? aiReply.slice(0,320) : JSON.stringify(aiReply).slice(0,320)));
    } catch(aiErr) {
      console.error("AI-CALL-ERROR:", aiErr && (aiErr.stack||aiErr.message) || aiErr);
    }
    if (!aiReply || (typeof aiReply === "string" && aiReply.trim().length===0)) {
      await sendTelegramV2("sendMessage", { chat_id: chatId, text: "Sorry, I cannot generate a reply right now. Try again shortly." });
      console.log("AI-FALLBACK-SENT:", chatId);
    } else {
      // sanitize and trim to Telegram limits
      const reply = (aiReply.length > 3500) ? aiReply.slice(0,3500) : aiReply;
      await sendTelegramV2("sendMessage", { chat_id: chatId, text: reply });
    }
    return Promise.resolve();
  } catch (err) {
    console.error("WORKER-ERROR:", err && (err.stack||err.message) || err);
    throw err;
  }
}, { connection });
console.log("Worker started for queue 'jobs'");
