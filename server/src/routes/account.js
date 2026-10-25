import { Router } from 'express';
import { z } from 'zod';
import { sql, tx } from '../db/index.js';
import { HttpError, notFound, validate } from '../lib/http.js';
import { CARD_COLUMNS, CARD_FROM, toCard } from '../lib/products.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// ---- Wishlist ----

router.get('/wishlist', (req, res) => {
  const items = sql(`SELECT ${CARD_COLUMNS} ${CARD_FROM}
      JOIN wishlist_items w ON w.product_id = p.id
      WHERE w.user_id = ? ORDER BY w.added_at DESC`)
    .all(req.user.id)
    .map(toCard);
  res.json({ items });
});

router.get('/wishlist/ids', (req, res) => {
  res.json({ ids: sql('SELECT product_id FROM wishlist_items WHERE user_id = ?').all(req.user.id).map((r) => r.product_id) });
});

router.put('/wishlist/:productId', (req, res) => {
  const id = Number(req.params.productId);
  if (!sql('SELECT 1 FROM products WHERE id = ? AND is_active = 1').get(id)) throw notFound('Product');
  sql('INSERT OR IGNORE INTO wishlist_items (user_id, product_id) VALUES (?, ?)').run(req.user.id, id);
  res.status(204).end();
});

router.delete('/wishlist/:productId', (req, res) => {
  sql('DELETE FROM wishlist_items WHERE user_id = ? AND product_id = ?').run(req.user.id, Number(req.params.productId));
  res.status(204).end();
});

// ---- Addresses ----

export const addressSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name is required').max(100),
  phone: z.string().trim().regex(/^[+\d][\d\s()-]{6,19}$/, 'Please enter a valid phone number'),
  line1: z.string().trim().min(3, 'Address line 1 is required').max(200),
  line2: z.string().trim().max(200).default(''),
  city: z.string().trim().min(2, 'City is required').max(100),
  state: z.string().trim().min(2, 'State is required').max(100),
  postalCode: z.string().trim().regex(/^[A-Za-z0-9 -]{3,10}$/, 'Please enter a valid postal code'),
  country: z.string().trim().min(2, 'Country is required').max(60),
  isDefault: z.boolean().default(false),
});

export const toAddress = (a) => ({
  id: a.id,
  fullName: a.full_name,
  phone: a.phone,
  line1: a.line1,
  line2: a.line2,
  city: a.city,
  state: a.state,
  postalCode: a.postal_code,
  country: a.country,
  isDefault: Boolean(a.is_default),
});

export function saveAddress(userId, a, id = null) {
  return tx(() => {
    const isFirst = !sql('SELECT 1 FROM addresses WHERE user_id = ?').get(userId);
    const makeDefault = a.isDefault || isFirst;
    if (makeDefault) sql('UPDATE addresses SET is_default = 0 WHERE user_id = ?').run(userId);
    const values = [a.fullName, a.phone, a.line1, a.line2, a.city, a.state, a.postalCode, a.country, makeDefault ? 1 : 0];
    if (id) {
      const { changes } = sql(`UPDATE addresses SET full_name = ?, phone = ?, line1 = ?, line2 = ?, city = ?, state = ?,
          postal_code = ?, country = ?, is_default = max(is_default, ?) WHERE id = ? AND user_id = ?`)
        .run(...values, id, userId);
      if (!changes) throw notFound('Address');
      return id;
    }
    return Number(sql(`INSERT INTO addresses (full_name, phone, line1, line2, city, state, postal_code, country, is_default, user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(...values, userId).lastInsertRowid);
  });
}

const listAddresses = (userId) =>
  sql('SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC').all(userId).map(toAddress);

router.get('/addresses', (req, res) => res.json({ addresses: listAddresses(req.user.id) }));

router.post('/addresses', validate(addressSchema), (req, res) => {
  if (sql('SELECT COUNT(*) AS n FROM addresses WHERE user_id = ?').get(req.user.id).n >= 10) {
    throw new HttpError(400, 'You can save up to 10 addresses');
  }
  const id = saveAddress(req.user.id, req.valid.body);
  res.status(201).json({ id, addresses: listAddresses(req.user.id) });
});

router.put('/addresses/:id', validate(addressSchema), (req, res) => {
  saveAddress(req.user.id, req.valid.body, Number(req.params.id));
  res.json({ addresses: listAddresses(req.user.id) });
});

router.delete('/addresses/:id', (req, res) => {
  tx(() => {
    const addr = sql('SELECT is_default FROM addresses WHERE id = ? AND user_id = ?').get(Number(req.params.id), req.user.id);
    if (!addr) throw notFound('Address');
    sql('DELETE FROM addresses WHERE id = ?').run(Number(req.params.id));
    if (addr.is_default) {
      sql('UPDATE addresses SET is_default = 1 WHERE id = (SELECT id FROM addresses WHERE user_id = ? ORDER BY id DESC LIMIT 1)')
        .run(req.user.id);
    }
  });
  res.json({ addresses: listAddresses(req.user.id) });
});

export default router;
