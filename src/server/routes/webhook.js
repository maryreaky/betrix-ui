const express = require('express');
const router = express.Router();
const { handleTelegram } = require('../handlers/telegram');
module.exports = (cfg) => {
  router.post('/telegram', async (req, res) => {
    try {
      res.status(200).send('ok'); // ack quickly
      await handleTelegram(req.body, cfg);
    } catch (e) {
      // keep ack done; log error
      console.error('webhook top error', e && e.stack ? e.stack : e);
    }
  });
  return router;
};
