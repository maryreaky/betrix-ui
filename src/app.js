/* AUTO-GENERATED src/app.js — mounts ./server/telegram router */
const express = require('express');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// mount existing telegram router (safe require)
try {
  const tg = require('./server/telegram');
  if (tg && typeof tg === 'function') {
    app.use(tg);
    console.log('MOUNTED: ./server/telegram (function export)');
  } else if (tg && tg.router) {
    app.use(tg.router);
    console.log('MOUNTED: ./server/telegram (router export)');
  } else if (tg && tg.stack) {
    app.use(tg);
    console.log('MOUNTED: ./server/telegram (assumed express middleware)');
  } else {
    console.log('telegram module loaded but did not export a router object/function');
  }
} catch (e) {
  console.error('MOUNT_TELEGRAM_FAILED', e && e.stack ? e.stack : String(e));
}

// minimal health for Render
app.get('/health', (req, res) => res.status(200).json({ ok: true, tag: process.env.DEPLOY_TAG || 'none' }));

module.exports = app;
