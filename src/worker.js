const { createClient } = require('redis');

(async () => {
  const client = createClient({ url: process.env.REDIS_URL });
  client.on('error', err => console.error('Redis error', err));
  await client.connect();

  console.log('Worker connected to Redis, waiting for jobs...');

  while (true) {
    try {
      const job = await client.brPop('telegram:webhook:queue', 0);
      if (job) {
        console.log('Job popped:', job);
        // TODO: process job.payload here
      }
    } catch (err) {
      console.error('Worker loop error', err);
    }
  }
})();
