import Stripe from 'stripe';
import { config } from '../config.js';
import { sql, tx } from '../db/index.js';
import { HttpError, notFound } from './http.js';
import { computeTotals } from './pricing.js';
import { imageUrls } from './products.js';

export const stripe = config.stripeSecretKey ? new Stripe(config.stripeSecretKey) : null;

/** Allowed status transitions (admin and system). */
export const TRANSITIONS = {
  pending_payment: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

export const STATUS_LABELS = {
  pending_payment: 'Awaiting payment',
  processing: 'Order confirmed',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

function addEvent(orderId, status, note = '') {
  sql('INSERT INTO order_events (order_id, status, note) VALUES (?, ?, ?)').run(orderId, status, note);
}

/**
 * Creates an order from the user's cart, reserving stock atomically.
 * Card orders start as pending_payment until Stripe confirms; COD orders go straight to processing.
 */
export function createOrderFromCart(userId, address, paymentMethod) {
  return tx(() => {
    const lines = sql(`SELECT ci.product_id, ci.quantity, p.title, p.image, p.price_cents, p.stock, p.is_active
        FROM cart_items ci JOIN products p ON p.id = ci.product_id WHERE ci.user_id = ?`).all(userId);
    if (!lines.length) throw new HttpError(400, 'Your cart is empty');

    for (const l of lines) {
      if (!l.is_active || l.stock < l.quantity) {
        const msg = l.stock === 0 || !l.is_active ? 'is out of stock' : `has only ${l.stock} left`;
        throw new HttpError(409, `"${l.title.slice(0, 60)}" ${msg}. Please update your cart.`);
      }
      // Guarded decrement protects against two checkouts racing for the last unit.
      const { changes } = sql('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?')
        .run(l.quantity, l.product_id, l.quantity);
      if (!changes) throw new HttpError(409, `"${l.title.slice(0, 60)}" just sold out. Please update your cart.`);
    }

    const totals = computeTotals(lines.map((l) => ({ unitPriceCents: l.price_cents, quantity: l.quantity })));
    const status = paymentMethod === 'card' ? 'pending_payment' : 'processing';
    const { lastInsertRowid } = sql(`INSERT INTO orders (user_id, status, payment_method, subtotal_cents, shipping_cents,
        tax_cents, total_cents, ship_name, ship_phone, ship_line1, ship_line2, ship_city, ship_state, ship_postal_code, ship_country)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(userId, status, paymentMethod, totals.subtotalCents, totals.shippingCents, totals.taxCents, totals.totalCents,
        address.fullName, address.phone, address.line1, address.line2 || '', address.city, address.state,
        address.postalCode, address.country);
    const orderId = Number(lastInsertRowid);

    const insItem = sql(`INSERT INTO order_items (order_id, product_id, title, image, unit_price_cents, quantity)
        VALUES (?, ?, ?, ?, ?, ?)`);
    for (const l of lines) insItem.run(orderId, l.product_id, l.title, l.image, l.price_cents, l.quantity);

    addEvent(orderId, 'placed', paymentMethod === 'cod' ? 'Cash on delivery' : 'Awaiting card payment');
    if (status === 'processing') addEvent(orderId, 'processing');
    sql('DELETE FROM cart_items WHERE user_id = ?').run(userId);
    return orderId;
  });
}

export async function createCheckoutSession(orderId) {
  if (!stripe) throw new HttpError(400, 'Card payments are not configured');
  const order = sql('SELECT * FROM orders WHERE id = ?').get(orderId);
  const items = sql('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
  const user = sql('SELECT email FROM users WHERE id = ?').get(order.user_id);
  const money = (name, cents, image) => ({
    price_data: {
      currency: config.shop.currency,
      unit_amount: cents,
      product_data: { name: name.slice(0, 250), ...(image ? { images: [image] } : {}) },
    },
    quantity: 1,
  });
  const lineItems = items.map((i) => ({
    ...money(i.title, i.unit_price_cents, imageUrls(i.image).imageLarge),
    quantity: i.quantity,
  }));
  if (order.shipping_cents) lineItems.push(money('Shipping', order.shipping_cents));
  if (order.tax_cents) lineItems.push(money('Sales tax', order.tax_cents));

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: lineItems,
    customer_email: user.email,
    client_reference_id: String(orderId),
    metadata: { orderId: String(orderId) },
    success_url: `${config.publicUrl}/orders/${orderId}?payment=success`,
    cancel_url: `${config.publicUrl}/orders/${orderId}?payment=cancelled`,
    expires_at: Math.floor(Date.now() / 1000) + config.pendingOrderTtlMinutes * 60,
  });
  sql('UPDATE orders SET stripe_session_id = ? WHERE id = ?').run(session.id, orderId);
  return session.url;
}

export function markPaid(orderId, note = 'Payment received') {
  return tx(() => {
    const order = sql('SELECT status, payment_status FROM orders WHERE id = ?').get(orderId);
    if (!order || order.payment_status === 'paid') return false;
    if (order.status !== 'pending_payment') return false;
    sql("UPDATE orders SET status = 'processing', payment_status = 'paid', updated_at = datetime('now') WHERE id = ?").run(orderId);
    addEvent(orderId, 'paid', note);
    addEvent(orderId, 'processing');
    return true;
  });
}

/** Asks Stripe whether the order's checkout session is paid; used after redirect when webhooks aren't set up. */
export async function syncPayment(orderId) {
  const order = sql('SELECT stripe_session_id, status FROM orders WHERE id = ?').get(orderId);
  if (!stripe || !order?.stripe_session_id || order.status !== 'pending_payment') return;
  const session = await stripe.checkout.sessions.retrieve(order.stripe_session_id);
  if (session.payment_status === 'paid') markPaid(orderId, `Stripe payment ${session.payment_intent}`);
}

export async function cancelOrder(orderId, { by, reason = '' }) {
  const order = sql('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) throw notFound('Order');
  if (!TRANSITIONS[order.status].includes('cancelled')) {
    throw new HttpError(409, `An order that is ${STATUS_LABELS[order.status].toLowerCase()} can't be cancelled`);
  }
  let refundNote = '';
  if (order.payment_status === 'paid' && order.payment_method === 'card' && stripe && order.stripe_session_id) {
    const session = await stripe.checkout.sessions.retrieve(order.stripe_session_id);
    if (session.payment_intent) await stripe.refunds.create({ payment_intent: session.payment_intent });
    refundNote = ' Refund issued to the original card.';
  }
  tx(() => {
    for (const i of sql('SELECT product_id, quantity FROM order_items WHERE order_id = ?').all(orderId)) {
      sql('UPDATE products SET stock = stock + ? WHERE id = ?').run(i.quantity, i.product_id);
    }
    sql(`UPDATE orders SET status = 'cancelled', updated_at = datetime('now'),
        payment_status = CASE WHEN payment_status = 'paid' THEN 'refunded' ELSE payment_status END WHERE id = ?`).run(orderId);
    addEvent(orderId, 'cancelled', `Cancelled by ${by}.${reason ? ` ${reason}` : ''}${refundNote}`);
  });
  if (stripe && order.status === 'pending_payment' && order.stripe_session_id) {
    stripe.checkout.sessions.expire(order.stripe_session_id).catch(() => {});
  }
}

export function advanceOrder(orderId, next, { trackingNumber } = {}) {
  return tx(() => {
    const order = sql('SELECT status, payment_method FROM orders WHERE id = ?').get(orderId);
    if (!order) throw notFound('Order');
    if (!TRANSITIONS[order.status].includes(next) || next === 'cancelled') {
      throw new HttpError(409, `Can't move an order from "${STATUS_LABELS[order.status]}" to "${STATUS_LABELS[next]}"`);
    }
    if (next === 'processing') return markPaid(orderId, 'Marked as paid by admin');
    sql(`UPDATE orders SET status = ?, updated_at = datetime('now'), tracking_number = coalesce(?, tracking_number),
        payment_status = CASE WHEN ? = 'delivered' AND payment_method = 'cod' THEN 'paid' ELSE payment_status END WHERE id = ?`)
      .run(next, trackingNumber || null, next, orderId);
    addEvent(orderId, next, next === 'shipped' && trackingNumber ? `Tracking number ${trackingNumber}` : '');
    return true;
  });
}

/** Releases stock held by card orders that were never paid. */
export async function expireStaleOrders() {
  const stale = sql(`SELECT id FROM orders WHERE status = 'pending_payment'
      AND created_at < datetime('now', ?)`).all(`-${config.pendingOrderTtlMinutes} minutes`);
  for (const { id } of stale) {
    try {
      await syncPayment(id);
      const { status } = sql('SELECT status FROM orders WHERE id = ?').get(id);
      if (status === 'pending_payment') await cancelOrder(id, { by: 'system', reason: 'Payment was not completed in time.' });
    } catch (err) {
      console.error(`Failed to expire order ${id}:`, err.message);
    }
  }
}

export function getOrder(orderId) {
  const o = sql('SELECT o.*, u.name AS customer_name, u.email AS customer_email FROM orders o JOIN users u ON u.id = o.user_id WHERE o.id = ?').get(orderId);
  if (!o) return null;
  const items = sql('SELECT * FROM order_items WHERE order_id = ?').all(orderId).map((i) => ({
    productId: i.product_id,
    title: i.title,
    image: imageUrls(i.image).image,
    unitPriceCents: i.unit_price_cents,
    quantity: i.quantity,
    lineTotalCents: i.unit_price_cents * i.quantity,
  }));
  const events = sql('SELECT status, note, created_at FROM order_events WHERE order_id = ? ORDER BY id').all(orderId)
    .map((e) => ({ status: e.status, note: e.note, at: e.created_at }));
  return {
    ...orderSummary(o),
    userId: o.user_id,
    customer: { name: o.customer_name, email: o.customer_email },
    shippingAddress: {
      fullName: o.ship_name, phone: o.ship_phone, line1: o.ship_line1, line2: o.ship_line2,
      city: o.ship_city, state: o.ship_state, postalCode: o.ship_postal_code, country: o.ship_country,
    },
    subtotalCents: o.subtotal_cents,
    shippingCents: o.shipping_cents,
    taxCents: o.tax_cents,
    trackingNumber: o.tracking_number,
    items,
    events,
    canCancel: TRANSITIONS[o.status].includes('cancelled'),
    nextStatuses: TRANSITIONS[o.status],
  };
}

export const orderSummary = (o) => ({
  id: o.id,
  number: `SV-${String(o.id).padStart(6, '0')}`,
  status: o.status,
  statusLabel: STATUS_LABELS[o.status],
  paymentMethod: o.payment_method,
  paymentStatus: o.payment_status,
  totalCents: o.total_cents,
  createdAt: o.created_at,
  updatedAt: o.updated_at,
});
