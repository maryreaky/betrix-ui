/* SAFE WRAPPER ENTRYPOINT */
const http = require("http");
const HOST = process.env.HOST || "0.0.0.0";
const PORT = process.env.PORT || (process.env.PORT || process.env.PORT || 3000);
const server = http.createServer((req, res) => {
  if (req.url === "/_health") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    return res.end("ok");
  }
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("SAFE WRAPPER ACTIVE");
});
server.listen(PORT, HOST, () => {
  console.log("Server listening on " + HOST + ":" + PORT);
});


