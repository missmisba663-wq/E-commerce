const Cart = require('../models/Cart');
const Order = require('../models/Order');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { assertValid } = require('../utils/validate');
const { calculateTotals } = require('../services/pricing');
const { reserveStock, releaseStock } = require('../services/inventory');
const payments = require('../services/payment');

const ADDRESS_FIELDS = { fullName: 80, line1: 120, line2: 120, city: 60, postcode: 12, country: 60 };
const REQUIRED_ADDRESS_FIELDS = ['fullName', 'line1', 'city', 'postcode'];

function parseAddress(input) {
  const source = input && typeof input === 'object' ? input : {};
  const address = {};
  const errors = [];

  for (const [field, max] of Object.entries(ADDRESS_FIELDS)) {
    const value = typeof source[field] === 'string' ? source[field].trim() : '';
    if (REQUIRED_ADDRESS_FIELDS.includes(field) && !value) {
      errors.push({ field: `shippingAddress.${field}`, message: 'This field is required' });
    } else if (value.length > max) {
      errors.push({ field: `shippingAddress.${field}`, message: `Keep this under ${max} characters` });
    }
    address[field] = value;
  }

  assertValid(errors);
  if (!address.country) address.country = 'United Kingdom';
  return address;
}

// Reads the basket fresh from the database. We never trust prices sent by the browser.
async function loadCheckoutItems(userId) {
  const cart = await Cart.findOne({ user: userId }).populate('items.product');
  const lines = (cart ? cart.items : []).filter((i) => i.product && i.product.isActive);
  if (lines.length === 0) throw new AppError('Your basket is empty', 400);

  return lines.map(({ product, quantity }) => ({
    product: product._id,
    name: product.name,
    price: product.price,
    quantity,
  }));
}

const quote = asyncHandler(async (req, res) => {
  const items = await loadCheckoutItems(req.user._id);
  const totals = calculateTotals(items, req.body && req.body.discountCode);
  res.json({ totals, items });
});

const placeOrder = asyncHandler(async (req, res) => {
  const { shippingAddress, discountCode, payment: card } = req.body || {};

  const address = parseAddress(shippingAddress);
  const items = await loadCheckoutItems(req.user._id);
  const totals = calculateTotals(items, discountCode);
  payments.validateCard(card); // check the card before we touch any stock

  await reserveStock(items);

  let charge;
  try {
    charge = await payments.charge({ amount: totals.total, card });
  } catch (err) {
    await releaseStock(items);
    throw err;
  }

  let order;
  try {
    order = await Order.create({
      user: req.user._id,
      items,
      shippingAddress: address,
      totals: {
        subtotal: totals.subtotal,
        discount: totals.discount,
        shipping: totals.shipping,
        vat: totals.vat,
        total: totals.total,
      },
      discountCode: totals.discountCode,
      payment: { method: 'card', last4: charge.last4, transactionId: charge.transactionId },
    });
  } catch (err) {
    // The money went through but we couldn't record the order. Undo both before reporting the error.
    await releaseStock(items);
    await payments.refund(charge.transactionId);
    throw err;
  }

  await Cart.updateOne({ user: req.user._id }, { $set: { items: [] } });
  res.status(201).json({ order });
});

module.exports = { quote, placeOrder, parseAddress };
