const db = require('../helpers/db');
const User = require('../../src/models/User');
const Product = require('../../src/models/Product');
const { createUser, createProduct, createOrder } = require('../helpers/factories');

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.close);

describe('User model', () => {
  test('hashes the password and never sends it back in JSON', async () => {
    const user = await createUser({ password: 'correct horse' });
    const stored = await User.findById(user._id).select('+password');

    expect(stored.password).not.toBe('correct horse');
    expect(await stored.comparePassword('correct horse')).toBe(true);
    expect(await stored.comparePassword('wrong horse')).toBe(false);
    expect(JSON.parse(JSON.stringify(stored))).not.toHaveProperty('password');
  });

  test('does not re-hash the password when other fields change', async () => {
    const user = await createUser({ password: 'password123' });
    const stored = await User.findById(user._id).select('+password');
    stored.name = 'New Name';
    await stored.save();
    expect(await stored.comparePassword('password123')).toBe(true);
  });

  test('email addresses are unique regardless of case', async () => {
    await createUser({ email: 'jo@example.com' });
    await expect(createUser({ email: 'JO@example.com' })).rejects.toMatchObject({ code: 11000 });
  });
});

describe('Product model', () => {
  test('builds a slug from the name', async () => {
    const product = await createProduct({ name: 'Bird of Paradise' });
    expect(product.slug).toBe('bird-of-paradise');
  });

  test('rejects fractional prices, since money is stored in pence', async () => {
    await expect(createProduct({ price: 12.99 })).rejects.toMatchObject({ name: 'ValidationError' });
  });

  test('rejects unknown categories and negative stock', async () => {
    const err = await Product.create({ name: 'Mystery', price: 100, category: 'furniture', stock: -1 }).catch((e) => e);
    expect(Object.keys(err.errors).sort()).toEqual(['category', 'stock']);
  });
});

describe('Order model', () => {
  test('gets an order number and a first history entry automatically', async () => {
    const order = await createOrder(await createUser(), await createProduct());
    expect(order.orderNumber).toMatch(/^FL-\d{8}-[A-F0-9]{6}$/);
    expect(order.status).toBe('paid');
    expect(order.statusHistory).toEqual([expect.objectContaining({ status: 'paid', note: 'Payment received' })]);
  });
});
