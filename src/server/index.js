// Auto-generated forwarder to ensure require('./server') exports createServer
try {
  const mod = require('./app'); // load app.js
  if (mod && typeof mod.createServer === 'function') {
    module.exports = { createServer: mod.createServer };
  } else if (typeof mod === 'function') {
    module.exports = { createServer: mod };
  } else if (mod && typeof mod === 'object') {
    // Re-export whatever is present; missing createServer will be logged in startup
    module.exports = mod;
  } else {
    module.exports = {};
  }
} catch (e) {
  console.error('SERVER-FORWARDER-ERR', e && (e.stack || e.message || String(e)));
  // export empty to let the main bootstrap fail with more helpful logs
  module.exports = {};
}
