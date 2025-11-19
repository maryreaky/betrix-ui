/**
 * Entry wrapper to ensure runtime sees TELEGRAM_WEBHOOK_SECRET and to add tolerant webhook mount.
 * Temporary debug helper.
 */
const fs = require("fs");
const express = require("express");

function loadSecretFile() {
  try {
    const p = "/etc/secrets/TELEGRAM_WEBHOOK_SECRET";
    if (fs.existsSync(p)) {
      const v = fs.readFileSync(p, "utf8").trim();
      if (v) {
        process.env.TELEGRAM_WEBHOOK_SECRET = v;
        console.log("SECRET_FILE_LOADED", { path: p, length: v.length });
      }
    }
  } catch (e) { console.error("SECRET_FILE_LOAD_ERR", e && e.stack ? e.stack : String(e)); }
}

loadSecretFile();

console.log("ENTRY_ENV_SNAPSHOT", {
  TELEGRAM_WEBHOOK_SECRET_present: !!process.env.TELEGRAM_WEBHOOK_SECRET,
  TELEGRAM_TOKEN_present: !!process.env.TELEGRAM_TOKEN,
  WEBHOOK_SECRET_present: !!process.env.WEBHOOK_SECRET,
  REDIS_URL_present: !!process.env.REDIS_URL
});

let app;
try {
  app = require("./src/app");
  if (app && app.listen) {
    console.log("LOADED_APP_FROM_src_app");
  } else if (app && app.default && app.default.listen) {
    app = app.default;
    console.log("LOADED_APP_FROM_src_app_default");
  } else {
    throw new Error("src/app did not export express app");
  }
} catch (e) {
  console.log("FALLBACK_CREATE_EXPRESS_APP", String(e).split("\\n")[0]);
  app = express();
  app.get("/health", (req, res) => res.status(200).send("ok"));
}

// Ensure tolerant /telegram route if not already present
try {
  const hasTelegram = !!(app._router && app._router.stack && app._router.stack.some(s => s.route && s.route.path === "/telegram"));
  if (!hasTelegram) {
    const telegramJson = express.json({ limit: "256kb" });
    app.post("/telegram/:secret?", telegramJson, (req, res, next) => {
      try {
        const expected = process.env.TELEGRAM_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET || process.env.TELEGRAM_TOKEN || "";
        const header = req.get("X-Telegram-Bot-Api-Secret-Token") || "";
        const pathSecret = req.params && req.params.secret ? req.params.secret : "";
        console.log("TOLERANT_WEBHOOK_SEEN", {
          header: header ? (header.length > 8 ? header.slice(0,8) + "..." : header) : "",
          pathSecret: pathSecret ? (pathSecret.length > 8 ? pathSecret.slice(0,8) + "..." : pathSecret) : "",
          expected_present: !!expected
        });
        if (!expected || header === expected || pathSecret === expected) {
          try {
            const handler = require("./src/server/telegram-webhook");
            if (typeof handler === "function") return handler(req, res, next);
            if (handler && typeof handler.handle === "function") return handler.handle(req, res, next);
          } catch (e) {
            console.error("TOLERANT_HANDLER_MISSING", e && e.stack ? e.stack : String(e));
            return res.status(200).json({ ok:true, note:"tolerant-accept-no-handler" });
          }
        }
        return res.status(403).json({ ok:false, error:"invalid token" });
      } catch (err) { next(err); }
    });
    console.log("MOUNTED_TOLERANT_TELEGRAM_ROUTE");
  } else {
    console.log("TELEGRAM_ROUTE_ALREADY_MOUNTED");
  }
} catch (e) {
  console.error("MOUNT_TOLERANT_ROUTE_ERR", e && e.stack ? e.stack : String(e));
}

const port = process.env.PORT || process.env.PORT_WEB || 10000;
if (!module.parent) {
  app.listen(port, () => {
    console.log("WRAPPER_SERVER_LISTENING", { port });
  });
}

module.exports = app;
