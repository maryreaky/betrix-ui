const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const app = express();

app.get('/_health', (req, res) => res.status(200).send('ok'));
app.head('/_health', (req, res) => res.status(200).end());
app.get('/', (req, res) => res.status(200).send('ok'));
app.head('/', (req, res) => res.status(200).end());

let captureUntil = Date.now() + 60000;
function log(...a) { if (Date.now() < captureUntil) console.log(...a); }
app.use((req,res,next) => { log('REQ', req.method, req.url); next(); });

app.post('/telegram/webhook', express.json(), (req,res) => { log('webhook hit'); res.status(200).send('ok'); });

const staticDir = path.join(__dirname,'dist');
if (fs.existsSync(staticDir)) {
  app.use(express.static(staticDir, { index: false }));
  app.get('*', (req,res,next) => {
    const accept = req.headers.accept || '';
    if (accept.includes('text/html')) {
      const index = path.join(staticDir,'index.html');
      if (fs.existsSync(index)) return res.sendFile(index);
    }
    next();
  });
}

process.on('uncaughtException', e => console.error('UNCAUGHT', e && e.stack ? e.stack : e));
process.on('unhandledRejection', r => console.error('UNHANDLED REJECTION', r));

const PORT = parseInt(process.env.PORT || '10000',10);
const server = http.createServer(app);
server.headersTimeout = 60000;
server.requestTimeout = 60000;
server.listen(PORT, '0.0.0.0', () => console.log('Server listening on 0.0.0.0:' + PORT));
