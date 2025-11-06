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
app.listen(PORT, "0.0.0.0", () => {
  console.log("✅ BETRIX server listening on", PORT);
});
