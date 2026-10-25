import { Router } from 'express';
import { z } from 'zod';
import { db, sql } from '../db/index.js';
import { HttpError, notFound, validate } from '../lib/http.js';
import { advanceOrder, cancelOrder, getOrder, orderSummary } from '../lib/orders.js';
import { CARD_COLUMNS, CARD_FROM, ftsQuery, toCard } from '../lib/products.js';
import { requireAdmin } from '../middleware/auth.js';
import { invalidateCatalogCache } from './catalog.js';

const router = Router();
router.use(requireAdmin);

// Orders that count as sales: confirmed and not cancelled.
const SOLD = "o.status IN ('processing', 'shipped', 'delivered')";

router.get('/stats', validate(z.object({ days: z.coerce.number().int().min(7).max(365).default(30) }), 'query'), (req, res) => {
  const { days } = req.valid.query;
  const since = `-${days - 1} days`;
  const totals = sql(`SELECT COUNT(*) AS orders, coalesce(SUM(total_cents), 0) AS revenue
      FROM orders o WHERE ${SOLD} AND date(o.created_at) >= date('now', ?)`).get(since);
  const prev = sql(`SELECT coalesce(SUM(total_cents), 0) AS revenue FROM orders o
      WHERE ${SOLD} AND date(o.created_at) >= date('now', ?) AND date(o.created_at) < date('now', ?)`)
    .get(`-${days * 2 - 1} days`, since);
  const newCustomers = sql(`SELECT COUNT(*) AS n FROM users WHERE role = 'customer' AND date(created_at) >= date('now', ?)`).get(since).n;

  const byDay = new Map(
    sql(`SELECT date(o.created_at) AS day, SUM(total_cents) AS revenue, COUNT(*) AS orders
        FROM orders o WHERE ${SOLD} AND date(o.created_at) >= date('now', ?) GROUP BY day`).all(since).map((r) => [r.day, r]),
  );
  const series = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    series.push({ day, revenueCents: byDay.get(day)?.revenue ?? 0, orders: byDay.get(day)?.orders ?? 0 });
  }

  res.json({
    days,
    revenueCents: totals.revenue,
    previousRevenueCents: prev.revenue,
    orders: totals.orders,
    averageOrderCents: totals.orders ? Math.round(totals.revenue / totals.orders) : 0,
    newCustomers,
    totals: {
      customers: sql("SELECT COUNT(*) AS n FROM users WHERE role = 'customer'").get().n,
      products: sql('SELECT COUNT(*) AS n FROM products WHERE is_active = 1').get().n,
      outOfStock: sql('SELECT COUNT(*) AS n FROM products WHERE is_active = 1 AND stock = 0').get().n,
      awaitingShipment: sql("SELECT COUNT(*) AS n FROM orders WHERE status = 'processing'").get().n,
    },
    series,
    ordersByStatus: sql('SELECT status, COUNT(*) AS count FROM orders GROUP BY status').all(),
    topProducts: sql(`SELECT oi.product_id AS id, oi.title, SUM(oi.quantity) AS units, SUM(oi.quantity * oi.unit_price_cents) AS revenueCents
        FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE ${SOLD} AND date(o.created_at) >= date('now', ?)
        GROUP BY oi.product_id ORDER BY units DESC LIMIT 5`).all(since),
    salesByDepartment: sql(`SELECT d.name, SUM(oi.quantity * oi.unit_price_cents) AS revenueCents
        FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN products p ON p.id = oi.product_id
        JOIN categories c ON c.id = p.category_id JOIN departments d ON d.id = c.department_id
        WHERE ${SOLD} AND date(o.created_at) >= date('now', ?) GROUP BY d.id ORDER BY revenueCents DESC LIMIT 8`).all(since),
    recentOrders: sql('SELECT o.*, u.name AS customer_name FROM orders o JOIN users u ON u.id = o.user_id ORDER BY o.created_at DESC, o.id DESC LIMIT 8')
      .all()
      .map((o) => ({ ...orderSummary(o), customerName: o.customer_name })),
  });
});

// ---- Orders ----

const orderListSchema = z.object({
  status: z.enum(['pending_payment', 'processing', 'shipped', 'delivered', 'cancelled']).optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
});

router.get('/orders', validate(orderListSchema, 'query'), (req, res) => {
  const { status, q, page } = req.valid.query;
  const limit = 20;
  const where = ['1 = 1'];
  const params = [];
  if (status) {
    where.push('o.status = ?');
    params.push(status);
  }
  if (q) {
    const id = Number(q.replace(/^SV-?/i, ''));
    where.push('(o.id = ? OR u.email LIKE ? OR u.name LIKE ? OR o.ship_name LIKE ?)');
    params.push(Number.isFinite(id) ? id : -1, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  const from = `FROM orders o JOIN users u ON u.id = o.user_id WHERE ${where.join(' AND ')}`;
  const { total } = db.prepare(`SELECT COUNT(*) AS total ${from}`).get(...params);
  const orders = db.prepare(`SELECT o.*, u.name AS customer_name, u.email AS customer_email,
        (SELECT SUM(quantity) FROM order_items WHERE order_id = o.id) AS units ${from} ORDER BY o.created_at DESC, o.id DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, (page - 1) * limit)
    .map((o) => ({ ...orderSummary(o), customerName: o.customer_name, customerEmail: o.customer_email, units: o.units }));
  res.json({ orders, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
});

router.get('/orders/:id', (req, res) => {
  const order = getOrder(Number(req.params.id));
  if (!order) throw notFound('Order');
  res.json({ order });
});

router.patch(
  '/orders/:id',
  validate(z.object({
    status: z.enum(['processing', 'shipped', 'delivered']),
    trackingNumber: z.string().trim().max(60).optional(),
  })),
  (req, res) => {
    advanceOrder(Number(req.params.id), req.valid.body.status, req.valid.body);
    res.json({ order: getOrder(Number(req.params.id)) });
  },
);

router.post('/orders/:id/cancel', validate(z.object({ reason: z.string().trim().max(300).default('') })), async (req, res) => {
  await cancelOrder(Number(req.params.id), { by: 'the store', reason: req.valid.body.reason });
  res.json({ order: getOrder(Number(req.params.id)) });
});

// ---- Products ----

const productListSchema = z.object({
  q: z.string().trim().max(200).optional(),
  department: z.string().max(80).optional(),
  stock: z.enum(['low', 'out']).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  page: z.coerce.number().int().min(1).default(1),
});

router.get('/products', validate(productListSchema, 'query'), (req, res) => {
  const { q, department, stock, status, page } = req.valid.query;
  const limit = 25;
  const where = ['1 = 1'];
  const params = [];
  if (q) {
    if (/^\d+$/.test(q)) {
      where.push('p.id = ?');
      params.push(Number(q));
    } else if (ftsQuery(q)) {
      where.push('p.id IN (SELECT rowid FROM products_fts WHERE products_fts MATCH ?)');
      params.push(ftsQuery(q));
    }
  }
  if (department) {
    where.push('d.slug = ?');
    params.push(department);
  }
  if (stock === 'low') where.push('p.stock BETWEEN 1 AND 5');
  if (stock === 'out') where.push('p.stock = 0');
  if (status) where.push(`p.is_active = ${status === 'active' ? 1 : 0}`);
  const w = where.join(' AND ');
  const { total } = db.prepare(`SELECT COUNT(*) AS total ${CARD_FROM} WHERE ${w}`).get(...params);
  const products = db.prepare(`SELECT ${CARD_COLUMNS}, p.category_id ${CARD_FROM} WHERE ${w} ORDER BY p.popularity DESC, p.id LIMIT ? OFFSET ?`)
    .all(...params, limit, (page - 1) * limit)
    .map((r) => ({ ...toCard(r), isActive: Boolean(r.is_active), categoryId: r.category_id }));
  res.json({ products, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
});

const productSchema = z.object({
  title: z.string().trim().min(5).max(400),
  image: z.url('Image must be a valid URL').max(500),
  categoryId: z.number().int().positive(),
  priceCents: z.number().int().min(1).max(1_000_000_000),
  listPriceCents: z.number().int().min(0).max(1_000_000_000).default(0),
  stock: z.number().int().min(0).max(100_000),
  isActive: z.boolean().default(true),
});

function checkProduct(p) {
  if (p.categoryId && !sql('SELECT 1 FROM categories WHERE id = ?').get(p.categoryId)) throw new HttpError(400, 'Unknown category');
  if (p.listPriceCents && p.priceCents && p.listPriceCents <= p.priceCents) {
    throw new HttpError(400, 'List price must be higher than the selling price (or 0 for no discount)');
  }
}

router.post('/products', validate(productSchema), (req, res) => {
  const p = req.valid.body;
  checkProduct(p);
  const { lastInsertRowid } = sql(`INSERT INTO products (title, image, category_id, price_cents, list_price_cents, stock, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run(p.title, p.image, p.categoryId, p.priceCents, p.listPriceCents, p.stock, p.isActive ? 1 : 0);
  invalidateCatalogCache();
  res.status(201).json({ id: Number(lastInsertRowid) });
});

const COLUMN = { title: 'title', image: 'image', categoryId: 'category_id', priceCents: 'price_cents', listPriceCents: 'list_price_cents', stock: 'stock', isActive: 'is_active' };

router.patch('/products/:id', validate(productSchema.partial().extend({ image: z.string().trim().min(1).max(500).optional() })), (req, res) => {
  const id = Number(req.params.id);
  const current = sql('SELECT price_cents, list_price_cents FROM products WHERE id = ?').get(id);
  if (!current) throw notFound('Product');
  const p = req.valid.body;
  checkProduct({
    categoryId: p.categoryId,
    priceCents: p.priceCents ?? current.price_cents,
    listPriceCents: p.listPriceCents ?? current.list_price_cents,
  });
  const entries = Object.entries(p).filter(([k, v]) => COLUMN[k] && v !== undefined);
  if (entries.length) {
    db.prepare(`UPDATE products SET ${entries.map(([k]) => `${COLUMN[k]} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`)
      .run(...entries.map(([k, v]) => (k === 'isActive' ? (v ? 1 : 0) : v)), id);
    invalidateCatalogCache();
  }
  res.json({ product: toCard(sql(`SELECT ${CARD_COLUMNS} ${CARD_FROM} WHERE p.id = ?`).get(id)) });
});

// ---- Customers ----

router.get('/users', validate(z.object({ q: z.string().trim().max(100).optional(), page: z.coerce.number().int().min(1).default(1) }), 'query'), (req, res) => {
  const { q, page } = req.valid.query;
  const limit = 25;
  const where = q ? 'WHERE u.name LIKE ? OR u.email LIKE ?' : '';
  const params = q ? [`%${q}%`, `%${q}%`] : [];
  const { total } = db.prepare(`SELECT COUNT(*) AS total FROM users u ${where}`).get(...params);
  const users = db.prepare(`SELECT u.id, u.name, u.email, u.role, u.created_at,
        (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS orders,
        (SELECT coalesce(SUM(total_cents), 0) FROM orders o WHERE o.user_id = u.id AND ${SOLD}) AS spent
      FROM users u ${where} ORDER BY u.id DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, (page - 1) * limit)
    .map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, createdAt: u.created_at, orders: u.orders, spentCents: u.spent }));
  res.json({ users, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
});

router.patch('/users/:id', validate(z.object({ role: z.enum(['customer', 'admin']) })), (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) throw new HttpError(400, "You can't change your own role");
  const { changes } = sql('UPDATE users SET role = ? WHERE id = ?').run(req.valid.body.role, id);
  if (!changes) throw notFound('User');
  res.status(204).end();
});

export default router;
