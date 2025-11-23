'use strict';
// render-wrapper.js
// Requires your app entry and keeps the Node process alive if the app exits synchronously.
// Safe, minimal, and side-effect conservative.
try {
  // Ensure PORT is forwarded if present; app should read process.env.PORT itself.
  const entry = require('../index.js'); // relative to src/server -> loads src/index.js
  // If the app exported a function to start a server, call it with the PORT if available.
  try {
    if (typeof entry === 'function') {
      // call exported function with port if it accepts args
      entry(process.env.PORT || process.env.PORT === undefined ? undefined : process.env.PORT);
    }
  } catch (e) {
    // ignore — entry may not be a server factory
  }
} catch (e) {
  // If require throws synchronously, print a concise error and rethrow to show up in logs.
  console.error('render-wrapper require error:', e && e.stack ? e.stack : e);
  throw e;
}
// Keep process alive if the main module didn't start a long-running server.
// Use a no-op interval to avoid CPU spin; this is only a safety net.
setInterval(() => {}, 1000);
