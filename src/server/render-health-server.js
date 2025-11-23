const http = require('http');
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('OK');
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('betrix-ui');
});
server.on('error', (err) => {
  console.error('Render health server error:', err && err.stack ? err.stack : err);
  process.exit(1);
});
server.listen(port, '0.0.0.0', () => {
  console.log('Render health server listening on port', port);
});
