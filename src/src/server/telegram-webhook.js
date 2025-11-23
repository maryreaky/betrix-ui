const express = require("express");
const router = express.Router();
router.post("/telegram", express.json(), (req, res) => {
  console.log("Incoming Telegram webhook", { body: req.body });
  res.sendStatus(200);
});
module.exports = router;
