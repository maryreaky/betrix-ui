/* Minimal safe worker.impl.js - BRPOP loop and logging */
const Redis = require('redis');

async function main() {
  try {
    const url = process.env.REDIS_URL || undefined;
    const client = Redis.createClient({ url });
    client.on('error', (e) => console.error('redis-err', e && (e.stack||e.message||String(e))));
    await client.connect();
    console.info('FALLBACK_WORKER_STARTED', { ts: new Date().toISOString(), redis: !!url });

    while (true) {
      try {
        const res = await client.brPop('betrix-jobs', 5);
        if (!res) continue;
        let payload; if (Array.isArray(res)) { payload = res[1]; } else if (res && typeof res === 'object') { payload = res.element || res.value || res.payload || (res[1] || JSON.stringify(res)); } else { payload = res; }
        console.info('WORKER:BRPOP', payload);
        try {
          const job = JSON.parse(payload);
          console.info('WORKER:JOB_PARSED', { jobId: job.jobId, type: job.type, chatId: job.payload?.message?.chat?.id || job.chatId || null });
        } catch (e) {
          console.error('WORKER:JOB_PARSE_ERR', e && (e.stack||e.message||String(e)));
        }
      } catch (e) {
        console.error('WORKER_LOOP_ERR', e && (e.stack||e.message||String(e)));
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  } catch (e) {
    console.error('FALLBACK_FATAL', e && (e.stack||e.message||String(e)));
    process.exit(1);
  }
}

main();

