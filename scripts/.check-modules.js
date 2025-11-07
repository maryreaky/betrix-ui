try {
  const path = require("path");
  const sendModule = require(path.resolve("src/server/utils/send"));
  console.log("send.js loaded: sendText type =", typeof sendModule.sendText);
  try {
    const helper = require(path.resolve("src/server/utils/telegramSend"));
    console.log("telegramSend helper loaded: sendText type =", typeof helper.sendText);
  } catch (e) {
    console.log("telegramSend helper not loaded (this may be OK):", e && e.message ? e.message : e.toString());
  }
} catch (e) {
  console.error("MODULE LOAD ERROR:", e && e.stack ? e.stack : e);
  process.exit(2);
}
