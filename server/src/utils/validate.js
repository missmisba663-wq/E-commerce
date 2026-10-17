const AppError = require('./AppError');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

const isNonEmptyString = (value, max = 200) =>
  typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;

const isEmail = (value) => typeof value === 'string' && EMAIL_RE.test(value.trim());

// mongoose.isValidObjectId() says yes to any 12-character string, which is too loose for us.
const isObjectId = (value) => OBJECT_ID_RE.test(String(value));

function toInt(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? fallback : n;
}

function assertValid(errors) {
  if (errors.length) throw new AppError('Some fields need attention', 400, errors);
}

function pick(source, keys) {
  const out = {};
  if (!source || typeof source !== 'object') return out;
  for (const key of keys) {
    if (source[key] !== undefined) out[key] = source[key];
  }
  return out;
}

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports = { isNonEmptyString, isEmail, isObjectId, toInt, assertValid, pick, escapeRegex };
