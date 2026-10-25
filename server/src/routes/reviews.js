import { Router } from 'express';
import { z } from 'zod';
import { sql } from '../db/index.js';
import { notFound, validate } from '../lib/http.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router({ mergeParams: true });

const toReview = (r) => ({
  id: r.id,
  rating: r.rating,
  title: r.title,
  body: r.body,
  verifiedPurchase: Boolean(r.verified_purchase),
  author: r.author,
  userId: r.user_id,
  createdAt: r.created_at,
});

router.get('/', validate(z.object({ page: z.coerce.number().int().min(1).default(1) }), 'query'), (req, res) => {
  const productId = Number(req.params.productId);
  const limit = 10;
  const { page } = req.valid.query;
  const reviews = sql(`SELECT r.*, u.name AS author FROM reviews r JOIN users u ON u.id = r.user_id
      WHERE r.product_id = ? ORDER BY r.created_at DESC, r.id DESC LIMIT ? OFFSET ?`)
    .all(productId, limit, (page - 1) * limit)
    .map(toReview);
  const breakdown = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: sql('SELECT COUNT(*) AS n FROM reviews WHERE product_id = ? AND rating = ?').get(productId, stars).n,
  }));
  const total = breakdown.reduce((s, b) => s + b.count, 0);
  const mine = req.user
    ? sql('SELECT r.*, u.name AS author FROM reviews r JOIN users u ON u.id = r.user_id WHERE product_id = ? AND user_id = ?')
      .get(productId, req.user.id)
    : null;
  const canReview = req.user
    ? Boolean(sql(`SELECT 1 FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE o.user_id = ? AND oi.product_id = ? AND o.status = 'delivered'`).get(req.user.id, productId))
    : false;
  res.json({ reviews, total, page, pages: Math.max(1, Math.ceil(total / limit)), breakdown, mine: mine ? toReview(mine) : null, canReview });
});

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().min(3, 'Please add a headline').max(120),
  body: z.string().trim().min(10, 'Please write at least 10 characters').max(4000),
});

// Only customers with a delivered order for the product may review it, so every review is a verified purchase.
router.put('/', requireAuth, validate(reviewSchema), (req, res) => {
  const productId = Number(req.params.productId);
  if (!sql('SELECT 1 FROM products WHERE id = ?').get(productId)) throw notFound('Product');
  const bought = sql(`SELECT 1 FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE o.user_id = ? AND oi.product_id = ? AND o.status = 'delivered'`).get(req.user.id, productId);
  if (!bought) {
    return res.status(403).json({ error: 'You can review this product once your order has been delivered' });
  }
  const { rating, title, body } = req.valid.body;
  sql(`INSERT INTO reviews (product_id, user_id, rating, title, body, verified_purchase) VALUES (?, ?, ?, ?, ?, 1)
       ON CONFLICT (product_id, user_id) DO UPDATE SET rating = excluded.rating, title = excluded.title,
       body = excluded.body, created_at = datetime('now')`)
    .run(productId, req.user.id, rating, title, body);
  res.status(204).end();
});

router.delete('/', requireAuth, (req, res) => {
  sql('DELETE FROM reviews WHERE product_id = ? AND user_id = ?').run(Number(req.params.productId), req.user.id);
  res.status(204).end();
});

export default router;
