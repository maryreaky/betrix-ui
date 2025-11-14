const express = require('express');
const app = express();
app.use(express.json({ limit: '200kb' }));
try {
  const routes = require('./server/routes');
  if (typeof routes === 'function') routes(app);
} catch (e) {}
app.get('/health', (_req, res) => res.status(200).send('OK'));
const port = process.env.PORT ? Number(process.env.PORT) : 10000;
if (require.main === module) {
  app.listen(port, () => console.log(`SERVER: listening on port ${port}`));
} else {
  module.exports = { app, listen: (p = port) => app.listen(p, () => console.log(`SERVER: listening on port ${p}`)) };
}
