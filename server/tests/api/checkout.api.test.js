const request = require('supertest');
const app = require('../../src/app');
const db = require('../helpers/db');
const Product = require('../../src/models/Product');
const Cart = require('../../src/models/Cart');
const Order = require('../../src/models/Order');
const { STANDARD_SHIPPING } = require('../../src/services/pricing');
const {
  createUser,
  createProduct,
  fillCart,
  bearer,
  ADDRESS,
  VALID_CARD,
  DECLINED_CARD,
} = require('../helpers/factories');

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.close);

describe('Checkout API', () => {
  let user;
  let auth;
  let fern;
  let pot;

  beforeEach(async () => {
    user = await createUser();
    auth = bearer(user);
    fern = await createProduct({ name: 'Boston Fern', price: 1500, stock: 5 });
    pot = await createProduct({ name: 'Clay Pot', price: 650, category: 'pots', stock: 10 });
    await fillCart(user, [
      [fern, 2],
      [pot, 1],
    ]);
  });

  const placeOrder = (body = {}) =>
    request(app)
      .post('/api/checkout')
      .set('Authorization', auth)
      .send({ shippingAddress: ADDRESS, payment: VALID_CARD, ...body });

  describe('POST /api/checkout/quote', () => {
    test('prices the basket with delivery', async () => {
      const res = await request(app).post('/api/checkout/quote').set('Authorization', auth).send({});
      expect(res.status).toBe(200);
      expect(res.body.totals).toMatchObject({
        subtotal: 3650,
        discount: 0,
        shipping: STANDARD_SHIPPING,
        total: 3650 + STANDARD_SHIPPING,
      });
    });

    test('applies a valid discount code', async () => {
      const res = await request(app)
        .post('/api/checkout/quote')
        .set('Authorization', auth)
        .send({ discountCode: 'green5' });
      expect(res.body.totals).toMatchObject({ discount: 500, discountCode: 'GREEN5' });
    });

    test('rejects an unknown code', async () => {
      const res = await request(app)
        .post('/api/checkout/quote')
        .set('Authorization', auth)
        .send({ discountCode: 'FREEPLANTS' });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/checkout', () => {
    test('places the order, takes stock, empties the basket', async () => {
      const res = await placeOrder({ discountCode: 'FREESHIP' });

      expect(res.status).toBe(201);
      const { order } = res.body;
      expect(order).toMatchObject({
        status: 'paid',
        discountCode: 'FREESHIP',
        totals: { subtotal: 3650, discount: 0, shipping: 0, total: 3650 },
        payment: { method: 'card', last4: '4242' },
        shippingAddress: { fullName: 'Priya Shah', postcode: 'LS6 2AB' },
      });
      expect(order.items).toEqual([
        expect.objectContaining({ name: 'Boston Fern', price: 1500, quantity: 2 }),
        expect.objectContaining({ name: 'Clay Pot', price: 650, quantity: 1 }),
      ]);
      expect(order.orderNumber).toMatch(/^FL-/);

      expect((await Product.findById(fern._id)).stock).toBe(3);
      expect((await Product.findById(pot._id)).stock).toBe(9);
      expect((await Cart.findOne({ user: user._id })).items).toHaveLength(0);
    });

    test('locks in the price at the moment of purchase', async () => {
      const res = await placeOrder();
      await Product.updateOne({ _id: fern._id }, { price: 9999 });

      const saved = await Order.findById(res.body.order._id);
      expect(saved.items[0].price).toBe(1500);
    });

    test('a declined card leaves stock, basket and orders untouched', async () => {
      const res = await placeOrder({ payment: DECLINED_CARD });

      expect(res.status).toBe(402);
      expect(res.body.error.message).toMatch(/declined/);
      expect((await Product.findById(fern._id)).stock).toBe(5);
      expect((await Cart.findOne({ user: user._id })).items).toHaveLength(2);
      expect(await Order.countDocuments()).toBe(0);
    });

    test('fails cleanly if stock ran out since the item went in the basket', async () => {
      await Product.updateOne({ _id: pot._id }, { stock: 0 });

      const res = await placeOrder();

      expect(res.status).toBe(409);
      expect(res.body.error.message).toMatch(/Clay Pot/);
      expect((await Product.findById(fern._id)).stock).toBe(5); // fern was reserved first, then put back
      expect(await Order.countDocuments()).toBe(0);
    });

    test('validates the address and card before doing anything', async () => {
      const badAddress = await placeOrder({ shippingAddress: { fullName: 'Priya' } });
      const badCard = await placeOrder({ payment: { cardNumber: '1111', expiry: '1/2', cvc: '' } });

      expect(badAddress.status).toBe(400);
      expect(badAddress.body.error.details.map((d) => d.field)).toEqual(
        expect.arrayContaining(['shippingAddress.line1', 'shippingAddress.city', 'shippingAddress.postcode'])
      );
      expect(badCard.status).toBe(400);
      expect((await Product.findById(fern._id)).stock).toBe(5);
    });

    test('an empty basket cannot be checked out', async () => {
      await Cart.updateOne({ user: user._id }, { items: [] });
      const res = await placeOrder();
      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe('Your basket is empty');
    });

    test('requires sign-in', async () => {
      const res = await request(app).post('/api/checkout').send({});
      expect(res.status).toBe(401);
    });
  });
});
