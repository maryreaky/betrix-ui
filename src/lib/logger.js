/*
 * src/lib/logger.js
 * Simple structured logger that writes JSON to stdout and provides a prometheus-like counter holder.
 */
const counters = {};
module.exports = {
  info: (obj) => { try { console.log(JSON.stringify(Object.assign({ level: "info", ts: new Date().toISOString() }, obj))); } catch(e) { console.log("log-err", e && e.message); } },
  error: (obj) => { try { console.error(JSON.stringify(Object.assign({ level: "error", ts: new Date().toISOString() }, obj))); } catch(e) { console.error("log-err", e && e.message); } },
  inc: (metric) => { counters[metric] = (counters[metric]||0) + 1; },
  metricsHandler: (_req, res) => {
    const lines = Object.entries(counters).map(([k,v]) => `${k} ${v}`);
    res.setHeader("Content-Type","text/plain; version=0.0.4");
    res.end(lines.join("\n"));
  }
};
