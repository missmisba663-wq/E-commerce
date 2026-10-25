import { Router } from 'express';
import { z } from 'zod';
import { db, sql } from '../db/index.js';
import { notFound, validate } from '../lib/http.js';
import { CARD_COLUMNS, CARD_FROM, ftsQuery, imageUrls, toCard } from '../lib/products.js';

const router = Router();

// Catalogue structure and home sections change rarely; cache briefly in memory.
const cache = new Map();
function cached(key, ttlMs, compute) {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const value = compute();
  cache.set(key, { value, expires: Date.now() + ttlMs });
  return value;
}
export const invalidateCatalogCache = () => cache.clear();

function departmentsWithCategories() {
  return cached('departments', 10 * 60_000, () => {
    const counts = new Map(
      sql('SELECT category_id, COUNT(*) AS n FROM products WHERE is_active = 1 GROUP BY category_id')
        .all()
        .map((r) => [r.category_id, r.n]),
    );
    const cats = sql('SELECT id, slug, name, department_id FROM categories ORDER BY name').all();
    return sql('SELECT id, slug, name, icon FROM departments ORDER BY sort').all().map((d) => {
      const categories = cats
        .filter((c) => c.department_id === d.id && counts.get(c.id))
        .map((c) => ({ id: c.id, slug: c.slug, name: c.name, productCount: counts.get(c.id) }));
      return {
        slug: d.slug,
        name: d.name,
        icon: d.icon,
        productCount: categories.reduce((s, c) => s + c.productCount, 0),
        categories,
      };
    });
  });
}

router.get('/departments', (_req, res) => {
  res.json({ departments: departmentsWithCategories() });
});

const SORTS = {
  relevance: null, // bm25 when searching, popularity otherwise
  popular: 'p.popularity DESC',
  price_asc: 'p.price_cents ASC',
  price_desc: 'p.price_cents DESC',
  rating: 'p.stars DESC, p.rating_count DESC',
  discount: 'CASE WHEN p.list_price_cents > 0 THEN 1.0 * p.price_cents / p.list_price_cents ELSE 1 END ASC',
  newest: 'p.created_at DESC, p.id DESC',
};

const flag = z.enum(['1', 'true', '0', 'false']).transform((v) => v === '1' || v === 'true').optional();
const listSchema = z.object({
  q: z.string().trim().max(200).optional(),
  department: z.string().max(80).optional(),
  category: z.string().max(80).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  bestseller: flag,
  sale: flag,
  inStock: flag,
  sort: z.enum(Object.keys(SORTS)).default('relevance'),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(60).default(24),
});

// bm25 is lower-is-better; category matches weigh 2x a title match, and popularity breaks near-ties.
const RANK = 's.score - ln(1 + p.popularity) * 0.4';
const searchJoin = (match) => (match
  ? ' JOIN (SELECT rowid, bm25(products_fts, 1.0, 2.0) AS score FROM products_fts WHERE products_fts MATCH ?) s ON s.rowid = p.id'
  : '');

/** Builds FROM/WHERE for a listing. `skip` omits one filter, for facet counts. */
function buildFilters(f, skip) {
  const where = ['p.is_active = 1'];
  const match = f.q ? ftsQuery(f.q) : null;
  const params = match ? [match] : [];
  if (f.department && skip !== 'department') {
    where.push('d.slug = ?');
    params.push(f.department);
  }
  if (f.category && skip !== 'category') {
    where.push('c.slug = ?');
    params.push(f.category);
  }
  if (f.minPrice != null) {
    where.push('p.price_cents >= ?');
    params.push(Math.round(f.minPrice * 100));
  }
  if (f.maxPrice != null) {
    where.push('p.price_cents <= ?');
    params.push(Math.round(f.maxPrice * 100));
  }
  if (f.minRating) {
    where.push('p.stars >= ?');
    params.push(f.minRating);
  }
  if (f.bestseller) where.push('p.is_bestseller = 1');
  if (f.sale) where.push('p.list_price_cents > p.price_cents');
  if (f.inStock) where.push('p.stock > 0');
  return { from: CARD_FROM + searchJoin(match), where: where.join(' AND '), params, match };
}

router.get('/products', validate(listSchema, 'query'), (req, res) => {
  const f = req.valid.query;
  const { from, where, params, match } = buildFilters(f);
  const offset = (f.page - 1) * f.limit;
  const order = SORTS[f.sort] || (match ? RANK : 'p.popularity DESC');

  const { total } = db.prepare(`SELECT COUNT(*) AS total ${from} WHERE ${where}`).get(...params);
  const items = db
    .prepare(`SELECT ${CARD_COLUMNS} ${from} WHERE ${where} ORDER BY ${order}, p.id LIMIT ? OFFSET ?`)
    .all(...params, f.limit, offset)
    .map(toCard);

  // Category facet: counts ignoring the current category filter, so shoppers can switch.
  const facet = buildFilters(f, 'category');
  const categories = db
    .prepare(`SELECT c.slug, c.name, d.slug AS department, COUNT(*) AS count ${facet.from}
              WHERE ${facet.where} GROUP BY c.id ORDER BY count DESC LIMIT 40`)
    .all(...facet.params);

  res.json({
    items,
    total,
    page: f.page,
    pages: Math.max(1, Math.ceil(total / f.limit)),
    limit: f.limit,
    facets: { categories },
  });
});

router.get('/products/suggest', validate(z.object({ q: z.string().trim().max(100).default('') }), 'query'), (req, res) => {
  const match = ftsQuery(req.valid.query.q);
  if (!match) return res.json({ products: [], categories: [] });
  const products = sql(`
    SELECT p.id, p.title, p.image, p.price_cents FROM products p ${searchJoin(match)}
    WHERE p.is_active = 1 ORDER BY ${RANK} LIMIT 6`)
    .all(match)
    .map((r) => ({ id: r.id, title: r.title, priceCents: r.price_cents, image: imageUrls(r.image).image }));
  const q = `%${req.valid.query.q.toLowerCase()}%`;
  const categories = sql(`
    SELECT c.slug, c.name, d.slug AS department FROM categories c JOIN departments d ON d.id = c.department_id
    WHERE lower(c.name) LIKE ? LIMIT 3`).all(q);
  res.json({ products, categories });
});

router.get('/products/:id', (req, res) => {
  const row = sql(`SELECT ${CARD_COLUMNS}, p.asin, p.category_id ${CARD_FROM} WHERE p.id = ?`).get(Number(req.params.id));
  if (!row || !row.is_active) throw notFound('Product');

  const reviewStats = sql(`SELECT COUNT(*) AS count, AVG(rating) AS average FROM reviews WHERE product_id = ?`).get(row.id);
  const related = sql(`SELECT ${CARD_COLUMNS} ${CARD_FROM}
      WHERE p.category_id = ? AND p.id != ? AND p.is_active = 1 ORDER BY p.popularity DESC LIMIT 12`)
    .all(row.category_id, row.id)
    .map(toCard);
  // "Customers also bought": products that appear in the same orders.
  const alsoBought = sql(`SELECT ${CARD_COLUMNS} ${CARD_FROM}
      WHERE p.is_active = 1 AND p.id IN (
        SELECT oi2.product_id FROM order_items oi1
        JOIN order_items oi2 ON oi2.order_id = oi1.order_id AND oi2.product_id != oi1.product_id
        WHERE oi1.product_id = ? GROUP BY oi2.product_id ORDER BY COUNT(*) DESC LIMIT 8)`)
    .all(row.id)
    .map(toCard);

  const inWishlist = req.user
    ? Boolean(sql('SELECT 1 FROM wishlist_items WHERE user_id = ? AND product_id = ?').get(req.user.id, row.id))
    : false;

  res.json({
    product: {
      ...toCard(row),
      // Titles from the dataset pack features into comma/pipe separated phrases.
      highlights: row.title.split(/\s*[,|]\s*|\s+-\s+/).slice(1).filter((s) => s.length > 3).slice(0, 8),
      sourceUrl: row.asin ? `https://www.amazon.com/dp/${row.asin}` : null,
      customerReviews: { count: reviewStats.count, average: reviewStats.average ? Number(reviewStats.average.toFixed(1)) : null },
      inWishlist,
    },
    related,
    alsoBought,
  });
});

// Home page campaign banners. Offers are computed from live product data so they're always true.
const CAMPAIGNS = [
  { id: 'fragrance', department: 'beauty', category: 'perfumes-and-fragrances', eyebrow: 'Fragrance Festival', title: 'Find your signature scent', theme: 'plum' },
  { id: 'skincare', department: 'beauty', category: 'skin-care-products', eyebrow: 'Glow Up Week', title: 'Skincare that shows', theme: 'peach' },
  { id: 'makeup', department: 'beauty', category: 'makeup', eyebrow: 'Makeup Must-Haves', title: 'Bold looks, everyday prices', theme: 'rose' },
  { id: 'audio', department: 'electronics', category: 'headphones-and-earbuds', eyebrow: 'Sound On Sale', title: 'Headphones & earbuds for every beat', theme: 'navy' },
  { id: 'shoes', department: 'fashion', category: 'womens-shoes', eyebrow: 'Step Out in Style', title: "Trending women's footwear", theme: 'teal' },
  { id: 'toys', department: 'toys-games', category: 'building-toys', eyebrow: 'Build & Play', title: 'Building sets kids love', theme: 'sun' },
];

function campaignBanners(pick) {
  return CAMPAIGNS.map((c) => {
    const products = pick('c.slug = ? AND p.stars >= 4', 'p.popularity DESC', 3, [c.category]);
    const offer = sql(`SELECT MIN(p.price_cents) AS fromPrice,
        MAX(CASE WHEN p.list_price_cents > p.price_cents AND p.price_cents * 10 >= p.list_price_cents * 3
          THEN 100 - (100 * p.price_cents) / p.list_price_cents END) AS maxDiscount
      FROM products p JOIN categories c ON c.id = p.category_id
      WHERE c.slug = ? AND p.is_active = 1 AND p.stock > 0`).get(c.category);
    const onSale = (offer.maxDiscount || 0) >= 10;
    return {
      ...c,
      products,
      offerPercent: onSale ? Math.floor(offer.maxDiscount / 5) * 5 : null,
      fromPriceCents: offer.fromPrice,
      link: `/c/${c.department}/${c.category}${onSale ? '?sale=1' : ''}`,
    };
  }).filter((c) => c.products.length === 3);
}

router.get('/home', (_req, res) => {
  const data = cached('home', 10 * 60_000, () => {
    const pick = (where, order, limit = 12, params = []) =>
      db.prepare(`SELECT ${CARD_COLUMNS} ${CARD_FROM} WHERE p.is_active = 1 AND p.stock > 0 AND ${where} ORDER BY ${order} LIMIT ?`)
        .all(...params, limit)
        .map(toCard);
    const featured = ['fashion', 'electronics', 'toys-games', 'home-kitchen', 'beauty', 'sports-outdoors'];
    return {
      campaigns: campaignBanners(pick),
      // Popular items 15-70% off (dataset list prices above that are often unrealistic).
      deals: pick(`p.price_cents * 100 <= p.list_price_cents * 85 AND p.price_cents * 10 >= p.list_price_cents * 3
        AND p.stars >= 4 AND p.bought_last_month >= 100`, 'p.popularity DESC', 24),
      bestsellers: pick('p.is_bestseller = 1', 'p.popularity DESC'),
      topRated: pick('p.stars >= 4.7 AND p.rating_count >= 1000', 'p.rating_count DESC'),
      departments: featured.map((slug) => {
        const dept = departmentsWithCategories().find((d) => d.slug === slug);
        return { slug, name: dept?.name ?? slug, products: pick('d.slug = ?', 'p.popularity DESC', 12, [slug]) };
      }),
    };
  });
  res.json(data);
});

export default router;
