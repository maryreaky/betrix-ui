/* AUTO-INJECT quick reply route for incident debug */
try {
  const quickReply = require("./telegram-quick-reply");
  if (typeof app !== "undefined" && app && app.use) { app.use(quickReply); }
} catch(e){ console.error("quick-reply inject failed", e); }
const http = require("http");
const app = require("./app");
const PORT = process.env.PORT || 3000;
const server = http.createServer(app);
server.listen(PORT, () => {
  console.log("STARTUP: process.env.PORT =", process.env.PORT);
  console.log(`App listening on 0.0.0.0:${PORT}`);
});
server.on("error", (err) => {
  console.error("SERVER ERROR:", err && err.code ? err.code : err);
});
module.exports = server;

