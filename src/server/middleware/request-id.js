module.exports.requestId = (req, res, next) => { req.id = require('uuid').v4(); res.setHeader('x-request-id', req.id); next(); };
