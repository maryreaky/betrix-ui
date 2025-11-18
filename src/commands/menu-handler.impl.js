// Shim menu-handler.js — imports implementation and re-exports handleCommand.
// This shim must be side-effect free at require time to avoid circular self-require.
try {
  const impl = require('./menu-handler.impl.js');
  if (impl && typeof impl.handleCommand === 'function') {
    module.exports = { handleCommand: impl.handleCommand };
  } else {
    // fallback shim: export a safe function
    module.exports = {
      handleCommand: async function(env, jobOrUpdate) {
        console.error(new Date().toISOString(), 'MENU_HANDLER_IMPL_MISSING', { hasImpl: !!impl });
        return { ok:false, error:'menu-handler implementation missing' };
      }
    };
  }
} catch (e) {
  // If impl failed to load (syntax error), export safe fallback to avoid throwing at require
  module.exports = {
    handleCommand: async function(env, jobOrUpdate) {
      console.error(new Date().toISOString(), 'MENU_HANDLER_IMPL_LOAD_ERR', e && (e.stack||e.message));
      return { ok:false, error:'menu-handler.impl load error' };
    }
  };
}
