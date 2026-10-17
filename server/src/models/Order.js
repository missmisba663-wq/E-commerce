const crypto = require('crypto');
const mongoose = require('mongoose');
const { ORDER_STATUSES } = require('../services/orderStatus');

const { Schema } = mongoose;

// A snapshot of what was bought, at the price it was bought for.
const orderItemSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const addressSchema = new Schema(
  {
    fullName: { type: String, required: true },
    line1: { type: String, required: true },
    line2: { type: String, default: '' },
    city: { type: String, required: true },
    postcode: { type: String, required: true },
    country: { type: String, default: 'United Kingdom' },
  },
  { _id: false }
);

const orderSchema = new Schema(
  {
    orderNumber: { type: String, unique: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    items: {
      type: [orderItemSchema],
      validate: { validator: (items) => items.length > 0, message: 'An order needs at least one item' },
    },
    shippingAddress: { type: addressSchema, required: true },
    totals: {
      subtotal: { type: Number, required: true },
      discount: { type: Number, default: 0 },
      shipping: { type: Number, default: 0 },
      vat: { type: Number, default: 0 },
      total: { type: Number, required: true },
    },
    discountCode: { type: String, default: null },
    payment: {
      method: { type: String, default: 'card' },
      last4: String,
      transactionId: String,
    },
    status: { type: String, enum: ORDER_STATUSES, default: 'paid', index: true },
    statusHistory: [
      new Schema(
        { status: String, note: String, at: { type: Date, default: Date.now } },
        { _id: false }
      ),
    ],
  },
  { timestamps: true }
);

function generateOrderNumber(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const day = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  return `FL-${day}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

orderSchema.pre('validate', function prepareNewOrder() {
  if (!this.orderNumber) this.orderNumber = generateOrderNumber();
  if (this.isNew && this.statusHistory.length === 0) {
    this.statusHistory.push({ status: this.status, note: 'Payment received' });
  }
});

module.exports = mongoose.model('Order', orderSchema);
module.exports.generateOrderNumber = generateOrderNumber;
