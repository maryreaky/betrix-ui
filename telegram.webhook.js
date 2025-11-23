/*
  Minimal Telegram webhook server
  - POST /telegram/:token  -> immediately 200 and enqueue job to Redis list "betrix-jobs"
  - GET  /health          -> 200 {"status":"ok"}
  Compatible with REDIS_URL (redis://user:pass@host:port or redis://:pass@host:port)
*/
const express = require('express');
const bodyParser = require('body-parser');
const { createClient } = require('redis');

function parseRedisOptsFromEnv() {
  if (process.env.REDIS_URL) {
    try {
      const url = new URL(process.env.REDIS_URL);
      const opts = { socket: { host: url.hostname, port: Number(url.port) || 6379, tls: url.protocol === 'rediss:' } };
      if (url.username) opts.username = decodeURIComponent(url.username);
      if (url.password) opts.password = decodeURIComponent(url.password.replace(/^:/, ''));
      return opts;
    } catch (err) {
      console.warn('WARN_BAD_REDIS_URL', err && err.message);
    }
  }
  const opts = { socket: { host: process.env.REDIS_HOST || '127.0.0.1', port: Number(process.env.REDIS_PORT) || 6379, tls: (process.env.REDIS_TLS === 'true') } };
  if (process.env.REDIS_USERNAME) opts.username = process.env.REDIS_USERNAME;
  if (process.env.REDIS_PASSWORD) opts.password = process.env.REDIS_PASSWORD;
  return opts;
}

const redisOpts = parseRedisOptsFromEnv();
console.info('WEBHOOK_REDIS_OPTS', { host: redisOpts.socket.host, port: redisOpts.socket.port, tls: !!redisOpts.socket.tls, username: !!redisOpts.username, hasPassword: !!redisOpts.password });

const redisClient = createClient(redisOpts);

redisClient.on('error', (err) => {
  console.error('WEBHOOK_REDIS_ERROR', err && err.message);
});

(async () => {
  try {
    await redisClient.connect();
    console.info('WEBHOOK_REDIS_CONNECTED');
  } catch (err) {
    console.error('WEBHOOK_REDIS_CONNECT_FAILED', err && err.message);
    // Crash so platform surfaces the failure
    process.exit(1);
  }

  const app = express();
  app.use(bodyParser.json({ limit: '128kb' }));

  // Health endpoint
  app.get('/health', (req, res) => res.status(200).json({ status: 'ok', ts: new Date().toISOString() }));

  // POST /telegram/:token -> immediate ack and enqueue
  app.post('/telegram/:token', async (req, res) => {
    try {
      const incomingToken = req.params.token;
      const expected = process.env.TELEGRAM_TOKEN;
      if (!expected) {
        console.warn('WEBHOOK_NO_TELEGRAM_TOKEN');
        // Accept but log; enqueue for inspection
      } else if (incomingToken !== expected) {
        console.warn('WEBHOOK_TOKEN_MISMATCH', { received: !!incomingToken, expectedPresent: !!expected });
        // Return 403 if token mismatches to avoid processing bad requests
        res.status(403).json({ ok: false, error: 'invalid token' });
        return;
      }

      // Respond immediately so Telegram considers delivery successful
      res.status(200).json({ ok: true });

      // Compose job and enqueue (non-blocking)
      const job = {
        jobId: 'webhook-' + Date.now(),
        type: 'telegram_update',
        tokenMasked: incomingToken ? ('***len:' + incomingToken.length) : false,
        payload: req.body,
        receivedAt: new Date().toISOString()
      };

      // Non-blocking enqueue with safe logging
      try {
        await redisClient.lPush('betrix-jobs', JSON.stringify(job));
        console.info('WEBHOOK_ENQUEUED', { jobId: job.jobId, pendingHint: 'lPush' });
      } catch (err) {
        console.error('WEBHOOK_ENQUEUE_FAILED', err && err.message, { jobId: job.jobId });
      }
    } catch (err) {
      console.error('WEBHOOK_HANDLER_EXCEPTION', err && err.message);
      try { res.status(500).json({ ok: false }); } catch (_) { /* noop */ }
    }
  });

  const bindPort = Number(process.env.PORT) || 10000;
  app.listen(bindPort, () => {
    console.info('WEBHOOK_LISTENING', { port: bindPort });
  });

})();
