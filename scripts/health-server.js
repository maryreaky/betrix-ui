const http = require('http');
const url = require('url');

const PORT = process.env.PORT || 3000;
let metricsQueue;

function getMetricsQueue() {
  if (!metricsQueue) {
    const { getQueue } = require('../src/server/queue');
    metricsQueue = getQueue('betrix-jobs');
  }
  return metricsQueue;
}

const server = http.createServer(async (req, res) => {
  try {
    const { pathname } = url.parse(req.url);
    if (pathname === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, ts: Date.now() }));
    }
    if (pathname === '/metrics') {
      try {
        const counts = await getMetricsQueue().getJobCounts();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ok: true, counts }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    }
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('betrix worker health');
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: err.message }));
  }
});

server.listen(PORT, () => {
  console.log('[health] server listening on port', PORT);
});
