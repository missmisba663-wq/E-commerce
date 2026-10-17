const AppError = require('../utils/AppError');

const ORDER_STATUSES = ['paid', 'packed', 'shipped', 'delivered', 'cancelled'];

// Where an order is allowed to go next. Once it's left the warehouse it can't be cancelled.
const TRANSITIONS = {
  paid: ['packed', 'cancelled'],
  packed: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

const nextStatuses = (status) => TRANSITIONS[status] || [];

const canTransition = (from, to) => nextStatuses(from).includes(to);

// Customers can only cancel before we've started packing.
const canCustomerCancel = (status) => status === 'paid';

function applyTransition(order, to, note) {
  if (!ORDER_STATUSES.includes(to)) {
    throw new AppError(`"${to}" isn't a valid order status`, 400);
  }
  if (!canTransition(order.status, to)) {
    throw new AppError(`An order that is ${order.status} can't be moved to ${to}`, 409);
  }
  order.status = to;
  order.statusHistory.push({ status: to, note, at: new Date() });
  return order;
}

module.exports = { ORDER_STATUSES, TRANSITIONS, nextStatuses, canTransition, canCustomerCancel, applyTransition };
