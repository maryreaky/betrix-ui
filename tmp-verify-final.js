(async function(){
  try {
    const mod = require('./src/commands/menu-handler.js');
    console.log('EXPORT_KEYS', JSON.stringify(Object.keys(mod||{})));
    if (!mod || typeof mod.handleCommand !== 'function') { console.error('NO handleCommand'); process.exit(2); }
    const res = await mod.handleCommand({ TELEGRAM_TOKEN: 'x' }, { payload:{ message:{ chat:{ id: 999999 }, text:'/menu' } }, jobId:'local-final' });
    console.log('HANDLER_RESULT', JSON.stringify(res,null,2));
    process.exit(0);
  } catch(e) { console.error('THROW', e && (e.stack||e.message)); process.exit(3); }
})();
