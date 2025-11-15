const express = require("express");
const axios = require("axios");
const router = express.Router();
console.log("? Admin router loaded");

router.get("/env", (req, res) => {
  console.log("?? ROUTE-HIT /admin/env");
  res.json({ ok: true, openai_present: !!process.env.OPENAI_API_KEY, note: "admin env" });
});

router.get("/test-openai", async (req, res) => {
  console.log("?? ROUTE-HIT /admin/test-openai");
  if (!process.env.OPENAI_API_KEY) return res.status(200).json({ ok: false, status: "missing_env" });
  try {
    const r = await axios.get("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      timeout: 7000
    });
    return res.status(200).json({ ok: true, status: r.status, models_count: Array.isArray(r.data?.data) ? r.data.data.length : null });
  } catch (e) {
    const status = e.response?.status || "network/error";
    const message = e.response?.data?.error?.message || e.message;
    return res.status(200).json({ ok: false, status, message: String(message) });
  }
});

module.exports = router;
