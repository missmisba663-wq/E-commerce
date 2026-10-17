const request = require('supertest');
const app = require('../../src/app');
const db = require('../helpers/db');
const Product = require('../../src/models/Product');
const { createUser, createAdmin, createProduct, createOrder, bearer } = require('../helpers/factories');

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.close);

describe('Orders API (customer side)', () => {
  let alice;
  let bob;
  let product;

  beforeEach(async () => {
    alice = await createUser({ name: 'Alice' });
    bob = await createUser({ name: 'Bob' });
    product = await createProduct({ stock: 8 });
  });

  test('lists only my own orders, newest first', async () => {
    const first = await createOrder(alice, product);
    const second = await createOrder(alice, product);
    await createOrder(bob, product);

    const res = await request(app).get('/api/orders').set('Authorization', bearer(alice));

    expect(res.status).toBe(200);
    expect(res.body.orders.map((o) => o._id)).toEqual([String(second._id), String(first._id)]);
  });

  test("someone else's order looks like it doesn't exist", async () => {
    const bobsOrder = await createOrder(bob, product);
    const res = await request(app).get(`/api/orders/${bobsOrder._id}`).set('Authorization', bearer(alice));
    expect(res.status).toBe(404);
  });

  test('admins can view any order', async () => {
    const order = await createOrder(bob, product);
    const res = await request(app).get(`/api/orders/${order._id}`).set('Authorization', bearer(await createAdmin()));
    expect(res.status).toBe(200);
  });

  test('a garbage id is a 404, not a crash', async () => {
    const res = await request(app).get('/api/orders/not-an-id').set('Authorization', bearer(alice));
    expect(res.status).toBe(404);
  });

  test('cancelling a paid order puts the stock back', async () => {
    const order = await createOrder(alice, product, { quantity: 3 });

    const res = await request(app).post(`/api/orders/${order._id}/cancel`).set('Authorization', bearer(alice));

    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe('cancelled');
    expect(res.body.order.statusHistory.at(-1)).toMatchObject({ status: 'cancelled', note: 'Cancelled by customer' });
    expect((await Product.findById(product._id)).stock).toBe(11);
  });

  test('an order that has shipped cannot be cancelled', async () => {
    const order = await createOrder(alice, product, { status: 'shipped' });
    const res = await request(app).post(`/api/orders/${order._id}/cancel`).set('Authorization', bearer(alice));
    expect(res.status).toBe(409);
    expect((await Product.findById(product._id)).stock).toBe(8);
  });

  test("you can't cancel someone else's order", async () => {
    const order = await createOrder(bob, product);
    const res = await request(app).post(`/api/orders/${order._id}/cancel`).set('Authorization', bearer(alice));
    expect(res.status).toBe(404);
  });
});
