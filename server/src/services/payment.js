const crypto = require('crypto');
const AppError = require('../utils/AppError');

/*
 * A sandbox payment provider. It behaves like Stripe's test mode: it checks card details
 * properly, approves 4242 4242 4242 4242 and declines 4000 0000 0000 0002. To go live you
 * would swap the bodies of charge() and refund() for real provider calls. Nothing else
 * in the app needs to change.
 */

const DECLINED_CARDS = new Set(['4000000000000002']);

function passesLuhn(digits) {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let d = Number(digits[i]);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

function isExpired(month, year, now = new Date()) {
  // A card stays valid until the end of the month printed on it.
  const firstDayAfterExpiry = new Date(year, month, 1);
  return firstDayAfterExpiry <= now;
}

function validateCard(card, now = new Date()) {
  const { cardNumber, expiry, cvc } = card || {};
  const errors = [];

  const digits = String(cardNumber || '').replace(/[\s-]/g, '');
  if (!/^\d{12,19}$/.test(digits) || !passesLuhn(digits)) {
    errors.push({ field: 'payment.cardNumber', message: "That card number doesn't look right" });
  }

  const match = /^(\d{2})\s*\/\s*(\d{2})$/.exec(String(expiry || ''));
  const month = match ? Number(match[1]) : 0;
  if (!match || month < 1 || month > 12) {
    errors.push({ field: 'payment.expiry', message: 'Use the format MM/YY' });
  } else if (isExpired(month, 2000 + Number(match[2]), now)) {
    errors.push({ field: 'payment.expiry', message: 'This card has expired' });
  }

  if (!/^\d{3,4}$/.test(String(cvc || ''))) {
    errors.push({ field: 'payment.cvc', message: 'CVC should be 3 or 4 digits' });
  }

  if (errors.length) throw new AppError('Please check your card details', 400, errors);
  return { digits, last4: digits.slice(-4) };
}

async function charge({ amount, card }) {
  const { digits, last4 } = validateCard(card);
  if (DECLINED_CARDS.has(digits)) {
    throw new AppError('Your card was declined. No money was taken. Please try another card.', 402);
  }
  return { transactionId: `txn_${crypto.randomBytes(8).toString('hex')}`, last4, amount };
}

async function refund(transactionId) {
  return { refunded: true, transactionId };
}

module.exports = { passesLuhn, isExpired, validateCard, charge, refund };
