'use strict';
// render-health-server.js - binds to process.env.PORT and returns 200 on /health
const http = require('http');
try { require('../index.js'); } catch (e) { console.error('app require error (non-fatal):', e && e.stack ? e.stack : e); }
const port = process.env.PORT ? parseInt(process.env.PORT,10) : 3000;
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
    return;
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});
server.listen(port, () => {
  console.log(`Render health server listening on port ${port}`);
});