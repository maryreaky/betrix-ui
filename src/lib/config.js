module.exports.getConfig = function() {
  const required = ['BOT_TOKEN'];
  const cfg = { PORT: process.env.PORT || 3000, BOT_TOKEN: process.env.BOT_TOKEN || null, NODE_ENV: process.env.NODE_ENV || 'production' };
  const missing = required.filter(k => !cfg[k]);
  if (missing.length) { throw new Error('Missing env: ' + missing.join(',')); }
  return cfg;
};
