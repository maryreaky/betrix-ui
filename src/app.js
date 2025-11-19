/* AUTO-GENERATED src/app.js — mounts ./server/telegram router */
const express = require('express');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// mount existing telegram router (safe require)
  try { app.use(require('./server/telegram-shim')); console.log('MOUNTED: ./server/telegram-shim'); } catch(e) { console.error('MOUNT_FAILED_SHIM', e && e.stack ? e.stack : String(e)); }
