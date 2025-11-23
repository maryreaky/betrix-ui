/*
 server/middleware/dedupe.js
 Simple dedupe middleware using Redis SET NX EX.
/* explicit dedupe init: converted to dedupeMod for deterministic startup */
const dedupeMod = require('./server/middleware/dedupe');
app.use(dedupeMod(60));
if (typeof dedupeMod.init === 'function') dedupeMod.init().catch(err => console.warn('[dedupe] init error', err && err.message));
 Usage: const dedupe = require('./server/middleware/dedupe'); app.use(dedupe(60));
 Reads REDIS_URL from env. Safe no-op if Redis not configured or fails to connect.
*/
const crypto = require('crypto');
let redisClient = null;
let redisReady = false;

function safeLog(...args){ try { console.warn('[dedupe]', ...args) } catch(e){} }

async function getRedisClient(){
  if(redisClient) return redisClient;
  const url = process.env.REDIS_URL || process.env.REDIS || null;
  if(!url){
    safeLog('No REDIS_URL configured — dedupe will be disabled.');
    return null;
  }
  try {
    const { createClient } = require('redis');
    redisClient = createClient({ url });
    redisClient.on('error', (err) => { safeLog('redis error', err && err.message ? err.message : err); redisReady = false; });
    await redisClient.connect();
    redisReady = true;
    safeLog('Connected to Redis for dedupe');
    return redisClient;
  } catch (e) {
    safeLog('Failed to connect to Redis:', e && e.message ? e.message : e);
    redisClient = null;
    redisReady = false;
    return null;
  }
}

module.exports = function dedupe(ttlSeconds = 60){
  // ttlSeconds: how long to consider duplicates (default 60s)
  // returns express middleware
  getRedisClient().catch(()=>{}); // attempt async connect early, don't block startup

  return async function (req, res, next){
    try {
      // only dedupe POST/PUT/PATCH (idempotent methods typically excluded)
      const method = (req.method || '').toUpperCase();
      if(!['POST','PUT','PATCH'].includes(method)) return next();

      // If Redis is not ready, allow requests through (fail-open)
      if(!redisReady || !redisClient){
        return next();
      }

      // create a request fingerprint: method + path + body hash + (optional) auth header short
      const bodyStr = (req.body && typeof req.body === 'object') ? JSON.stringify(req.body) : String(req.body || '');
      const authHint = (req.headers && req.headers.authorization) ? req.headers.authorization.slice(0,16) : '';
      const raw = ${method}|||;
      const hash = crypto.createHash('sha256').update(raw).digest('hex');
      const key = dedupe:;

      // try to set the key with NX and expiry; if set returns 'OK' then this is first request
      const setResult = await redisClient.set(key, Date.now().toString(), { NX: true, EX: Math.max(1, parseInt(ttlSeconds,10) || 60) });
      if(setResult === 'OK' || setResult === true){
        return next();
      } else {
        // duplicate detected
        res.status(429).json({ ok:false, error: "Duplicate request", code: "DUPLICATE_REQUEST" });
        return;
      }
    } catch (err){
      // on any internal error, fail-open (so we don't block traffic) but log
      safeLog('dedupe middleware error:', err && err.message ? err.message : err);
      return next();
    }
  };
};

