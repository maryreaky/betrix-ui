  // resilient dedupe middleware startup (node-redis v4)
  const { createClient } = require('redis');

  function encodePasswordInUrl(rawUrl) {
    try {
      const u = new URL(rawUrl);
      if ((u.username === '' || u.username === null) && u.password) {
        u.password = encodeURIComponent(u.password);
      }
      return u.toString();
    } catch (e) {
      return rawUrl;
    }
  }

  (async function initDedupe() {
    const rawUrl = process.env.REDIS_URL;
    if (!rawUrl || (process.env.DEDUPE_ENABLED && process.env.DEDUPE_ENABLED.toLowerCase() === 'false')) {
      console.log('DEDPUPE-MW: REDIS_URL not set or dedupe disabled; dedupe disabled');
      global.dedupeClient = null;
      return;
    }

    const safeUrl = encodePasswordInUrl(rawUrl);
    const client = createClient({
      url: safeUrl,
      socket: {
        reconnectStrategy: attempts => Math.min(1000 + attempts * 200, 5000)
      }
    });

    client.on('error', err => {
      console.error('DEDPUPE-MW: redis error', err && err.message);
    });

    client.on('connect', () => console.log('DEDPUPE-MW: connecting...'));
    client.on('ready', () => console.log('DEDPUPE-MW: connected'));
    client.on('reconnecting', () => console.log('DEDPUPE-MW: reconnecting'));
    client.on('end', () => console.log('DEDPUPE-MW: connection ended'));

    try {
      await client.connect();
      global.dedupeClient = client;
    } catch (e) {
      console.error('DEDPUPE-MW: connection failed; dedupe disabled', e && e.message);
      global.dedupeClient = null;
    }
  })();
