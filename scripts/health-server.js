const http = require("http");
const url = require("url");
const { createQueue } = require("../src/server/queue");
const PORT = process.env.PORT || 10000;
let metricsQueue;

function getMetricsQueue() {
  if (!metricsQueue) metricsQueue = createQueue("betrix-jobs");
  return metricsQueue;
}

const server = http.createServer(async (req, res) => {
  const { pathname } = url.parse(req.url);
  if (pathname === "/healthz") return res.end(JSON.stringify({ ok: true, ts: Date.now() }));
  if (pathname === "/metrics") {
    try {
      const counts = await getMetricsQueue().getJobCounts();
      res.setHeader("Content-Type","application/json");
      return res.end(JSON.stringify({ ok: true, counts }));
    } catch (e) {
      res.statusCode = 500; return res.end(JSON.stringify({ ok: false, error: e.message }));
    }
  }
  res.end("ok");
});
server.listen(PORT, () => console.log("[health] server listening on port", PORT));
