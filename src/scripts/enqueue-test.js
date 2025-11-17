const { createQueue } = require('../server/queue');

(async () => {
  const queue = createQueue('betrix-jobs');
  const job = await queue.add('hello-world', { ts: Date.now(), from: 'enqueue-test' });
  console.log('[producer] enqueued job', job.id);
  process.exit(0);
})();
