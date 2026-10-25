import assert from 'node:assert/strict';
import { test } from 'node:test';
import { address, admin, anon, customer, inStockProduct, sql } from './helpers.js';

const stockOf = (id) => sql('SELECT stock FROM products WHERE id = ?').get(id).stock;

test('guest cart preview prices items and warns about stock', async () => {
  const p = inStockProduct();
  const { body } = await anon().post('/api/cart/preview').send({ items: [{ productId: p.id, quantity: 2 }] }).expect(200);
  assert.equal(body.subtotalCents, p.price_cents * 2);
  assert.equal(body.taxCents, 0, 'prices are GST-inclusive');
  assert.equal(body.shippingCents, body.subtotalCents >= 49900 ? 0 : 4000);
  assert.equal(body.totalCents, body.subtotalCents + body.shippingCents + body.taxCents);
});

test('cart add, update, merge and remove', async () => {
  const shopper = await customer();
  const a = inStockProduct(10);
  const b = inStockProduct(10);
  let cart = (await shopper.post('/api/cart/items').send({ productId: a.id, quantity: 1 }).expect(200)).body;
  cart = (await shopper.post('/api/cart/items').send({ productId: a.id, quantity: 2 }).expect(200)).body;
  assert.equal(cart.items[0].quantity, 3);
  cart = (await shopper.put(`/api/cart/items/${a.id}`).send({ quantity: 1 }).expect(200)).body;
  assert.equal(cart.items[0].quantity, 1);
  cart = (await shopper.post('/api/cart/merge').send({ items: [{ productId: a.id, quantity: 4 }, { productId: b.id, quantity: 1 }] }).expect(200)).body;
  assert.equal(cart.items.length, 2);
  assert.equal(cart.items.find((i) => i.product.id === a.id).quantity, 4);
  cart = (await shopper.delete(`/api/cart/items/${a.id}`).expect(200)).body;
  assert.equal(cart.items.length, 1);
});

test('cash-on-delivery checkout reserves stock and clears the cart; cancelling restocks', async () => {
  const shopper = await customer();
  const p = inStockProduct(5);
  const before = stockOf(p.id);
  await shopper.post('/api/cart/items').send({ productId: p.id, quantity: 2 }).expect(200);

  const { body } = await shopper.post('/api/orders').send({ address, saveAddress: true, paymentMethod: 'cod' }).expect(201);
  assert.equal(body.order.status, 'processing');
  assert.equal(body.order.items[0].quantity, 2);
  assert.match(body.order.number, /^SV-\d{6}$/);
  assert.equal(stockOf(p.id), before - 2);
  assert.equal((await shopper.get('/api/cart')).body.items.length, 0);
  assert.equal((await shopper.get('/api/account/addresses')).body.addresses.length, 1);

  const list = (await shopper.get('/api/orders').expect(200)).body;
  assert.equal(list.orders[0].id, body.order.id);

  const cancelled = (await shopper.post(`/api/orders/${body.order.id}/cancel`).send({}).expect(200)).body.order;
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(stockOf(p.id), before);
  await shopper.post(`/api/orders/${body.order.id}/cancel`).send({}).expect(409);
});

test('checkout fails cleanly when stock runs out', async () => {
  const shopper = await customer();
  const p = inStockProduct(3);
  await shopper.post('/api/cart/items').send({ productId: p.id, quantity: 2 }).expect(200);
  sql('UPDATE products SET stock = 1 WHERE id = ?').run(p.id);
  const res = await shopper.post('/api/orders').send({ address, paymentMethod: 'cod' });
  assert.equal(res.status, 409);
  assert.equal(stockOf(p.id), 1, 'stock untouched after a failed checkout');
  assert.equal((await shopper.get('/api/cart')).body.items.length, 1, 'cart kept after a failed checkout');
});

test('card payment is refused when Stripe is not configured', async () => {
  const shopper = await customer();
  await shopper.post('/api/cart/items').send({ productId: inStockProduct().id, quantity: 1 }).expect(200);
  await shopper.post('/api/orders').send({ address, paymentMethod: 'card' }).expect(400);
});

test("customers can't see each other's orders", async () => {
  const alice = await customer();
  const bob = await customer();
  await alice.post('/api/cart/items').send({ productId: inStockProduct().id, quantity: 1 }).expect(200);
  const { body } = await alice.post('/api/orders').send({ address, paymentMethod: 'cod' }).expect(201);
  await bob.get(`/api/orders/${body.order.id}`).expect(404);
  await bob.post(`/api/orders/${body.order.id}/cancel`).send({}).expect(404);
});

test('admin fulfils an order, then the customer can leave a verified review', async () => {
  const shopper = await customer();
  const boss = await admin();
  const p = inStockProduct();
  await shopper.post('/api/cart/items').send({ productId: p.id, quantity: 1 }).expect(200);
  const { order } = (await shopper.post('/api/orders').send({ address, paymentMethod: 'cod' }).expect(201)).body;

  const review = { rating: 5, title: 'Great buy', body: 'Exactly as described, fast delivery.' };
  await shopper.put(`/api/catalog/products/${p.id}/reviews`).send(review).expect(403);

  await boss.patch(`/api/admin/orders/${order.id}`).send({ status: 'delivered' }).expect(409); // must ship first
  await boss.patch(`/api/admin/orders/${order.id}`).send({ status: 'shipped', trackingNumber: '1Z999' }).expect(200);
  await shopper.post(`/api/orders/${order.id}/cancel`).send({}).expect(409); // too late once shipped
  const delivered = (await boss.patch(`/api/admin/orders/${order.id}`).send({ status: 'delivered' }).expect(200)).body.order;
  assert.equal(delivered.paymentStatus, 'paid', 'COD is collected on delivery');
  assert.deepEqual(delivered.events.map((e) => e.status), ['placed', 'processing', 'shipped', 'delivered']);

  await shopper.put(`/api/catalog/products/${p.id}/reviews`).send(review).expect(204);
  const reviews = (await anon().get(`/api/catalog/products/${p.id}/reviews`).expect(200)).body;
  assert.equal(reviews.total, 1);
  assert.equal(reviews.reviews[0].verifiedPurchase, true);

  const stats = (await boss.get('/api/admin/stats').expect(200)).body;
  assert.ok(stats.orders >= 1);
  assert.equal(stats.series.length, 30);
});

test('admin can edit products and validates prices', async () => {
  const boss = await admin();
  const p = inStockProduct();
  const res = await boss.patch(`/api/admin/products/${p.id}`).send({ stock: 0 }).expect(200);
  assert.equal(res.body.product.inStock, false);
  await boss.patch(`/api/admin/products/${p.id}`).send({ priceCents: 1000, listPriceCents: 900 }).expect(400);
  await boss.patch(`/api/admin/products/${p.id}`).send({ isActive: false }).expect(200);
  await anon().get(`/api/catalog/products/${p.id}`).expect(404);
});
