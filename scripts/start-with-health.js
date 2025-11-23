/* scripts/start-with-health.js */
const { spawn } = require('child_process');
const path = require('path');
const args = process.argv.slice(2);
const serviceArgIndex = args.indexOf('--service');
const service = serviceArgIndex >= 0 && args[serviceArgIndex + 1] ? args[serviceArgIndex + 1] : 'web';
const { connection } = require('../src/lib/redis');
function fatal(msg) {
  console.error('[start-with-health] FATAL:', msg);
  process.exit(1);
}
async function checkRedis() {
  const redisUrl = process.env.REDIS_URL || process.env.REDIS_URI || process.env.REDIS || '';
  if (!redisUrl) {
    fatal('REDIS_URL is not set. Set REDIS_URL in Render environment.');
  }
  if (!connection) {
    fatal('Redis connection could not be established by the canonical factory. Check REDIS_URL and ensure provider is BullMQ-compatible.');
  }
  try {
    const res = await connection.ping();
    if (res !== 'PONG') {
      fatal('Unexpected Redis PING response: ' + String(res));
    }
    console.info('[start-with-health] Redis PING OK');
  } catch (err) {
    fatal('Redis PING failed: ' + (err && err.message ? err.message : String(err)));
  }
}
function startProcess(cmd, cmdArgs = []) {
  console.info('[start-with-health] Launching:', cmd, cmdArgs.join(' '));
  const child = spawn(cmd, cmdArgs, { stdio: 'inherit', shell: true, env: process.env });
  child.on('exit', (code) => {
    console.log('[start-with-health] child exited with code', code);
    process.exit(code);
  });
  child.on('error', (err) => {
    console.error('[start-with-health] failed to start child process', err);
    process.exit(1);
  });
}
(async function main() {
  if (process.env.NODE_ENV !== 'production') {
    console.warn('[start-with-health] NODE_ENV is not production. This wrapper is intended for Render production start.');
  }
  await checkRedis();
  if (service === 'worker') {
    startProcess('node', [path.join(process.cwd(), 'worker.js')]);
  } else {
    startProcess('node', [path.join(process.cwd(), 'server.js')]);
  }
})();
