const http = require('http');
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
  if (req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, ts: Date.now() }));
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('betrix worker health');
});
server.listen(PORT, () => {
  console.log('[health] server listening on port', PORT);
});
const url = require('url');
const { getQueue } = require('../src/server/queue'); const metricsQueue = getQueue('betrix-jobs');

const original = server.listeners('request')[0];
server.removeAllListeners('request');
server.on('request', async (req, res) => {
  const { pathname } = url.parse(req.url);
  if (pathname === '/metrics') {
    try {
      const counts = await metricsQueue.getJobCounts();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, counts }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: false, error: e.message }));
    }
  }
  return original.call(server, req, res);
});

