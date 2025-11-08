const express = require('express');
const { json } = require('express');
const webhook = require('./routes/webhook');
const admin = require('./routes/admin');
const { requestId } = require('./middleware/request-id');
const errors = require('./middleware/errors');
function createServer(cfg) {
  const app = express();
  app.use(json({ limit: '64kb' }));
  app.use(requestId);
  app.use('/webhook', webhook(cfg));
  app.use('/admin', admin(cfg));
  app.use(errors);
  return app;
}
module.exports = { createServer };
