const AppError = require('../utils/AppError');

module.exports = (req, res, next) => {
  next(new AppError(`No route for ${req.method} ${req.originalUrl}`, 404));
};
