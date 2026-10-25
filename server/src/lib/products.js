const AMAZON_IMG = 'https://m.media-amazon.com/images/I/';

/** Dataset rows store just the Amazon image id; admin-created products may store a full URL. */
export function imageUrls(image) {
  if (/^https?:\/\//.test(image)) return { image, imageLarge: image };
  return {
    image: `${AMAZON_IMG}${image}._AC_UL320_.jpg`,
    imageLarge: `${AMAZON_IMG}${image}._AC_SL1000_.jpg`,
  };
}

export function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
    .replace(/-$/, '');
}

/** Columns used for product cards; join categories c and departments d. */
export const CARD_COLUMNS = `
  p.id, p.title, p.image, p.price_cents, p.list_price_cents, p.stars, p.rating_count,
  p.bought_last_month, p.is_bestseller, p.stock, p.is_active,
  c.slug AS category_slug, c.name AS category_name, d.slug AS department_slug, d.name AS department_name`;

export const CARD_FROM = `
  FROM products p
  JOIN categories c ON c.id = p.category_id
  JOIN departments d ON d.id = c.department_id`;

export function toCard(row) {
  const discount = row.list_price_cents > row.price_cents
    ? Math.round((1 - row.price_cents / row.list_price_cents) * 100)
    : 0;
  return {
    id: row.id,
    slug: slugify(row.title),
    title: row.title,
    ...imageUrls(row.image),
    priceCents: row.price_cents,
    listPriceCents: row.list_price_cents || null,
    discountPercent: discount,
    stars: row.stars,
    ratingCount: row.rating_count,
    boughtLastMonth: row.bought_last_month,
    isBestseller: Boolean(row.is_bestseller),
    stock: row.stock,
    inStock: row.stock > 0 && Boolean(row.is_active),
    category: { slug: row.category_slug, name: row.category_name },
    department: { slug: row.department_slug, name: row.department_name },
  };
}

/** Turns free text into a safe FTS5 query: every word must match, last word as a prefix. */
export function ftsQuery(text) {
  const words = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
  if (!words.length) return null;
  return words
    .slice(0, 10)
    .map((w, i, all) => `"${w}"${i === all.length - 1 && w.length > 1 ? '*' : ''}`)
    .join(' ');
}
