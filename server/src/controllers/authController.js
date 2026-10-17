const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { signToken } = require('../utils/token');
const { isNonEmptyString, isEmail, assertValid } = require('../utils/validate');

const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body || {};

  const errors = [];
  if (!isNonEmptyString(name, 80)) errors.push({ field: 'name', message: 'Please tell us your name' });
  if (!isEmail(email)) errors.push({ field: 'email', message: 'Enter a valid email address' });
  if (typeof password !== 'string' || password.length < 8) {
    errors.push({ field: 'password', message: 'Password must be at least 8 characters' });
  }
  assertValid(errors);

  const normalisedEmail = email.trim().toLowerCase();
  if (await User.exists({ email: normalisedEmail })) {
    throw new AppError('An account with that email already exists', 409);
  }

  // Role is never taken from the request. Admins are promoted in the database, not self-appointed.
  const user = await User.create({ name: name.trim(), email: normalisedEmail, password });
  res.status(201).json({ token: signToken(user), user });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string') {
    throw new AppError('Email and password are required', 400);
  }

  const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    throw new AppError('Email or password is incorrect', 401);
  }

  res.json({ token: signToken(user), user });
});

const me = (req, res) => res.json({ user: req.user });

module.exports = { register, login, me };
