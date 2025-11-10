/**
 * src/server/utils/telegramSend.js
 * Safe helper: converts aiResp -> plain text then forwards to telegram client
 */
function toPlainText(aiResp) {
  if (typeof aiResp === "string") return aiResp;
  if (aiResp && typeof aiResp === "object" && aiResp.text) return aiResp.text;
  try { return JSON.stringify(aiResp); } catch(e) { return String(aiResp); }
}
async function sendText(telegramClient, chatId, aiResp) {
  const text = toPlainText(aiResp);
  if (telegramClient && typeof telegramClient.send === "function") return telegramClient.send({ chatId, text });
  if (telegramClient && typeof telegramClient.sendMessage === "function") return telegramClient.sendMessage(chatId, text);
  return { chatId, text };
}
module.exports = { sendText, toPlainText };
