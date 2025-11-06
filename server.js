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
