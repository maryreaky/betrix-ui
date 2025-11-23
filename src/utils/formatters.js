/**
 * Text formatting utilities
 */

const ICONS = {
  brand: "🚀", live: "🔴", today: "📅", next: "⏭️",
  fixtures: "📜", standings: "📊", odds: "🎲", tips: "🧠",
  analysis: "🔍", lineups: "🧾", h2h: "⚔️", news: "🗞️",
  pricing: "💵", pay: "💳", status: "🧩", support: "🛠️",
  menu: "🧭", vvip: "💎", rules: "🛡️", about: "ℹ️",
  contact: "✉️", refer: "👥", rewards: "🏆", leaderboard: "🥇",
  pagePrev: "◀️", pageNext: "▶️", pageInfo: "🔢", refresh: "🔄",
  back: "⬅️", signup: "📝", strategy: "📐", free: "🎁",
};

const MEMES = [
  "⚡ Neutral insights only. No hype, just signal.",
  "🧠 Smart is calm. Calm is profitable (in time).",
  "🎯 Process over luck. Every day.",
  "🛰️ Futuristic menu, grounded ethics.",
];

const STRATEGY_TIPS = [
  "Bankroll discipline: stake small, consistent amounts; never chase losses.",
  "Specialize: focus on one league/market to reduce noise and improve context.",
  "Use multiple lenses: standings + form + neutral odds for a fuller picture.",
  "Time boundaries: set daily limits; this is entertainment, not pressure.",
  "Treat odds as information, not guarantees; avoid overconfidence.",
  "Prefer clarity: if a match feels chaotic, skip it and enjoy the game.",
];

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Format date to readable string
 */
function formatDate(isoString) {
  try {
    const d = new Date(isoString);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  } catch {
    return isoString;
  }
}

/**
 * Format list item
 */
function formatList(title, rows) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return `<b>${escapeHtml(title)}:</b> none`;
  return `<b>${escapeHtml(title)}:</b>\n` + list.map(r => `- ${escapeHtml(String(r))}`).join("\n");
}

/**
 * Chunk text by size
 */
function chunkText(text, chunkSize) {
  if (!text) return [""];
  const chunks = [];
  let remaining = String(text);

  while (remaining.length > chunkSize) {
    let idx = remaining.lastIndexOf("\n", chunkSize);
    if (idx === -1 || idx < chunkSize * 0.6) {
      idx = remaining.lastIndexOf(" ", chunkSize);
      if (idx === -1 || idx < chunkSize * 0.6) idx = chunkSize;
    }
    chunks.push(remaining.slice(0, idx));
    remaining = remaining.slice(idx).trimStart();
  }
  if (remaining.length) chunks.push(remaining);
  return chunks;
}

/**
 * Get random item from array
 */
function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Normalize unicode spaces
 */
function normalizeSpaces(text) {
  return String(text).replace(/\u200B|\u200C|\u200D|\u2060|\u00A0/g, "");
}

/**
 * Format usage example
 */
function formatUsage(str) {
  return escapeHtml(str);
}

/**
 * Format error message
 */
function formatError(error, prefix) {
  const msg = typeof error === "string" ? error : (error?.message || "Unknown error");
  return `${prefix} temporarily unavailable. Please try again shortly.\nDetails: ${escapeHtml(msg)}`;
}

export {
  ICONS,
  MEMES,
  STRATEGY_TIPS,
  escapeHtml,
  formatDate,
  formatList,
  chunkText,
  pickRandom,
  normalizeSpaces,
  formatUsage,
  formatError,
};
