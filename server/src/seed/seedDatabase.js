const User = require('../models/User');
const Product = require('../models/Product');
const Cart = require('../models/Cart');
const Order = require('../models/Order');
const products = require('./products');

const DEMO_USERS = [
  { name: 'Fernleaf Admin', email: 'admin@fernleaf.test', password: 'Admin123!', role: 'admin' },
  { name: 'Sam Okafor', email: 'sam@example.com', password: 'Customer123!' },
];

async function seedDatabase() {
  await Promise.all([User.deleteMany({}), Product.deleteMany({}), Cart.deleteMany({}), Order.deleteMany({})]);
  // .create() rather than insertMany() so the password-hashing hook runs.
  await User.create(DEMO_USERS);
  await Product.create(products);
  return { products: products.length, users: DEMO_USERS.length };
}

function printDemoLogins() {
  console.log('  admin:    admin@fernleaf.test / Admin123!');
  console.log('  customer: sam@example.com / Customer123!');
}

module.exports = { seedDatabase, printDemoLogins };
