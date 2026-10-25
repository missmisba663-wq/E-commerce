import { Router } from 'express';
import { z } from 'zod';
import { db, sql, tx } from '../db/index.js';
import { HttpError, validate } from '../lib/http.js';
import { computeTotals } from '../lib/pricing.js';
import { CARD_COLUMNS, CARD_FROM, toCard } from '../lib/products.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const MAX_QTY = 10;

const itemSchema = z.object({
  productId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().min(1).max(MAX_QTY),
});
const itemsSchema = z.object({ items: z.array(itemSchema).max(100) });

/** Prices a list of {productId, quantity} against live product data. */
export function priceCart(entries) {
  if (!entries.length) return { items: [], warnings: [], ...computeTotals([]) };
  const ids = entries.map((e) => e.productId);
  const rows = db
    .prepare(`SELECT ${CARD_COLUMNS} ${CARD_FROM} WHERE p.id IN (${ids.map(() => '?').join(',')})`)
    .all(...ids);
  const byId = new Map(rows.map((r) => [r.id, toCard(r)]));
  const items = [];
  const warnings = [];
  for (const e of entries) {
    const product = byId.get(e.productId);
    if (!product) continue;
    if (!product.inStock) {
      warnings.push({ productId: product.id, message: `"${product.title.slice(0, 60)}" is out of stock` });
    } else if (e.quantity > product.stock) {
      warnings.push({ productId: product.id, message: `Only ${product.stock} left of "${product.title.slice(0, 60)}"` });
    }
    items.push({ product, quantity: e.quantity });
  }
  const purchasable = items
    .filter((i) => i.product.inStock)
    .map((i) => ({ unitPriceCents: i.product.priceCents, quantity: Math.min(i.quantity, i.product.stock) }));
  return { items, warnings, ...computeTotals(purchasable) };
}

export const userCartEntries = (userId) =>
  sql('SELECT product_id AS productId, quantity FROM cart_items WHERE user_id = ? ORDER BY added_at DESC, product_id').all(userId);

function assertProduct(productId) {
  const p = sql('SELECT id, stock, is_active FROM products WHERE id = ?').get(productId);
  if (!p || !p.is_active) throw new HttpError(404, 'Product not found');
  if (p.stock === 0) throw new HttpError(409, 'This product is out of stock');
  return p;
}

// Guests keep their cart in the browser; this prices it with the same rules.
router.post('/preview', validate(itemsSchema), (req, res) => {
  res.json(priceCart(req.valid.body.items));
});

router.use(requireAuth);

router.get('/', (req, res) => res.json(priceCart(userCartEntries(req.user.id))));

router.post('/items', validate(itemSchema), (req, res) => {
  const { productId, quantity } = req.valid.body;
  const p = assertProduct(productId);
  sql(`INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)
       ON CONFLICT (user_id, product_id) DO UPDATE SET quantity = min(?, ?, quantity + excluded.quantity)`)
    .run(req.user.id, productId, Math.min(quantity, p.stock), MAX_QTY, p.stock);
  res.json(priceCart(userCartEntries(req.user.id)));
});

router.put('/items/:productId', validate(itemSchema.pick({ quantity: true })), (req, res) => {
  const productId = Number(req.params.productId);
  const p = assertProduct(productId);
  const { changes } = sql('UPDATE cart_items SET quantity = ? WHERE user_id = ? AND product_id = ?')
    .run(Math.min(req.valid.body.quantity, p.stock), req.user.id, productId);
  if (!changes) throw new HttpError(404, 'Item is not in your cart');
  res.json(priceCart(userCartEntries(req.user.id)));
});

router.delete('/items/:productId', (req, res) => {
  sql('DELETE FROM cart_items WHERE user_id = ? AND product_id = ?').run(req.user.id, Number(req.params.productId));
  res.json(priceCart(userCartEntries(req.user.id)));
});

router.delete('/', (req, res) => {
  sql('DELETE FROM cart_items WHERE user_id = ?').run(req.user.id);
  res.json(priceCart([]));
});

// After sign-in the browser cart is merged into the account cart (larger quantity wins).
router.post('/merge', validate(itemsSchema), (req, res) => {
  tx(() => {
    for (const { productId, quantity } of req.valid.body.items) {
      const p = sql('SELECT stock, is_active FROM products WHERE id = ?').get(productId);
      if (!p || !p.is_active || p.stock === 0) continue;
      sql(`INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)
           ON CONFLICT (user_id, product_id) DO UPDATE SET quantity = max(quantity, excluded.quantity)`)
        .run(req.user.id, productId, Math.min(quantity, p.stock));
    }
  });
  res.json(priceCart(userCartEntries(req.user.id)));
});

export default router;
