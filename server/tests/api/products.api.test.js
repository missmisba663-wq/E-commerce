const request = require('supertest');
const app = require('../../src/app');
const db = require('../helpers/db');
const { createProduct } = require('../helpers/factories');

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.close);

describe('Product catalogue API', () => {
  beforeEach(async () => {
    await createProduct({ name: 'Monstera Deliciosa', price: 3200, category: 'plants' });
    await createProduct({ name: 'Snake Plant', price: 1850, category: 'plants', description: 'Hard to kill' });
    await createProduct({ name: 'Terracotta Pot', price: 650, category: 'pots' });
    await createProduct({ name: 'Brass Watering Can', price: 3400, category: 'tools' });
    await createProduct({ name: 'Discontinued Fern', price: 999, category: 'plants', isActive: false });
  });

  test('lists active products only', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(4);
    expect(res.body.products.map((p) => p.name)).not.toContain('Discontinued Fern');
  });

  test('filters by category', async () => {
    const res = await request(app).get('/api/products').query({ category: 'plants' });
    expect(res.body.products.map((p) => p.name).sort()).toEqual(['Monstera Deliciosa', 'Snake Plant']);
  });

  test('ignores a made-up category instead of erroring', async () => {
    const res = await request(app).get('/api/products').query({ category: 'sofas' });
    expect(res.body.total).toBe(4);
  });

  test('searches names and descriptions, case-insensitively', async () => {
    const byName = await request(app).get('/api/products').query({ search: 'monSTERA' });
    const byDescription = await request(app).get('/api/products').query({ search: 'hard to kill' });
    expect(byName.body.products.map((p) => p.name)).toEqual(['Monstera Deliciosa']);
    expect(byDescription.body.products.map((p) => p.name)).toEqual(['Snake Plant']);
  });

  test('treats regex characters in search as plain text', async () => {
    const res = await request(app).get('/api/products').query({ search: '.*' });
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
  });

  test('sorts by price and filters by price range', async () => {
    const sorted = await request(app).get('/api/products').query({ sort: 'price_asc' });
    expect(sorted.body.products.map((p) => p.price)).toEqual([650, 1850, 3200, 3400]);

    const ranged = await request(app).get('/api/products').query({ minPrice: 1000, maxPrice: 3300 });
    expect(ranged.body.products.map((p) => p.price).sort()).toEqual([1850, 3200]);
  });

  test('paginates', async () => {
    const res = await request(app).get('/api/products').query({ sort: 'price_asc', limit: 3, page: 2 });
    expect(res.body).toMatchObject({ page: 2, totalPages: 2, total: 4 });
    expect(res.body.products.map((p) => p.price)).toEqual([3400]);
  });

  test('fetches a product by slug or id', async () => {
    const bySlug = await request(app).get('/api/products/snake-plant');
    expect(bySlug.status).toBe(200);
    expect(bySlug.body.product.name).toBe('Snake Plant');

    const byId = await request(app).get(`/api/products/${bySlug.body.product._id}`);
    expect(byId.body.product.slug).toBe('snake-plant');
  });

  test('archived and unknown products are 404s', async () => {
    expect((await request(app).get('/api/products/discontinued-fern')).status).toBe(404);
    expect((await request(app).get('/api/products/no-such-thing')).status).toBe(404);
  });

  test('categories come back with counts, including empty ones', async () => {
    const res = await request(app).get('/api/products/categories');
    expect(res.body.categories).toEqual([
      { name: 'plants', count: 2 },
      { name: 'pots', count: 1 },
      { name: 'tools', count: 1 },
      { name: 'care', count: 0 },
    ]);
  });
});
