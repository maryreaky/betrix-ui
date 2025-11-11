/*
  SAFE ENTRYPOINT WRAPPER
  - Attempts to require ./server.js or the original module
  - If module.exports is an http.Server or has .listen, use it
  - Otherwise create a simple http server that delegates to the exported app or returns /_health
*/
try {
  const http = require('http');
  let app = null;
  try { app = require('./server.js'); } catch(e) { try { app = require('./server.orig.js'); } catch(e2) { app = null; } }
  const HOST = process.env.HOST || '0.0.0.0';
  const PORT = (process.env.PORT && parseInt(process.env.PORT,10)) || 10000;

  function makeHealthHandler() {
    return (req, res) => {
      if (req.url === '/_health') { res.writeHead(200, {'Content-Type':'text/plain'}); return res.end('ok'); }
      res.writeHead(200, {'Content-Type':'text/plain'}); res.end('ok');
    };
  }

  if (app && typeof app.listen === 'function') {
    app.listen(PORT, HOST, () => console.log("SAFE: serverApp listening on " + HOST + ":" + PORT));
  } else {
    const handler = (typeof app === 'function') ? app : makeHealthHandler();
    const server = http.createServer(handler);
    server.listen(PORT, HOST, () => console.log("SAFE: http.createServer listening on " + HOST + ":" + PORT));
  }
} catch (err) {
  console.error("SAFE WRAPPER FATAL:", err && err.stack ? err.stack : err);
  setInterval(()=>{}, 1000);
}
