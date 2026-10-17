const Cart = require('../models/Cart');
const Product = require('../models/Product');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { isObjectId } = require('../utils/validate');

const MAX_QTY = 99;

function parseQuantity(value, min) {
  const qty = Number(value);
  if (!Number.isInteger(qty) || qty < min || qty > MAX_QTY) {
    throw new AppError(`Quantity must be a whole number between ${min} and ${MAX_QTY}`, 400);
  }
  return qty;
}

function stockMessage(product) {
  return product.stock === 0
    ? `${product.name} is out of stock`
    : `Only ${product.stock} of ${product.name} left in stock`;
}

const findOrCreateCart = async (userId) =>
  (await Cart.findOne({ user: userId })) || new Cart({ user: userId, items: [] });

// Builds the response the client gets, and quietly removes anything that's been archived since it was added.
async function sendCart(res, cart, status = 200) {
  await cart.populate('items.product');
  const live = cart.items.filter((item) => item.product && item.product.isActive);

  if (!cart.isNew && live.length !== cart.items.length) {
    await Cart.updateOne(
      { _id: cart._id },
      { $set: { items: live.map((i) => ({ product: i.product._id, quantity: i.quantity })) } }
    );
  }

  const items = live.map(({ product, quantity }) => ({
    product: {
      _id: product._id,
      name: product.name,
      slug: product.slug,
      price: product.price,
      imageUrl: product.imageUrl,
      category: product.category,
      stock: product.stock,
    },
    quantity,
    lineTotal: product.price * quantity,
    inStock: product.stock >= quantity,
  }));

  res.status(status).json({
    cart: {
      items,
      itemCount: items.reduce((n, i) => n + i.quantity, 0),
      subtotal: items.reduce((sum, i) => sum + i.lineTotal, 0),
    },
  });
}

const getCart = asyncHandler(async (req, res) => {
  await sendCart(res, await findOrCreateCart(req.user._id));
});

const addItem = asyncHandler(async (req, res) => {
  const { productId, quantity = 1 } = req.body || {};
  if (!isObjectId(productId)) throw new AppError('A valid productId is required', 400);
  const qty = parseQuantity(quantity, 1);

  const product = await Product.findOne({ _id: productId, isActive: true });
  if (!product) throw new AppError('That product is no longer available', 404);

  const cart = await findOrCreateCart(req.user._id);
  const existing = cart.items.find((item) => item.product.equals(product._id));
  const newQty = (existing ? existing.quantity : 0) + qty;

  if (newQty > MAX_QTY) throw new AppError(`You can have at most ${MAX_QTY} of one item`, 400);
  if (newQty > product.stock) throw new AppError(stockMessage(product), 409);

  if (existing) existing.quantity = newQty;
  else cart.items.push({ product: product._id, quantity: qty });

  await cart.save();
  await sendCart(res, cart);
});

const updateItem = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  if (!isObjectId(productId)) throw new AppError('A valid productId is required', 400);
  const qty = parseQuantity(req.body && req.body.quantity, 0);

  const cart = await Cart.findOne({ user: req.user._id });
  const item = cart && cart.items.find((i) => i.product.equals(productId));
  if (!item) throw new AppError("That item isn't in your basket", 404);

  if (qty === 0) {
    cart.items = cart.items.filter((i) => !i.product.equals(productId));
  } else {
    const product = await Product.findOne({ _id: productId, isActive: true });
    if (!product) throw new AppError('That product is no longer available', 404);
    if (qty > product.stock) throw new AppError(stockMessage(product), 409);
    item.quantity = qty;
  }

  await cart.save();
  await sendCart(res, cart);
});

const removeItem = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  if (!isObjectId(productId)) throw new AppError('A valid productId is required', 400);

  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart || !cart.items.some((i) => i.product.equals(productId))) {
    throw new AppError("That item isn't in your basket", 404);
  }

  cart.items = cart.items.filter((i) => !i.product.equals(productId));
  await cart.save();
  await sendCart(res, cart);
});

const clearCart = asyncHandler(async (req, res) => {
  await Cart.updateOne({ user: req.user._id }, { $set: { items: [] } });
  res.json({ cart: { items: [], itemCount: 0, subtotal: 0 } });
});

module.exports = { getCart, addItem, updateItem, removeItem, clearCart };
