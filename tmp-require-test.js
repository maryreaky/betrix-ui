(async function(){
  try {
    const mod = require('./src/commands/menu-handler.js');
    console.log('MODULE_TYPE', typeof mod, 'EXPORT_KEYS', JSON.stringify(Object.keys(mod || {})));
    if (!mod || typeof mod.handleCommand !== 'function') {
      console.error('ERROR: handleCommand not found on module');
      process.exit(2);
    }
    const handler = mod.handleCommand;
    const env = { TELEGRAM_TOKEN: 'x', DATABASE_URL: process.env.DATABASE_URL || null };
    const job = { jobId:'local-test', payload: { message: { chat: { id: 999999 }, from: { id: 111111 }, text:'/menu', entities:[{offset:0,length:5,type:'bot_command'}] } } };
    const res = await handler(env, job);
    console.log('HANDLER_RESULT', JSON.stringify(res, null, 2));
    process.exit(0);
  } catch (e) {
    console.error('HANDLER_THROW', e && (e.stack || e.message));
    process.exit(3);
  }
})();
