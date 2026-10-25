import express, { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { sql } from '../db/index.js';
import { HttpError, notFound, validate } from '../lib/http.js';
import {
  cancelOrder, createCheckoutSession, createOrderFromCart, getOrder, markPaid, orderSummary, stripe, syncPayment,
} from '../lib/orders.js';
import { imageUrls } from '../lib/products.js';
import { requireAuth } from '../middleware/auth.js';
import { addressSchema, saveAddress, toAddress } from './account.js';

export const ordersRouter = Router();
ordersRouter.use(requireAuth);

const checkoutSchema = z
  .object({
    addressId: z.number().int().positive().optional(),
    address: addressSchema.optional(),
    saveAddress: z.boolean().default(false),
    paymentMethod: z.enum(['card', 'cod']),
  })
  .refine((v) => v.addressId || v.address, { message: 'Please choose a delivery address' });

ordersRouter.post('/', validate(checkoutSchema), async (req, res) => {
  const { addressId, saveAddress: save, paymentMethod } = req.valid.body;
  if (paymentMethod === 'card' && !stripe) throw new HttpError(400, 'Card payments are not available right now');

  let address = req.valid.body.address;
  if (addressId) {
    const row = sql('SELECT * FROM addresses WHERE id = ? AND user_id = ?').get(addressId, req.user.id);
    if (!row) throw notFound('Address');
    address = toAddress(row);
  } else if (save) {
    saveAddress(req.user.id, address);
  }

  const orderId = createOrderFromCart(req.user.id, address, paymentMethod);
  let checkoutUrl = null;
  if (paymentMethod === 'card') {
    try {
      checkoutUrl = await createCheckoutSession(orderId);
    } catch (err) {
      await cancelOrder(orderId, { by: 'system', reason: 'Payment could not be started.' });
      throw err.status ? err : new HttpError(502, 'Could not reach the payment provider. Please try again.');
    }
  }
  res.status(201).json({ order: getOrder(orderId), checkoutUrl });
});

ordersRouter.get('/', validate(z.object({ page: z.coerce.number().int().min(1).default(1) }), 'query'), (req, res) => {
  const limit = 10;
  const { page } = req.valid.query;
  const { total } = sql('SELECT COUNT(*) AS total FROM orders WHERE user_id = ?').get(req.user.id);
  const orders = sql('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?')
    .all(req.user.id, limit, (page - 1) * limit)
    .map((o) => {
      const items = sql('SELECT title, image, quantity FROM order_items WHERE order_id = ? LIMIT 4').all(o.id);
      const { n } = sql('SELECT COUNT(*) AS n FROM order_items WHERE order_id = ?').get(o.id);
      return { ...orderSummary(o), itemCount: n, previewItems: items.map((i) => ({ title: i.title, image: imageUrls(i.image).image })) };
    });
  res.json({ orders, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
});

function ownOrder(req) {
  const order = getOrder(Number(req.params.id));
  if (!order || (order.userId !== req.user.id && req.user.role !== 'admin')) throw notFound('Order');
  return order;
}

ordersRouter.get('/:id', async (req, res) => {
  let order = ownOrder(req);
  // Covers the redirect back from Stripe even if the webhook hasn't arrived yet.
  if (order.status === 'pending_payment') {
    await syncPayment(order.id).catch((err) => console.error('Stripe sync failed:', err.message));
    order = getOrder(order.id);
  }
  res.json({ order });
});

ordersRouter.post('/:id/pay', async (req, res) => {
  const order = ownOrder(req);
  if (order.status !== 'pending_payment') throw new HttpError(409, 'This order does not need payment');
  res.json({ checkoutUrl: await createCheckoutSession(order.id) });
});

ordersRouter.post('/:id/cancel', validate(z.object({ reason: z.string().trim().max(300).default('') })), async (req, res) => {
  const order = ownOrder(req);
  await cancelOrder(order.id, { by: 'customer', reason: req.valid.body.reason });
  res.json({ order: getOrder(order.id) });
});

// Stripe webhook: needs the raw body for signature verification, so it's mounted before express.json().
export const stripeWebhook = [
  express.raw({ type: 'application/json' }),
  (req, res) => {
    if (!stripe || !config.stripeWebhookSecret) return res.status(404).end();
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], config.stripeWebhookSecret);
    } catch (err) {
      return res.status(400).send(`Webhook error: ${err.message}`);
    }
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data.object;
      if (session.payment_status === 'paid') markPaid(Number(session.metadata.orderId), `Stripe payment ${session.payment_intent}`);
    }
    res.json({ received: true });
  },
];
