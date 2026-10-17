const request = require('supertest');
const app = require('../../src/app');
const db = require('../helpers/db');
const Product = require('../../src/models/Product');
const { createUser, createProduct, fillCart, bearer } = require('../helpers/factories');

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.close);

describe('Cart API', () => {
  let user;
  let auth;
  let fern;

  beforeEach(async () => {
    user = await createUser();
    auth = bearer(user);
    fern = await createProduct({ name: 'Boston Fern', price: 1500, stock: 5 });
  });

  test('requires sign-in', async () => {
    expect((await request(app).get('/api/cart')).status).toBe(401);
  });

  test('starts empty', async () => {
    const res = await request(app).get('/api/cart').set('Authorization', auth);
    expect(res.body.cart).toEqual({ items: [], itemCount: 0, subtotal: 0 });
  });

  test('adding the same product twice merges the quantities', async () => {
    await request(app).post('/api/cart/items').set('Authorization', auth).send({ productId: fern._id, quantity: 2 });
    const res = await request(app)
      .post('/api/cart/items')
      .set('Authorization', auth)
      .send({ productId: fern._id, quantity: 1 });

    expect(res.status).toBe(200);
    expect(res.body.cart.items).toHaveLength(1);
    expect(res.body.cart.items[0]).toMatchObject({ quantity: 3, lineTotal: 4500, inStock: true });
    expect(res.body.cart).toMatchObject({ itemCount: 3, subtotal: 4500 });
  });

  test('will not let you add more than is in stock', async () => {
    const res = await request(app)
      .post('/api/cart/items')
      .set('Authorization', auth)
      .send({ productId: fern._id, quantity: 6 });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('Only 5 of Boston Fern left in stock');
  });

  test('rejects bad input', async () => {
    const badId = await request(app).post('/api/cart/items').set('Authorization', auth).send({ productId: 'abc' });
    const badQty = await request(app)
      .post('/api/cart/items')
      .set('Authorization', auth)
      .send({ productId: fern._id, quantity: 1.5 });
    const missing = await request(app)
      .post('/api/cart/items')
      .set('Authorization', auth)
      .send({ productId: '65f1c2a9e4b0a1b2c3d4e5f6' });

    expect(badId.status).toBe(400);
    expect(badQty.status).toBe(400);
    expect(missing.status).toBe(404);
  });

  test('updates a quantity, and setting it to 0 removes the line', async () => {
    await fillCart(user, [[fern, 1]]);

    const updated = await request(app)
      .patch(`/api/cart/items/${fern._id}`)
      .set('Authorization', auth)
      .send({ quantity: 4 });
    expect(updated.body.cart.items[0].quantity).toBe(4);

    const removed = await request(app)
      .patch(`/api/cart/items/${fern._id}`)
      .set('Authorization', auth)
      .send({ quantity: 0 });
    expect(removed.body.cart.items).toEqual([]);
  });

  test('removes a line, and 404s when it is not there', async () => {
    await fillCart(user, [[fern, 1]]);

    const first = await request(app).delete(`/api/cart/items/${fern._id}`).set('Authorization', auth);
    const second = await request(app).delete(`/api/cart/items/${fern._id}`).set('Authorization', auth);

    expect(first.body.cart.items).toEqual([]);
    expect(second.status).toBe(404);
  });

  test('always shows current prices and flags lines that are now short on stock', async () => {
    await fillCart(user, [[fern, 3]]);
    await Product.updateOne({ _id: fern._id }, { price: 1200, stock: 2 });

    const res = await request(app).get('/api/cart').set('Authorization', auth);
    expect(res.body.cart.items[0]).toMatchObject({ lineTotal: 3600, inStock: false });
  });

  test('archived products drop out of the basket', async () => {
    const pot = await createProduct({ name: 'Old Pot' });
    await fillCart(user, [
      [fern, 1],
      [pot, 1],
    ]);
    await Product.updateOne({ _id: pot._id }, { isActive: false });

    const res = await request(app).get('/api/cart').set('Authorization', auth);
    expect(res.body.cart.items.map((i) => i.product.name)).toEqual(['Boston Fern']);
  });

  test('each user only sees their own basket', async () => {
    await fillCart(user, [[fern, 2]]);
    const someoneElse = await createUser();
    const res = await request(app).get('/api/cart').set('Authorization', bearer(someoneElse));
    expect(res.body.cart.items).toEqual([]);
  });

  test('clears the whole basket', async () => {
    await fillCart(user, [[fern, 2]]);
    const res = await request(app).delete('/api/cart').set('Authorization', auth);
    expect(res.body.cart.itemCount).toBe(0);
  });
});
