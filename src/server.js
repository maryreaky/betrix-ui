const http = require("http");
const app = require("./app");
const PORT = process.env.PORT || 3000;
const server = http.createServer(app);
server.listen(PORT, () => {
  console.log(`App listening on 0.0.0.0:${PORT}`);
});
module.exports = server;
