const callRapidLlama = async (prompt) => {
  const key = process.env.RAPID_API_KEY;
  const res = await fetch("https://open-ai21.p.rapidapi.com/conversationllama", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-rapidapi-host": "open-ai21.p.rapidapi.com",
      "x-rapidapi-key": key,
    },
    body: JSON.stringify({
      messages: [{ role: "user", content: prompt }],
      web_access: false,
    }),
  });
  const json = await res.json();
  const reply = json?.result || json?.text || "No reply";
  return { ok: true, text: reply };
};

/**
 * src/server/utils/openai.js
 * Backwards-compatible shim used by existing code.
 * Provider priority: OPEN_ROUTER_KEY -> OPENAI_API_KEY -> stub reply
 *
 * Exports: ask(prompt, opts) -> returns { ok: true, text: "..." } or throws/returns { ok:false, error: "..." }
 */
const axios = require("axios");

const OPEN_ROUTER_KEY = process.env.OPEN_ROUTER_KEY || null;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || null;
const USE_STUB_AI = (process.env.USE_STUB_AI || "true").toLowerCase() === "true";

async function callOpenRouter(prompt, opts = {}) {
  const model = opts.model || "gpt-4o-mini";
  const max_tokens = opts.max_tokens || 400;
  const url = "https://api.openrouter.ai/v1/completions";
  const body = { model, input: prompt, max_tokens };
  const headers = { Authorization: `Bearer ${OPEN_ROUTER_KEY}`, "Content-Type": "application/json" };
  const resp = await axios.post(url, body, { headers, timeout: 15000 });
  // Normalise to text reply
  const text = resp?.data?.choices?.[0]?.message?.content || resp?.data?.result || JSON.stringify(resp?.data);
  return { ok: true, text: String(text) };
}

async function callOpenAI(prompt, opts = {}) {
  const model = opts.model || "gpt-3.5-turbo";
  const max_tokens = opts.max_tokens || 400;
  const url = "https://api.openai.com/v1/chat/completions";
  const body = { model, messages: [{ role: "user", content: prompt }], max_tokens };
  const headers = { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" };
  const resp = await axios.post(url, body, { headers, timeout: 15000 });
  const text = resp?.data?.choices?.[0]?.message?.content || JSON.stringify(resp?.data);
  return { ok: true, text: String(text) };
}

function stubReply(prompt) {
  const t = (prompt || "").toString().toLowerCase();
  if (!t) return "I didn't get that. Ask me about fixtures, odds, or tips.";
  if (/\bhello|hi|hey\b/.test(t)) return "Hello! BETRIX here — limited mode (stub). Ask about odds or fixtures.";
  if (/\bping\b/.test(t)) return "pong (stub)";
  if (/\b(odds|fixture|match|score)\b/.test(t)) return "Stubbed matches: Team A vs Team B; Team C vs Team D.";
  return "BETRIX (stub): I'm currently running in fallback mode. Set OPEN_ROUTER_KEY to enable live AI.";
}

/**
 * Public API: ask(prompt, opts)
 * Returns { ok:true, text: string } on success, or { ok:false, error } on expected failures.
 */
async function ask(prompt, opts = {}) {
  // If explicitly forcing stub, return stub
  if (USE_STUB_AI) {
    return { ok: true, text: stubReply(prompt) };
  }

  if (OPEN_ROUTER_KEY) {
    try {
      return await callOpenRouter(prompt, opts);
    } catch (err) {
      console.error("OpenRouter error:", err && err.response ? err.response.status : err && err.message ? err.message : err);
      // fallthrough to try OpenAI if available
    }
  }

  if (OPENAI_API_KEY) {
    try {
      return await callOpenAI(prompt, opts);
    } catch (err) {
      console.error("OpenAI error:", err && err.response ? err.response.status : err && err.message ? err.message : err);
      return { ok: false, error: "ai-provider-failed" };
    }
  }

  // No provider keys available — final fallback stub
  return { ok: true, text: stubReply(prompt) };
}

module.exports = { ask };

