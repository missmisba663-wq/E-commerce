const User = require('../../src/models/User');
const Product = require('../../src/models/Product');
const Cart = require('../../src/models/Cart');
const Order = require('../../src/models/Order');
const { signToken } = require('../../src/utils/token');

let seq = 0;
const next = () => {
  seq += 1;
  return seq;
};

function createUser(overrides = {}) {
  const n = next();
  return User.create({ name: `Shopper ${n}`, email: `shopper${n}@example.com`, password: 'password123', ...overrides });
}

const createAdmin = (overrides = {}) => createUser({ role: 'admin', ...overrides });

function createProduct(overrides = {}) {
  const n = next();
  return Product.create({
    name: `Test Fern ${n}`,
    description: 'A very patient fern.',
    price: 1500,
    category: 'plants',
    stock: 10,
    ...overrides,
  });
}

function fillCart(user, lines) {
  return Cart.create({ user: user._id, items: lines.map(([product, quantity]) => ({ product: product._id, quantity })) });
}

function createOrder(user, product, overrides = {}) {
  const quantity = overrides.quantity || 1;
  const total = product.price * quantity;
  return Order.create({
    user: user._id,
    items: [{ product: product._id, name: product.name, price: product.price, quantity }],
    shippingAddress: ADDRESS,
    totals: { subtotal: total, discount: 0, shipping: 0, vat: 0, total },
    payment: { method: 'card', last4: '4242', transactionId: 'txn_test' },
    status: overrides.status || 'paid',
  });
}

const bearer = (user) => `Bearer ${signToken(user)}`;

const ADDRESS = {
  fullName: 'Priya Shah',
  line1: '14 Elm Row',
  city: 'Leeds',
  postcode: 'LS6 2AB',
  country: 'United Kingdom',
};

const VALID_CARD = { cardNumber: '4242 4242 4242 4242', expiry: '12/39', cvc: '123' };
const DECLINED_CARD = { cardNumber: '4000 0000 0000 0002', expiry: '12/39', cvc: '123' };

module.exports = {
  createUser,
  createAdmin,
  createProduct,
  fillCart,
  createOrder,
  bearer,
  ADDRESS,
  VALID_CARD,
  DECLINED_CARD,
};
