try {
  module.exports = require('../../server/index.js');
} catch (e) {
  console.error("shim require failed", e && (e.stack || e.message || String(e)));
  throw e;
}
