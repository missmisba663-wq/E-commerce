/**
 * Optional demo data for presentations: creates sample customers and ~120 orders over the last
 * 60 days through the real order code, so the admin dashboard and order screens have content.
 *
 *   npm run demo            (from the repo root or server/)
 *
 * Demo accounts use @demo.shopverse.dev emails and the password Demo12345.
 * Running it again first removes the previous demo customers and their orders.
 */
import bcrypt from 'bcryptjs';
import { sql, tx } from './index.js';
import { ensureSeeded } from './seed.js';
import { advanceOrder, cancelOrder, createOrderFromCart, markPaid } from '../lib/orders.js';

ensureSeeded();

const NAMES = ['Aarav Sharma', 'Priya Patel', 'Liam Johnson', 'Sofia Garcia', 'Noah Williams', 'Zara Khan', 'Ethan Brown',
  'Mia Chen', 'Lucas Martin', 'Ananya Iyer', 'Oliver Davis', 'Fatima Ali', 'James Wilson', 'Emma Thompson', 'Rohan Mehta'];
const CITIES = [['Mumbai', 'Maharashtra', '400001'], ['Bengaluru', 'Karnataka', '560001'], ['New Delhi', 'Delhi', '110001'],
  ['Hyderabad', 'Telangana', '500001'], ['Chennai', 'Tamil Nadu', '600001'], ['Pune', 'Maharashtra', '411001']];

// Deterministic pseudo-random numbers so repeated runs produce the same demo.
let seed = 42;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

tx(() => {
  const old = sql("SELECT id FROM users WHERE email LIKE '%@demo.shopverse.dev'").all();
  for (const { id } of old) {
    for (const o of sql('SELECT id, status FROM orders WHERE user_id = ?').all(id)) {
      if (o.status !== 'cancelled' && o.status !== 'delivered' && o.status !== 'shipped') {
        for (const i of sql('SELECT product_id, quantity FROM order_items WHERE order_id = ?').all(o.id)) {
          sql('UPDATE products SET stock = stock + ? WHERE id = ?').run(i.quantity, i.product_id);
        }
      }
      sql('DELETE FROM orders WHERE id = ?').run(o.id);
    }
    sql('DELETE FROM reviews WHERE user_id = ?').run(id);
    sql('DELETE FROM users WHERE id = ?').run(id);
  }
});

const hash = bcrypt.hashSync('Demo12345', 10);
const users = NAMES.map((name, i) => {
  const email = `${name.split(' ')[0].toLowerCase()}@demo.shopverse.dev`;
  const daysAgo = 60 - i * 3;
  const { lastInsertRowid } = sql(`INSERT INTO users (name, email, password_hash, created_at) VALUES (?, ?, ?, datetime('now', ?))`)
    .run(name, email, hash, `-${daysAgo} days`);
  return { id: Number(lastInsertRowid), name };
});

const popular = sql('SELECT id FROM products WHERE stock > 20 AND is_active = 1 ORDER BY popularity DESC LIMIT 600').all().map((r) => r.id);
let created = 0;

for (let n = 0; n < 120; n++) {
  const user = pick(users);
  const [city, state, zip] = pick(CITIES);
  const lines = 1 + Math.floor(rand() * 3);
  for (let l = 0; l < lines; l++) {
    sql(`INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)
         ON CONFLICT DO UPDATE SET quantity = quantity + 1`).run(user.id, pick(popular), 1 + Math.floor(rand() * 2));
  }
  const card = rand() < 0.55;
  const orderId = createOrderFromCart(user.id, {
    fullName: user.name, phone: '+91 98765 43210', line1: `${100 + n}, MG Road`, city, state, postalCode: zip, country: 'India',
  }, card ? 'card' : 'cod');

  // Spread orders across the last 60 days; older orders are further along.
  const daysAgo = Math.floor(rand() ** 1.3 * 60);
  const roll = rand();
  if (card) markPaid(orderId, 'Demo payment');
  if (daysAgo > 3 && roll < 0.9) advanceOrder(orderId, 'shipped', { trackingNumber: `1Z${String(orderId).padStart(8, '0')}` });
  if (daysAgo > 7 && roll < 0.8) advanceOrder(orderId, 'delivered');
  if (roll >= 0.93) await cancelOrder(orderId, { by: 'customer', reason: 'Changed my mind.' });

  const when = `-${daysAgo} days`;
  sql(`UPDATE orders SET created_at = datetime('now', ?, ?), updated_at = datetime('now', ?, ?) WHERE id = ?`)
    .run(when, `-${Math.floor(rand() * 12)} hours`, when, '+2 days', orderId);
  sql(`UPDATE order_events SET created_at = datetime('now', ?, '+' || (id - (SELECT MIN(id) FROM order_events WHERE order_id = ?)) || ' days')
       WHERE order_id = ?`).run(when, orderId, orderId);
  created++;
}

// A few verified reviews on delivered items.
const REVIEWS = [
  [5, 'Exactly what I needed', 'Arrived quickly and works perfectly. Would buy again.'],
  [4, 'Good value', 'Solid quality for the price. Packaging could be better.'],
  [5, 'Love it', 'Better than expected, my whole family uses it now.'],
  [3, 'It is okay', 'Does the job, but smaller than I thought from the photos.'],
];
const delivered = sql(`SELECT DISTINCT o.user_id, oi.product_id FROM orders o JOIN order_items oi ON oi.order_id = o.id
  JOIN users u ON u.id = o.user_id WHERE o.status = 'delivered' AND u.email LIKE '%@demo.shopverse.dev' LIMIT 40`).all();
for (const d of delivered) {
  const [rating, title, body] = pick(REVIEWS);
  sql(`INSERT OR IGNORE INTO reviews (product_id, user_id, rating, title, body, verified_purchase, created_at)
       VALUES (?, ?, ?, ?, ?, 1, datetime('now', ?))`).run(d.product_id, d.user_id, rating, title, body, `-${Math.floor(rand() * 20)} days`);
}

console.log(`Demo data ready: ${users.length} customers, ${created} orders, ${delivered.length} reviews.`);
console.log('Sign in as any demo customer, e.g. priya@demo.shopverse.dev / Demo12345');
