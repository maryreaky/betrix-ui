// menu-handler shim — side-effect-free to avoid self-require circular load
try {
  const impl = require("./menu-handler.impl.js");
  if (impl && typeof impl.handleCommand === "function") {
    module.exports = { handleCommand: impl.handleCommand };
  } else {
    module.exports = {
      handleCommand: async function(env, updateOrJob) {
        console.error(new Date().toISOString(), "MENU_HANDLER_IMPL_MISSING", { hasImpl: !!impl });
        return { ok:false, error:"menu-handler implementation missing" };
      }
    };
  }
} catch (err) {
  module.exports = {
    handleCommand: async function(env, updateOrJob) {
      console.error(new Date().toISOString(), "MENU_HANDLER_IMPL_LOAD_ERROR", err && (err.stack || err.message));
      return { ok:false, error:"menu-handler.impl load error" };
    }
  };
}
