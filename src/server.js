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
