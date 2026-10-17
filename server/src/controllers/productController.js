const Product = require('../models/Product');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { toInt, isObjectId, escapeRegex } = require('../utils/validate');

const { CATEGORIES } = Product;

const SORTS = {
  newest: { createdAt: -1 },
  price_asc: { price: 1 },
  price_desc: { price: -1 },
  name: { name: 1 },
};

const listProducts = asyncHandler(async (req, res) => {
  const { search, category, sort, minPrice, maxPrice } = req.query;
  const filter = { isActive: true };

  if (CATEGORIES.includes(category)) filter.category = category;

  if (typeof search === 'string' && search.trim()) {
    const pattern = new RegExp(escapeRegex(search.trim()), 'i');
    filter.$or = [{ name: pattern }, { description: pattern }];
  }

  const min = toInt(minPrice, null);
  const max = toInt(maxPrice, null);
  if (min !== null || max !== null) {
    filter.price = {};
    if (min !== null) filter.price.$gte = min;
    if (max !== null) filter.price.$lte = max;
  }

  const page = Math.max(1, toInt(req.query.page, 1));
  const limit = Math.min(50, Math.max(1, toInt(req.query.limit, 12)));

  const [products, total] = await Promise.all([
    Product.find(filter)
      .sort({ ...(SORTS[sort] || SORTS.newest), _id: 1 }) // _id keeps pages stable when sort keys tie
      .skip((page - 1) * limit)
      .limit(limit),
    Product.countDocuments(filter),
  ]);

  res.json({ products, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) });
});

const listCategories = asyncHandler(async (req, res) => {
  const counts = await Product.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: '$category', count: { $sum: 1 } } },
  ]);
  const byName = Object.fromEntries(counts.map((c) => [c._id, c.count]));
  res.json({ categories: CATEGORIES.map((name) => ({ name, count: byName[name] || 0 })) });
});

const getProduct = asyncHandler(async (req, res) => {
  const { idOrSlug } = req.params;
  const query = isObjectId(idOrSlug) ? { _id: idOrSlug } : { slug: idOrSlug.toLowerCase() };

  const product = await Product.findOne({ ...query, isActive: true });
  if (!product) throw new AppError("We couldn't find that product", 404);

  res.json({ product });
});

module.exports = { listProducts, listCategories, getProduct };
