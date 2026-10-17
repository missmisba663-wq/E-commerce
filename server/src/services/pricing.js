const AppError = require('../utils/AppError');

// Every amount here is in pence.
const STANDARD_SHIPPING = 495;
const FREE_SHIPPING_FROM = 5000;
const VAT_RATE = 0.2; // UK prices include VAT, so we show it rather than add it on top.

const DISCOUNT_CODES = {
  WELCOME10: { type: 'percent', value: 10, description: '10% off your order' },
  FREESHIP: { type: 'free_shipping', description: 'Free standard delivery' },
  GREEN5: { type: 'fixed', value: 500, minSubtotal: 3000, description: '£5 off when you spend £30' },
};

const formatPence = (pence) => `£${(pence / 100).toFixed(2)}`;

const calculateSubtotal = (items) => items.reduce((sum, item) => sum + item.price * item.quantity, 0);

function resolveDiscount(rawCode, subtotal) {
  if (rawCode === undefined || rawCode === null || String(rawCode).trim() === '') {
    return { code: null, amount: 0, freeShipping: false };
  }

  const code = String(rawCode).trim().toUpperCase();
  const rule = DISCOUNT_CODES[code];
  if (!rule) throw new AppError("That discount code isn't valid", 400);

  if (rule.minSubtotal && subtotal < rule.minSubtotal) {
    throw new AppError(`${code} only works on baskets of ${formatPence(rule.minSubtotal)} or more`, 400);
  }

  switch (rule.type) {
    case 'percent':
      return { code, amount: Math.round((subtotal * rule.value) / 100), freeShipping: false };
    case 'fixed':
      return { code, amount: Math.min(rule.value, subtotal), freeShipping: false };
    case 'free_shipping':
      return { code, amount: 0, freeShipping: true };
    default:
      throw new AppError("That discount code isn't valid", 400);
  }
}

// The free-delivery threshold looks at what the customer actually pays, after any discount.
function calculateShipping(amount, freeShipping = false) {
  if (amount <= 0 || freeShipping || amount >= FREE_SHIPPING_FROM) return 0;
  return STANDARD_SHIPPING;
}

const vatIncludedIn = (total) => Math.round((total * VAT_RATE) / (1 + VAT_RATE));

function calculateTotals(items, discountCode) {
  const subtotal = calculateSubtotal(items);
  const discount = resolveDiscount(discountCode, subtotal);
  const afterDiscount = subtotal - discount.amount;
  const shipping = calculateShipping(afterDiscount, discount.freeShipping);
  const total = afterDiscount + shipping;

  return {
    subtotal,
    discount: discount.amount,
    discountCode: discount.code,
    shipping,
    vat: vatIncludedIn(total),
    total,
  };
}

module.exports = {
  STANDARD_SHIPPING,
  FREE_SHIPPING_FROM,
  VAT_RATE,
  DISCOUNT_CODES,
  formatPence,
  calculateSubtotal,
  resolveDiscount,
  calculateShipping,
  vatIncludedIn,
  calculateTotals,
};
