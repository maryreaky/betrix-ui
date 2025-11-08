const express = require('express');
const { json } = require('express');
const webhook = require('./routes/webhook');
const admin = require('./routes/admin');
const { requestId } = require('./middleware/request-id');
const errors = require('./middleware/errors');
function createServer(cfg) {
  const app = express();
  
// Defensive router loader: accept Router, factory(cfg), or factory()
function ensureRouter(factoryOrRouter, cfg){
  try {
    if (!factoryOrRouter) return (req,res,next)=> next(); // noop middleware to avoid crashes
    // If it's already a Router/function that behaves like middleware, return it directly
    if (typeof factoryOrRouter === 'function') {
      try {
        // try calling with cfg first (common pattern)
        const maybe = factoryOrRouter(cfg);
        if (maybe && (typeof maybe === 'function' || maybe.stack)) return maybe;
      } catch(e) {
        // ignore: calling with cfg failed, try no-arg
      }
      try {
        const maybe2 = factoryOrRouter();
        if (maybe2 && (typeof maybe2 === 'function' || maybe2.stack)) return maybe2;
      } catch(e) {
        // ignore and fallthrough
      }
      // If factoryOrRouter itself is middleware (req,res,next signature) use it
      return factoryOrRouter;
    }
    // fallback: not a function — return noop
    return (req,res,next)=> next();
  } catch(e){ return (req,res,next)=> next(); }
}
  app.use(json({ limit: '64kb' }));
  app.use(requestId);
  app.use('/webhook', ensureRouter(webhook, cfg));
  app.use('/admin', ensureRouter(admin, cfg));
  app.use(errors);
  return app;
}
module.exports = { createServer };


