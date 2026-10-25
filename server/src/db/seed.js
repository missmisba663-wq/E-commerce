import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import bcrypt from 'bcryptjs';
import { parse } from 'csv-parse/sync';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';
import { db, sql, tx } from './index.js';

/** Stock isn't in the dataset, so derive a stable quantity from the ASIN (~4% sold out). */
function stockFor(asin) {
  let h = 2166136261;
  for (const ch of asin) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h % 25 === 0 ? 0 : 5 + (h % 196);
}

/** Converts US cents to paise at the configured rate, rounded like Indian retail prices (₹1,099, ₹249, ₹89). */
export function toInrPaise(usdCents) {
  if (!usdCents) return 0;
  const rupees = (usdCents / 100) * config.usdToInr;
  const nice = Math.max(9, Math.round(rupees / 10) * 10 - 1);
  return nice * 100;
}

export function popularity({ bought, ratingCount, bestseller }) {
  return bought * 10 + ratingCount + (bestseller ? 5000 : 0);
}

export function seedCatalog({ limit = Number(process.env.SEED_LIMIT) || 0, log = console.log } = {}) {
  const catalog = JSON.parse(fs.readFileSync(path.join(config.dataDir, 'catalog.json'), 'utf8'));
  const csv = zlib.gunzipSync(fs.readFileSync(path.join(config.dataDir, 'products.csv.gz')));
  let rows = parse(csv, { columns: true, skip_empty_lines: true });
  if (limit && rows.length > limit) {
    const step = rows.length / limit; // spread the sample across every category
    rows = Array.from({ length: limit }, (_, i) => rows[Math.floor(i * step)]);
  }

  const started = Date.now();
  tx(() => {
    const insDept = db.prepare('INSERT INTO departments (slug, name, icon, sort) VALUES (?, ?, ?, ?)');
    const insCat = db.prepare('INSERT INTO categories (id, slug, name, department_id) VALUES (?, ?, ?, ?)');
    for (const dept of catalog) {
      const { lastInsertRowid } = insDept.run(dept.slug, dept.name, dept.icon, dept.sort);
      for (const c of dept.categories) insCat.run(c.id, c.slug, c.name, lastInsertRowid);
    }
    const insProduct = db.prepare(`
      INSERT INTO products (asin, title, image, price_cents, list_price_cents, stars, rating_count,
        bought_last_month, is_bestseller, category_id, stock, popularity)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const r of rows) {
      const price = toInrPaise(Number(r.price_cents));
      let listPrice = toInrPaise(Number(r.list_price_cents));
      if (listPrice <= price) listPrice = 0; // rounding can erase very small discounts
      const bought = Number(r.bought_last_month);
      const ratingCount = Number(r.reviews);
      const bestseller = Number(r.bestseller);
      insProduct.run(
        r.asin, r.title, r.image, price, listPrice, Number(r.stars),
        ratingCount, bought, bestseller, Number(r.category_id), stockFor(r.asin),
        popularity({ bought, ratingCount, bestseller }),
      );
    }
  });
  db.exec('ANALYZE');
  log(`Seeded ${rows.length.toLocaleString()} products in ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

/** Creates the admin account; when ADMIN_PASSWORD is set, also keeps the existing admin's password in sync with it. */
export function ensureAdmin() {
  const existing = sql('SELECT id, password_hash FROM users WHERE email = ?').get(config.adminEmail);
  if (!existing) {
    sql("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin')")
      .run('Store Admin', config.adminEmail, bcrypt.hashSync(config.adminPassword, 10));
  } else if (process.env.ADMIN_PASSWORD && !bcrypt.compareSync(process.env.ADMIN_PASSWORD, existing.password_hash)) {
    sql("UPDATE users SET password_hash = ?, role = 'admin' WHERE id = ?").run(bcrypt.hashSync(process.env.ADMIN_PASSWORD, 10), existing.id);
  }
}

/** Seeds the catalogue on first boot so a fresh deployment is immediately usable. */
export function ensureSeeded(options) {
  const { n } = sql('SELECT COUNT(*) AS n FROM products').get();
  if (n === 0) seedCatalog(options);
  ensureAdmin();
}

// `npm run seed` wipes the catalogue and orders, then reloads from the dataset.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  tx(() => {
    for (const t of ['reviews', 'order_events', 'order_items', 'orders', 'cart_items', 'wishlist_items', 'products', 'categories', 'departments']) {
      db.exec(`DELETE FROM ${t}`);
    }
  });
  db.exec('DELETE FROM products_fts');
  seedCatalog();
  ensureAdmin();
  db.exec('VACUUM');
}
