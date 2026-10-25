import assert from 'node:assert/strict';
import { test } from 'node:test';
import { anon, sql } from './helpers.js';
import { ftsQuery } from '../src/lib/products.js';
import { toInrPaise } from '../src/db/seed.js';

test('departments list categories with product counts', async () => {
  const { body } = await anon().get('/api/catalog/departments').expect(200);
  assert.ok(body.departments.length >= 15);
  const fashion = body.departments.find((d) => d.slug === 'fashion');
  assert.ok(fashion.productCount > 0);
  assert.ok(fashion.categories.every((c) => c.productCount > 0));
});

test('listing paginates and every product has a real image URL', async () => {
  const { body } = await anon().get('/api/catalog/products?limit=12&page=2').expect(200);
  assert.equal(body.items.length, 12);
  assert.equal(body.page, 2);
  assert.ok(body.total > 1000);
  for (const p of body.items) assert.match(p.image, /^https:\/\/m\.media-amazon\.com\/images\/I\/.+\.jpg$/);
});

test('search matches titles and categories', async () => {
  const { body } = await anon().get('/api/catalog/products?q=shoes').expect(200);
  assert.ok(body.total > 0);
  assert.ok(body.facets.categories.length > 0);
});

test('filters by department, price and rating', async () => {
  const { body } = await anon().get('/api/catalog/products?department=electronics&maxPrice=2000&minRating=4&sort=price_desc').expect(200);
  assert.ok(body.items.length > 0);
  for (const p of body.items) {
    assert.equal(p.department.slug, 'electronics');
    assert.ok(p.priceCents <= 200000);
    assert.ok(p.stars >= 4);
  }
  const prices = body.items.map((p) => p.priceCents);
  assert.deepEqual(prices, [...prices].sort((a, b) => b - a));
});

test('sale filter only returns discounted products', async () => {
  const { body } = await anon().get('/api/catalog/products?sale=1').expect(200);
  for (const p of body.items) assert.ok(p.discountPercent > 0);
});

test('prices are converted to rupees and end in 9', () => {
  assert.equal(toInrPaise(1299), 109900); // $12.99 -> ₹1,099
  assert.equal(toInrPaise(199), 16900); // $1.99 -> ₹169
  assert.equal(toInrPaise(50), 3900); // $0.50 -> ₹42.50 -> ₹39
  assert.equal(toInrPaise(0), 0);
  const { n } = sql('SELECT COUNT(*) AS n FROM products WHERE price_cents % 1000 != 900').get();
  assert.equal(n, 0);
});

test('invalid query parameters are rejected', async () => {
  await anon().get('/api/catalog/products?sort=bogus').expect(400);
  await anon().get('/api/catalog/products?limit=1000').expect(400);
});

test('search input is sanitised for FTS syntax', async () => {
  assert.equal(ftsQuery('  "wireless" OR (headphones*  '), '"wireless" "or" "headphones"*');
  assert.equal(ftsQuery('!!!'), null);
  await anon().get(`/api/catalog/products?q=${encodeURIComponent('NEAR(" * ^')}`).expect(200);
});

test('product detail includes related products; unknown ids 404', async () => {
  const { id } = sql('SELECT id FROM products ORDER BY popularity DESC LIMIT 1').get();
  const { body } = await anon().get(`/api/catalog/products/${id}`).expect(200);
  assert.equal(body.product.id, id);
  assert.ok(body.product.imageLarge.includes('_AC_SL1000_'));
  assert.ok(Array.isArray(body.related));
  await anon().get('/api/catalog/products/999999999').expect(404);
});

test('suggestions and home sections respond', async () => {
  const s = await anon().get('/api/catalog/products/suggest?q=lap').expect(200);
  assert.ok(Array.isArray(s.body.products));
  const home = await anon().get('/api/catalog/home').expect(200);
  assert.ok(home.body.departments.length > 0);
});
