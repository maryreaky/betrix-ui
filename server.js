const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');

const app = express();

// Very small logger for first 60s to capture probes
let captureLogsUntil = Date.now() + 60000;
function log(...args) { if (Date.now() < captureLogsUntil) console.log(...args); }

// Minimal routes registered first
app.get('/_health', (req, res) => res.status(200).send('ok'));
app.head('/_health', (req, res) => res.status(200).end());
app.get('/', (req, res) => res.status(200).send('ok'));
app.head('/', (req, res) => res.status(200).end());

// Simple request logger to capture probe hits
app.use((req, res, next) => {
  log('REQ', req.method, req.url, 'headers:', JSON.stringify(req.headers));
  next();
});

// Example webhook route (safe, optional)
app.post('/telegram/webhook', express.json(), (req, res) => {
  log('Webhook hit');
  res.status(200).send('ok');
});

// Serve static UI after API routes
const staticDir = path.join(__dirname, 'dist');
if (fs.existsSync(staticDir)) {
  app.use(express.static(staticDir, { index: false }));
  app.get('*', (req, res, next) => {
    const accept = req.headers.accept || '';
    if (accept.includes('text/html')) {
      const index = path.join(staticDir, 'index.html');
      if (fs.existsSync(index)) return res.sendFile(index);
    }
    next();
  });
}

// Global error handlers to prevent silent exits
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION', err && err.stack ? err.stack : err);
});
process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION', reason);
});

// Create HTTP server to allow configuring server timeouts
const PORT = parseInt(process.env.PORT || '10000', 10);
const server = http.createServer(app);

// Increase timeouts so Render's probe has time
server.headersTimeout = 60000;
server.requestTimeout = 60000;

server.listen(PORT, '0.0.0.0', () => {
  console.log('Server listening on 0.0.0.0:' + PORT);
});
