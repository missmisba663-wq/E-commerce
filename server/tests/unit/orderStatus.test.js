const { applyTransition, canTransition, canCustomerCancel, nextStatuses } = require('../../src/services/orderStatus');

const makeOrder = (status) => ({ status, statusHistory: [] });

describe('order status rules', () => {
  test.each([
    ['paid', 'packed'],
    ['packed', 'shipped'],
    ['shipped', 'delivered'],
    ['paid', 'cancelled'],
    ['packed', 'cancelled'],
  ])('%s -> %s is allowed', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  test.each([
    ['paid', 'shipped'],
    ['shipped', 'cancelled'],
    ['delivered', 'paid'],
    ['cancelled', 'paid'],
  ])('%s -> %s is not allowed', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });

  test('final states have nowhere to go', () => {
    expect(nextStatuses('delivered')).toEqual([]);
    expect(nextStatuses('cancelled')).toEqual([]);
    expect(nextStatuses('made-up')).toEqual([]);
  });

  test('customers can only cancel before packing starts', () => {
    expect(canCustomerCancel('paid')).toBe(true);
    expect(canCustomerCancel('packed')).toBe(false);
    expect(canCustomerCancel('shipped')).toBe(false);
  });

  test('applyTransition updates the status and records history', () => {
    const order = makeOrder('paid');
    applyTransition(order, 'packed', 'Picked by Jo');
    expect(order.status).toBe('packed');
    expect(order.statusHistory).toEqual([expect.objectContaining({ status: 'packed', note: 'Picked by Jo' })]);
  });

  test('applyTransition rejects illegal moves with a 409 and leaves the order alone', () => {
    const order = makeOrder('shipped');
    expect(() => applyTransition(order, 'cancelled')).toThrow(expect.objectContaining({ statusCode: 409 }));
    expect(order.status).toBe('shipped');
    expect(order.statusHistory).toHaveLength(0);
  });

  test('applyTransition rejects unknown statuses with a 400', () => {
    expect(() => applyTransition(makeOrder('paid'), 'lost')).toThrow(expect.objectContaining({ statusCode: 400 }));
  });
});
