const express = require("express");
const app = express();
app.use(express.json({limit: "100kb"}));
app.get("/health", (req, res) => res.json({ ok: true }));
app.post("/telegram", (req, res) => {
  // minimal webhook responder: accept requests and acknowledge immediately
  console.log("telegram webhook received:", req.method, req.path, typeof req.body === "object" ? "json" : "no-body");
  res.status(200).send("ok");
});
module.exports = app;
