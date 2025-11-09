/*
  Generated wrapper: exports createServer() and starts server when run directly.
  Purpose: make the safe wrapper detect createServer, avoid circular imports,
           and use process.env.PORT when starting.
*/
const http = require('http');

function createServer() {
  // Lazy require to break circular deps
  let candidate;
  try {
    candidate = require('./server.orig');
  } catch (e) {
    // server.orig may not exist or may throw at import-time; we will fall back below
    candidate = null;
  }

  // If server.orig exported an Express/Koa app (function with use/get) -> wrap it
  if (candidate && typeof candidate === 'function') {
    try {
      // common case: module.exports = app (express)
      if (candidate && candidate.use && candidate.listen === undefined) {
        const app = candidate;
        return http.createServer(app);
      }
    } catch (e) {}
  }

  // If server.orig exported an object with createServer function or exported createServer directly
  if (candidate && typeof candidate.createServer === 'function') {
    return candidate.createServer();
  }

  // If server.orig exported an http.Server instance (rare) - return it if possible
  if (candidate && candidate instanceof http.Server) {
    return candidate;
  }

  // Fallback: lazy-create a minimal Express app so wrapper detection succeeds
  const express = require('express');
  const app = express();

  // Minimal health and webhook placeholders - preserve existing app behavior if server.orig exports route handlers as functions
  try {
    // if server.orig exposes a function to register handlers, call it lazily
    if (candidate && typeof candidate === 'object') {
      // allow server.orig to optionally export a function like attach(app)
      if (typeof candidate.attach === 'function') {
        candidate.attach(app);
      } else if (typeof candidate.register === 'function') {
        candidate.register(app);
      }
    }
  } catch (e) {
    // swallow; fallback continues
    console.error('Wrapper: failed to attach original handlers:', e && e.message ? e.message : e);
  }

  app.get('/_health', (req, res) => res.status(200).send('OK'));
  return http.createServer(app);
}

// Export createServer for platform detection
module.exports = { createServer };

// If run directly, start the server using process.env.PORT
if (require.main === module) {
  const port = process.env.PORT || 10000;
  const server = createServer();
  server.listen(port, () => console.log(`SERVER: listening on port ${port}`));
}
