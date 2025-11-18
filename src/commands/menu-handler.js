let impl = null;

function getImpl() {
  if (!impl) {
    impl = require('./menu-handler.impl.js');
  }
  return impl;
}

async function handleCommand(env, job) {
  const { handleCommand } = getImpl();
  if (typeof handleCommand !== 'function') {
    throw new Error('MENU_HANDLER_IMPL_MISSING');
  }
  return handleCommand(env, job);
}

module.exports = { handleCommand };
