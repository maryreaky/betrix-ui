const { fetch } = require("undici");
async function sendReply(token, chat_id, text) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const body = JSON.stringify({ chat_id, text });
  const resp = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body });
  const txt = await resp.text().catch(e => "" + e);
  let json; try { json = JSON.parse(txt); } catch (e) { json = { parseError:true, text: txt }; }
  console.log({ status: resp.status, result: json }, "tg sendMessage");
  return json;
}
function extractChatId(update) {
  if (update.message?.chat?.id) return update.message.chat.id;
  if (update.callback_query?.message?.chat?.id) return update.callback_query.message.chat.id;
  return null;
}
async function handleTelegram(update, cfg) {
  const chatId = extractChatId(update);
  if (!chatId) return;
  const text = update.message?.text?.trim() || "";
  await sendReply(cfg.BOT_TOKEN, chatId, text === "/ping" ? "pong" : "I received: " + text);
}
module.exports = { handleTelegram, sendReply };
