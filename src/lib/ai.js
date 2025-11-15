/*
 * src/lib/ai.js
 * RapidAPI OpenAI adapter using RAPIDAPI_HOST and RAPIDAPI_KEY from env.
 */
const fetch = globalThis.fetch || require("node-fetch");

async function callRapidOpenAI(userText, opts = {}) {
  try {
    const host = process.env.RAPIDAPI_HOST;
    const key = process.env.RAPIDAPI_KEY;
    if (!host || !key) return { ok: false, error: "AI not configured" };

    const url = `https://${host}/v1/chat/completions`;
    const body = {
      model: opts.model || "gpt-4o-mini",
      messages: [
        { role: "system", content: opts.system || "You are BETRIX assistant. Keep replies concise." },
        { role: "user", content: userText }
      ],
      max_tokens: opts.max_tokens || 300,
      temperature: typeof opts.temperature === "number" ? opts.temperature : 0.2
    };

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-RapidAPI-Host": host,
        "X-RapidAPI-Key": key
      },
      body: JSON.stringify(body)
    });
    const data = await resp.json();

    const aiText = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || null;
    if (!aiText) return { ok: false, error: "no-ai-text", raw: data };
    return { ok: true, text: String(aiText).trim(), raw: data };
  } catch (err) {
    return { ok: false, error: "exception", message: err && (err.message || err.stack) };
  }
}

module.exports = { callRapidOpenAI };
