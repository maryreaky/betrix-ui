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
