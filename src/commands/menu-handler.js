// Lazy shim: require implementation at call time to avoid circular require timing issues
const handleCommand = async (...args) => {
  try {
    const impl = require('./menu-handler.impl.js');
    if (impl && typeof impl.handleCommand === 'function') {
      return await impl.handleCommand(...args);
    }
    console.error(new Date().toISOString(), 'MENU_HANDLER_IMPL_MISSING', { hasImpl: !!impl });
    return { ok:false, error:'menu-handler implementation missing' };
  } catch (err) {
    console.error(new Date().toISOString(), 'MENU_HANDLER_IMPL_LOAD_ERR', err && (err.stack||err.message));
    return { ok:false, error:'menu-handler.impl load error' };
  }
};
module.exports = { handleCommand };