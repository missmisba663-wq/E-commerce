const request = require('supertest');
const app = require('../../src/app');
const db = require('../helpers/db');
const Product = require('../../src/models/Product');
const { createUser, createAdmin, createProduct, createOrder, bearer } = require('../helpers/factories');

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.close);

describe('Admin API', () => {
  let adminAuth;
  let customer;

  beforeEach(async () => {
    adminAuth = bearer(await createAdmin());
    customer = await createUser();
  });

  test('customers are turned away with a 403', async () => {
    const res = await request(app).get('/api/admin/stats').set('Authorization', bearer(customer));
    expect(res.status).toBe(403);
  });

  describe('products', () => {
    test('creates a product and generates its slug', async () => {
      const res = await request(app)
        .post('/api/admin/products')
        .set('Authorization', adminAuth)
        .send({ name: 'Bird of Paradise', price: 5500, category: 'plants', stock: 4 });

      expect(res.status).toBe(201);
      expect(res.body.product).toMatchObject({ slug: 'bird-of-paradise', isActive: true });
    });

    test('returns field-level errors for bad data', async () => {
      const res = await request(app)
        .post('/api/admin/products')
        .set('Authorization', adminAuth)
        .send({ name: '', price: -5, category: 'furniture' });

      expect(res.status).toBe(400);
      expect(res.body.error.details.map((d) => d.field).sort()).toEqual(['category', 'name', 'price']);
    });

    test('refuses a duplicate slug', async () => {
      await createProduct({ name: 'Peace Lily' });
      const res = await request(app)
        .post('/api/admin/products')
        .set('Authorization', adminAuth)
        .send({ name: 'Peace Lily', price: 1500, category: 'plants' });
      expect(res.status).toBe(409);
    });

    test('updates price and stock but keeps the slug when renamed', async () => {
      const product = await createProduct({ name: 'Rubber Plant' });
      const res = await request(app)
        .put(`/api/admin/products/${product._id}`)
        .set('Authorization', adminAuth)
        .send({ name: 'Rubber Plant Burgundy', price: 2200, stock: 12 });

      expect(res.status).toBe(200);
      expect(res.body.product).toMatchObject({ name: 'Rubber Plant Burgundy', slug: 'rubber-plant', price: 2200, stock: 12 });
    });

    test('archiving hides a product from the shop but keeps it for admins', async () => {
      const product = await createProduct({ name: 'Old Stock' });

      const res = await request(app).delete(`/api/admin/products/${product._id}`).set('Authorization', adminAuth);
      expect(res.body.product.isActive).toBe(false);

      expect((await request(app).get('/api/products/old-stock')).status).toBe(404);
      const adminList = await request(app).get('/api/admin/products').set('Authorization', adminAuth);
      expect(adminList.body.products.map((p) => p.name)).toContain('Old Stock');
    });

    test('404s on an unknown product', async () => {
      const res = await request(app)
        .put('/api/admin/products/65f1c2a9e4b0a1b2c3d4e5f6')
        .set('Authorization', adminAuth)
        .send({ price: 100 });
      expect(res.status).toBe(404);
    });
  });

  describe('orders', () => {
    let product;

    beforeEach(async () => {
      product = await createProduct({ price: 2000, stock: 10 });
    });

    const setStatus = (order, status, note) =>
      request(app).patch(`/api/admin/orders/${order._id}/status`).set('Authorization', adminAuth).send({ status, note });

    test('lists all orders with the customer attached, filterable by status', async () => {
      await createOrder(customer, product);
      await createOrder(customer, product, { status: 'shipped' });

      const all = await request(app).get('/api/admin/orders').set('Authorization', adminAuth);
      const shipped = await request(app).get('/api/admin/orders').query({ status: 'shipped' }).set('Authorization', adminAuth);

      expect(all.body.total).toBe(2);
      expect(all.body.orders[0].user).toMatchObject({ email: customer.email });
      expect(shipped.body.orders.map((o) => o.status)).toEqual(['shipped']);
    });

    test('moves an order through fulfilment and records the history', async () => {
      const order = await createOrder(customer, product);

      await setStatus(order, 'packed', 'Packed by Jo');
      const res = await setStatus(order, 'shipped', 'Royal Mail tracking RM123');

      expect(res.status).toBe(200);
      expect(res.body.order.status).toBe('shipped');
      expect(res.body.order.statusHistory.map((h) => h.status)).toEqual(['paid', 'packed', 'shipped']);
    });

    test('blocks skipping steps', async () => {
      const order = await createOrder(customer, product);
      const res = await setStatus(order, 'delivered');
      expect(res.status).toBe(409);
    });

    test('cancelling from the admin side restocks', async () => {
      const order = await createOrder(customer, product, { quantity: 2 });
      await setStatus(order, 'cancelled', 'Customer phoned in');
      expect((await Product.findById(product._id)).stock).toBe(12);
    });
  });

  test('stats add up revenue (ignoring cancelled orders) and flag low stock', async () => {
    const product = await createProduct({ price: 2000, stock: 10 });
    await createProduct({ name: 'Nearly Gone', stock: 2 });
    await createOrder(customer, product);
    await createOrder(customer, product, { quantity: 2 });
    await createOrder(customer, product, { status: 'cancelled' });

    const res = await request(app).get('/api/admin/stats').set('Authorization', adminAuth);

    expect(res.status).toBe(200);
    expect(res.body.stats).toMatchObject({
      revenue: 6000,
      orderCount: 3,
      productCount: 2,
      customerCount: 1,
      ordersByStatus: { paid: 2, packed: 0, shipped: 0, delivered: 0, cancelled: 1 },
    });
    expect(res.body.stats.lowStock.map((p) => p.name)).toEqual(['Nearly Gone']);
    expect(res.body.stats.recentOrders).toHaveLength(3);
  });
});
