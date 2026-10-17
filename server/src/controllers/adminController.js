const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { isObjectId, pick, toInt, escapeRegex } = require('../utils/validate');
const { ORDER_STATUSES, applyTransition } = require('../services/orderStatus');
const { releaseStock } = require('../services/inventory');

const LOW_STOCK_THRESHOLD = 5;
const EDITABLE_PRODUCT_FIELDS = [
  'name',
  'slug',
  'description',
  'price',
  'category',
  'imageUrl',
  'imageCredit',
  'care',
  'stock',
  'isActive',
];

async function findProduct(id) {
  if (!isObjectId(id)) throw new AppError('Product not found', 404);
  const product = await Product.findById(id);
  if (!product) throw new AppError('Product not found', 404);
  return product;
}

/* ---------- Overview ---------- */

const getStats = asyncHandler(async (req, res) => {
  const [productCount, customerCount, orderCount, revenue, byStatus, lowStock, recentOrders] = await Promise.all([
    Product.countDocuments({ isActive: true }),
    User.countDocuments({ role: 'customer' }),
    Order.countDocuments(),
    Order.aggregate([
      { $match: { status: { $ne: 'cancelled' } } },
      { $group: { _id: null, total: { $sum: '$totals.total' } } },
    ]),
    Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Product.find({ isActive: true, stock: { $lte: LOW_STOCK_THRESHOLD } })
      .sort({ stock: 1, name: 1 })
      .limit(10)
      .select('name slug stock'),
    Order.find().sort({ createdAt: -1, _id: -1 }).limit(5).populate('user', 'name email'),
  ]);

  const ordersByStatus = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0]));
  byStatus.forEach(({ _id, count }) => {
    ordersByStatus[_id] = count;
  });

  res.json({
    stats: {
      revenue: revenue.length ? revenue[0].total : 0,
      orderCount,
      productCount,
      customerCount,
      ordersByStatus,
      lowStock,
      lowStockThreshold: LOW_STOCK_THRESHOLD,
      recentOrders,
    },
  });
});

/* ---------- Products ---------- */

const listProducts = asyncHandler(async (req, res) => {
  const filter = {};
  if (typeof req.query.search === 'string' && req.query.search.trim()) {
    filter.name = new RegExp(escapeRegex(req.query.search.trim()), 'i');
  }
  const products = await Product.find(filter).sort({ isActive: -1, name: 1 });
  res.json({ products });
});

const createProduct = asyncHandler(async (req, res) => {
  const product = await Product.create(pick(req.body, EDITABLE_PRODUCT_FIELDS));
  res.status(201).json({ product });
});

const updateProduct = asyncHandler(async (req, res) => {
  const product = await findProduct(req.params.id);
  const updates = pick(req.body, EDITABLE_PRODUCT_FIELDS);
  if (Object.keys(updates).length === 0) throw new AppError('Nothing to update', 400);

  // The slug stays the same when a product is renamed, so existing links keep working.
  Object.assign(product, updates);
  await product.save();
  res.json({ product });
});

// "Delete" archives the product. Past orders still reference it, so it can't truly go.
const archiveProduct = asyncHandler(async (req, res) => {
  const product = await findProduct(req.params.id);
  product.isActive = false;
  await product.save();
  res.json({ product });
});

/* ---------- Orders ---------- */

const listOrders = asyncHandler(async (req, res) => {
  const filter = {};
  if (ORDER_STATUSES.includes(req.query.status)) filter.status = req.query.status;

  const page = Math.max(1, toInt(req.query.page, 1));
  const limit = Math.min(100, Math.max(1, toInt(req.query.limit, 20)));

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('user', 'name email'),
    Order.countDocuments(filter),
  ]);

  res.json({ orders, page, total, totalPages: Math.max(1, Math.ceil(total / limit)) });
});

const updateOrderStatus = asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.id)) throw new AppError('Order not found', 404);
  const order = await Order.findById(req.params.id);
  if (!order) throw new AppError('Order not found', 404);

  const { status, note } = req.body || {};
  const cleanNote = typeof note === 'string' && note.trim() ? note.trim().slice(0, 200) : undefined;

  applyTransition(order, status, cleanNote);
  if (status === 'cancelled') await releaseStock(order.items);
  await order.save();
  await order.populate('user', 'name email');

  res.json({ order });
});

module.exports = {
  getStats,
  listProducts,
  createProduct,
  updateProduct,
  archiveProduct,
  listOrders,
  updateOrderStatus,
  LOW_STOCK_THRESHOLD,
};
