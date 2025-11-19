const express = require("express");
const router = express.Router();

router.post("/telegram", express.json(), (req, res) => {
  console.log("FIXED_HANDLER_RAW", JSON.stringify(req.body));
  const header = req.get("X-Telegram-Bot-Api-Secret-Token");
  console.log("FIXED_HANDLER_HEADER", header ? "<present>" : "<absent>");
  res.status(200).send("fixed-ok");
});

module.exports = router;
