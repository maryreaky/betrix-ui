const { createQueue } = require('../server/queue');

(async () => {
  const queue = createQueue('betrix-jobs');
  const job = await queue.add('hello-world', { ts: Date.now(), from: 'enqueue-test' }, {
    attempts: 5,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: true,
    removeOnFail: false
  });
  console.log('[producer] enqueued job', job.id);
  process.exit(0);
})();
