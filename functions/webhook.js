 // functions/webhook.js
 exports.handler = async (event) => {
   try {
     const url = require('url');
     const qs = url.parse(event.rawUrl || event.path || '', true).query;
     if (process.env.WEBHOOK_SECRET && qs.secret !== process.env.WEBHOOK_SECRET) {
       return { statusCode: 403, body: 'Forbidden' };
     }

     let update = {};
     try { update = JSON.parse(event.body || '{}'); } catch (e) {}

     console.log('incoming update', JSON.stringify(update).slice(0, 2000));

     setImmediate(() => {
       // enqueue or process update asynchronously
       console.log('enqueued update for processing', update?.message?.chat?.id || 'no-chat');
     });

     return { statusCode: 200, body: 'OK' };
   } catch (err) {
     console.error('webhook handler error', err);
     return { statusCode: 500, body: 'Internal Server Error' };
   }
 };
