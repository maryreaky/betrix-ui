/**
 * src/server/lib/ai-config.js
 * Central AI provider resolution and fallbacks:
 *  - Priority: OPEN_ROUTER_KEY -> RAPID_API_KEY -> OPENAI_API_KEY -> USE_STUB_AI
 *  - Exports: getProvider() returns { type, key, meta } and isStub boolean
 */

function loadedEnv(name) {
  const v = process.env[name];
  return typeof v === "string" && v.length > 0 ? v : null;
}

const OPEN_ROUTER_KEY = loadedEnv("OPEN_ROUTER_KEY");
const RAPID_API_KEY = loadedEnv("RAPID_API_KEY");
const OPENAI_API_KEY = loadedEnv("OPENAI_API_KEY");
const USE_STUB_AI = (process.env.USE_STUB_AI || "false").toLowerCase() === "true";

/**
 * getProvider: returns the active provider resolution
 * { type: "openrouter"|"rapidapi"|"openai"|"stub", key: string|null, name: string }
 */
function getProvider() {
  if (OPEN_ROUTER_KEY) return { type: "openrouter", key: OPEN_ROUTER_KEY, name: "OpenRouter (via OPEN_ROUTER_KEY)" };
  if (RAPID_API_KEY) return { type: "rapidapi", key: RAPID_API_KEY, name: "RapidAPI (via RAPID_API_KEY)" };
  if (OPENAI_API_KEY) return { type: "openai", key: OPENAI_API_KEY, name: "OpenAI (via OPENAI_API_KEY)" };
  if (USE_STUB_AI) return { type: "stub", key: null, name: "Stub (USE_STUB_AI=true)" };
  // fallback: prefer stub to avoid runtime failures
  return { type: "stub", key: null, name: "Stub (no keys found)" };
}

/**
 * isStub: true when using offline/stub mode
 */
function isStub() {
  return getProvider().type === "stub";
}

module.exports = {
  getProvider,
  isStub,
  OPEN_ROUTER_KEY,
  RAPID_API_KEY,
  OPENAI_API_KEY,
  USE_STUB_AI
};
