module.exports = (err, req, res, next) => {
  console.error('Unhandled error', err && err.stack ? err.stack : err);
  try { res.status(500).send('internal error'); } catch(e) {}
};
