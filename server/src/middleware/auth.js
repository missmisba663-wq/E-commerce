const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { verifyToken } = require('../utils/token');

const protect = asyncHandler(async (req, res, next) => {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) throw new AppError('Please sign in to continue', 401);

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw new AppError('Your session has expired. Please sign in again.', 401);
  }

  const user = await User.findById(payload.sub);
  if (!user) throw new AppError('We could not find your account', 401);

  req.user = user;
  next();
});

function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return next(new AppError('You need admin access to do that', 403));
  }
  return next();
}

module.exports = { protect, adminOnly };
