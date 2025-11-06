console.log('DEPLOY_TAG: 20251106-132726');

/* ROOT PROBES (debug) */
const express_probe = (app) => {
  try {
    app.get('/__probe', (req, res) => res.json({ ok: true, probe: 'root', tag: '20251106-132726', ts: Date.now() }));
    app.get('/admin-env-bypass', (req, res) => res.json({ ok: true, bypass: true, tag: '20251106-132726', ts: Date.now() }));
  } catch(e) {
    console.error('probe-insert-failed', e && e.message);
  }
};
/* END PROBES */
const express = require("express");
const app = express();

// Mount admin router
try {
  const adminRouter = require("./server/routes/admin");
  app.use("/admin", adminRouter);
  console.log("✅ Admin router mounted at /admin");
} catch (e) {
  console.error("❌ Admin router failed to load:", e.message);
}

// Health probe
app.get("/__probe", (req, res) => res.json({ ok: true, ts: Date.now() }));

// Start server
const PORT = process.env.PORT || 10000;
express_probe(app);
express_probe(app);
app.listen(PORT, "0.0.0.0", () => {
  console.log("✅ BETRIX server listening on", PORT);
});



