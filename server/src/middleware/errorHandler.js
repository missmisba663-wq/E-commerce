const AppError = require('../utils/AppError');

// Every error response has the same shape: { error: { message, details? } }
// eslint-disable-next-line no-unused-vars
module.exports = (err, req, res, next) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: { message: err.message, details: err.details } });
  }

  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    return res.status(400).json({ error: { message: 'Some fields need attention', details } });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({ error: { message: `Invalid value for ${err.path}` } });
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'value';
    return res.status(409).json({ error: { message: `Something with that ${field} already exists` } });
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { message: 'The request body is not valid JSON' } });
  }

  console.error(err);
  return res.status(500).json({ error: { message: 'Something went wrong on our side. Please try again.' } });
};
