/*
 * src/server/middleware/paywall.js
 * Skeleton middleware: checks external VIP API for user tier; set BETRIX_VIP_API_URL and BETRIX_API_KEY
 */
const fetch = globalThis.fetch || require("node-fetch");
module.exports = function paywall(requiredTier="vip") {
  return async (req, res, next) => {
    const chatId = req.body?.message?.chat?.id;
    if (!chatId) return next();
    try {
      const url = (process.env.BETRIX_VIP_API_URL || "") + `/users/${chatId}/tier`;
      if (!process.env.BETRIX_VIP_API_URL) return next(); // paywall not configured
      const resp = await fetch(url, { headers: { "Authorization": `Bearer ${process.env.BETRIX_API_KEY || ""}` }});
      const data = await resp.json();
      if (data && data.tier === requiredTier) return next();
      // respond with paywall message
      const token = process.env.TELEGRAM_BOT_TOKEN;
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ chat_id: chatId, text: "This action requires VVIP access. Visit https://betrix.com/vip to upgrade." })
      });
      return res.status(200).send("OK");
    } catch (err) {
      console.error("PAYWALL-ERR", err && (err.stack || err.message));
      return next();
    }
  };
};
