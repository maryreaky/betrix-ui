const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

// Start Render health wrapper
spawn(process.execPath, ["-r","./src/server/startup-enforce-webhooks.js","./src/server/render-health-server.js"], { stdio:"inherit", env: process.env });

// Probe common server locations and require first found
const candidates = ["src/server/index.js","server/index.js","src/src/server/index.js","index.js"];
let loaded = false;
for (const rel of candidates) {
  const p = path.resolve(process.cwd(), rel);
  if (fs.existsSync(p)) {
    console.log("BOOT: loading", rel);
    require(p);
    loaded = true;
    break;
  }
}
if (!loaded) { console.error("BOOT-ERR: no server index found; looked:", candidates); process.exit(1); }
