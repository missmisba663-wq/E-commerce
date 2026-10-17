const Order = require('../models/Order');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { isObjectId } = require('../utils/validate');
const { applyTransition, canCustomerCancel } = require('../services/orderStatus');
const { releaseStock } = require('../services/inventory');

// For someone else's order we answer 404 rather than 403, so we don't even confirm it exists.
async function findOrderFor(req, { ownerOnly = false } = {}) {
  if (!isObjectId(req.params.id)) throw new AppError('Order not found', 404);

  const order = await Order.findById(req.params.id);
  if (!order) throw new AppError('Order not found', 404);

  const isOwner = order.user.equals(req.user._id);
  const isAdmin = req.user.role === 'admin';
  if (!isOwner && (ownerOnly || !isAdmin)) throw new AppError('Order not found', 404);

  return order;
}

const listMyOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1, _id: -1 });
  res.json({ orders });
});

const getOrder = asyncHandler(async (req, res) => {
  res.json({ order: await findOrderFor(req) });
});

const cancelMyOrder = asyncHandler(async (req, res) => {
  const order = await findOrderFor(req, { ownerOnly: true });

  if (!canCustomerCancel(order.status)) {
    throw new AppError(
      'This order is already being packed or is on its way, so it can no longer be cancelled online.',
      409
    );
  }

  applyTransition(order, 'cancelled', 'Cancelled by customer');
  await releaseStock(order.items);
  await order.save();

  res.json({ order });
});

module.exports = { listMyOrders, getOrder, cancelMyOrder };
