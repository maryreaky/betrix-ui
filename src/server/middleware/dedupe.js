/*
  src/server/middleware/dedupe.js
  Exports a factory that returns Express-style middleware and also exposes an init function.
  Usage:
    const createDedupe = require('./middleware/dedupe');
    app.use(createDedupe(60));
*/
const { createClient } = require('redis');

let client = null;
let ready = false;

async function initClient() {
  const rawUrl = process.env.REDIS_URL;
  if (!rawUrl || (process.env.DEDUPE_ENABLED && process.env.DEDUPE_ENABLED.toLowerCase() === 'false')) {
    console.log('DEDPUPE-MW: REDIS_URL not set or dedupe disabled; dedupe disabled');
    client = null;
    ready = false;
    return;
  }

  let safeUrl = rawUrl;
  try {
    const u = new URL(rawUrl);
    if (u.password) { u.password = encodeURIComponent(u.password); safeUrl = u.toString(); }
  } catch (e) {
    safeUrl = rawUrl;
  }

  client = createClient({
    url: safeUrl,
    socket: {
      reconnectStrategy: attempts => Math.min(1000 + attempts * 200, 5000)
    }
  });

  client.on('error', err => console.error('DEDPUPE-MW: redis error', err && err.message));
  client.on('connect', () => console.log('DEDPUPE-MW: connecting...'));
  client.on('ready', () => { ready = true; console.log('DEDPUPE-MW: connected'); });
  client.on('reconnecting', () => console.log('DEDPUPE-MW: reconnecting'));
  client.on('end', () => { ready = false; console.log('DEDPUPE-MW: connection ended'); });

  try {
    await client.connect();
  } catch (e) {
    console.error('DEDPUPE-MW: connection failed; dedupe disabled', e && e.message);
    client = null;
    ready = false;
  }
}

async function init() {
  await initClient();
}

function factory(opts = {}) {
  const ttl = opts.ttl || 60;
  return async function dedupeMiddleware(req, res, next) {
    try {
      if (!client || !ready) {
        return next();
      }

      const keyParts = [req.method, req.path];
      if (req.body) {
        const bodyStr = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
        const hash = require('crypto').createHash('sha1').update(bodyStr).digest('hex').slice(0, 8);
        keyParts.push(hash);
      }
      const key = `dedupe:${keyParts.join(':')}`;

      const set = await client.setNX(key, '1');
      if (set) {
        await client.expire(key, ttl);
        return next();
      } else {
        res.status(429).send({ error: 'Duplicate request' });
      }
    } catch (err) {
      console.error('DEDPUPE-MW: error in middleware', err && err.message);
      return next();
    }
  };
}

module.exports = factory;
module.exports.init = init;




