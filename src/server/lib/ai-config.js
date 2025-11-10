/**
 * src/server/lib/ai-config.js
 * Provider priority: OPEN_ROUTER_KEY -> RAPID_API_KEY -> OPENAI_API_KEY -> USE_STUB_AI
 */
function loadedEnv(name) {
  const v = process.env[name];
  return typeof v === "string" && v.length > 0 ? v : null;
}
const OPEN_ROUTER_KEY = loadedEnv("OPEN_ROUTER_KEY");
const RAPID_API_KEY = loadedEnv("RAPID_API_KEY");
const OPENAI_API_KEY = loadedEnv("OPENAI_API_KEY");
const USE_STUB_AI = (process.env.USE_STUB_AI || "true").toLowerCase() === "true";

function getProvider() {
  if (OPEN_ROUTER_KEY) return { type: "openrouter", key: OPEN_ROUTER_KEY, name: "OpenRouter" };
  if (RAPID_API_KEY) return { type: "rapidapi", key: RAPID_API_KEY, name: "RapidAPI" };
  if (OPENAI_API_KEY) return { type: "openai", key: OPENAI_API_KEY, name: "OpenAI" };
  return { type: "stub", key: null, name: "Stub" };
}

function isStub() { return getProvider().type === "stub"; }

module.exports = { getProvider, isStub, OPEN_ROUTER_KEY, RAPID_API_KEY, OPENAI_API_KEY, USE_STUB_AI };
