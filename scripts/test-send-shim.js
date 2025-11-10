(async () => {
  try {
    const { sendText } = require("../src/server/utils/send");
    console.log("Invoking sendText(chatId, string) ...");
    const r1 = await sendText(999999999, "local-test-string");
    console.log("Result 1:", r1);
    console.log("Invoking sendText({chatId, text: {nested:\"x\"}}) to verify normalization...");
    const r2 = await sendText({ chatId: 999999999, text: { nested: "x" }});
    console.log("Result 2:", r2);
  } catch (e) {
    console.error("Local send test error:", e && e.stack ? e.stack : e);
    process.exit(3);
  }
})();
