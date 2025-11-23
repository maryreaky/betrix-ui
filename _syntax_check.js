const fs = require("fs");
const vm = require("vm");
try {
  const code = fs.readFileSync("worker.js", "utf8");
  new vm.Script(code);
  console.log("PARSE_OK");
} catch (e) {
  console.error("PARSE_ERR", e && (e.stack || e.message));
  process.exit(2);
}
