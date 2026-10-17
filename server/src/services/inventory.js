const Product = require('../models/Product');
const AppError = require('../utils/AppError');

/**
 * Takes stock for each line, one product at a time.
 *
 * The filter on `stock: { $gte: quantity }` makes each decrement atomic, so two people
 * can't both buy the last plant. If any line fails, we put back everything we already
 * took. That way it works on a standalone MongoDB as well, without needing transactions.
 */
async function reserveStock(items) {
  const reserved = [];

  for (const item of items) {
    const result = await Product.updateOne(
      { _id: item.product, isActive: true, stock: { $gte: item.quantity } },
      { $inc: { stock: -item.quantity } }
    );

    if (result.modifiedCount === 0) {
      await releaseStock(reserved);
      throw new AppError(`Sorry, there isn't enough "${item.name}" left to complete your order`, 409);
    }
    reserved.push(item);
  }

  return reserved;
}

async function releaseStock(items) {
  await Promise.all(
    items.map((item) => Product.updateOne({ _id: item.product }, { $inc: { stock: item.quantity } }))
  );
}

module.exports = { reserveStock, releaseStock };
