if (typeof app !== 'undefined') {
  app.get('/__probe', (req, res) => res.json({ ok: true, probe: 'root', tag: process.env.DEPLOY_TAG || 'none', ts: Date.now() }));
  app.get('/admin-env-bypass', (req, res) => res.json({ ok: true, bypass: true, tag: process.env.DEPLOY_TAG || 'none', ts: Date.now() }));
}
const PORT = process.env.PORT ? parseInt(process.env.PORT,10) : (process.env.BETRIX_PORT ? parseInt(process.env.BETRIX_PORT,10) : (process.env.PORT || (process.env.PORT || (process.env.PORT || process.env.PORT || 3000))));

/*
  Safe wrapper inserted for diagnostics.
  It attempts to require ./server.orig.js and prints any load/parse error.
  Keeps process alive for inspection.
*/
console.log("SAFE WRAPPER START: pid=" + process.pid + " node=" + process.version + " cwd=" + process.cwd());
process.on("uncaughtException", e => { console.error("UNCAUGHT EXCEPTION:", e && e.stack ? e.stack : e); });
process.on("unhandledRejection", r => { console.error("UNHANDLED REJECTION:", r && r.stack ? r.stack : r); });

try {
  // Attempt to load the original app
  require('./server.orig.js');
  console.log("server.orig.js loaded successfully");
} catch (e) {
  console.error("ERROR LOADING server.orig.js:", e && e.stack ? e.stack : e);
  console.error("If you see a SyntaxError / Unexpected end of input, the original file is malformed near the end.");
}

// Keep the process alive for manual inspection (prints a heartbeat every 30s)
setInterval(() => console.log("SAFE WRAPPER HEARTBEAT: process running at " + new Date().toISOString()), 30000);


// Health check required by Render
if (typeof app !== 'undefined') { app.get('/health', (req, res) => res.status(200).json({ ok: true, tag: process.env.DEPLOY_TAG || 'none' })); }



process.on('unhandledRejection', (err) => { console.error('UnhandledRejection', err && err.stack ? err.stack : err) })
process.on('uncaughtException', (err) => { console.error('UncaughtException', err && err.stack ? err.stack : err) })




