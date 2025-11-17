const { spawn } = require('child_process');

console.log('[launcher] starting health server and worker');

const health = spawn(process.execPath, ['scripts/health-server.js'], { stdio: 'inherit' });
health.on('exit', (code) => console.log('[launcher] health server exited', code));

const worker = spawn(process.execPath, ['worker.js'], { stdio: 'inherit' });
worker.on('exit', (code) => {
  console.log('[launcher] worker exited', code);
  // Optional: keep health running even if worker exits; Render will keep service alive
});
