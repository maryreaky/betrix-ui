const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

// Start Render health wrapper as a child process (keeps logs in the same stream)
const healthArgs = ["-r", "./src/server/startup-enforce-webhooks.js", "./src/server/render-health-server.js"];
const health = spawn(process.execPath, healthArgs, { stdio: "inherit", env: process.env, cwd: process.cwd() });
health.on("error", (e) => console.error("health wrapper failed:", e && (e.stack || e.message || e)));
health.on("exit", (code, sig) => console.log("health wrapper exit:", code, sig));

// Probe candidate server index locations and require the first that exists
const candidates = [
  path.join("src","server","index.js"),
  path.join("server","index.js"),
  path.join("src","src","server","index.js"),
  path.join("index.js")
];

let loaded = false;
for (const rel of candidates) {
  const p = path.resolve(process.cwd(), rel);
  if (fs.existsSync(p)) {
    console.log("BOOT: loading", rel);
    try {
      require(p);
      loaded = true;
    } catch (e) {
      console.error("BOOT-ERR: require failed for", rel, e && (e.stack || e.message || e));
      process.exit(1);
    }
    break;
  }
}

if (!loaded) {
  console.error("BOOT-ERR: no server index found; looked:", candidates);
  process.exit(1);
}
