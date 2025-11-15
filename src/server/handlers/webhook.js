/*
 * src/server/handlers/webhook.js
 * Thin forwarder to let commands router handle webhook; kept for compatibility.
 */
module.exports = async function webhookHandler(req, res) {
  // Endpoints are now handled by src/server/commands/index.js which mounts /webhook/telegram
  res.status(200).send("OK");
};
