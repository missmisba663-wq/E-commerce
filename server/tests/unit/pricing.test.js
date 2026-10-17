const {
  calculateSubtotal,
  calculateShipping,
  resolveDiscount,
  calculateTotals,
  vatIncludedIn,
  STANDARD_SHIPPING,
  FREE_SHIPPING_FROM,
} = require('../../src/services/pricing');

describe('pricing', () => {
  const basket = [
    { price: 1299, quantity: 2 },
    { price: 450, quantity: 1 },
  ];

  test('subtotal multiplies price by quantity for each line', () => {
    expect(calculateSubtotal(basket)).toBe(3048);
    expect(calculateSubtotal([])).toBe(0);
  });

  describe('shipping', () => {
    test('charges standard delivery below the threshold', () => {
      expect(calculateShipping(FREE_SHIPPING_FROM - 1)).toBe(STANDARD_SHIPPING);
    });

    test('is free at or above the threshold', () => {
      expect(calculateShipping(FREE_SHIPPING_FROM)).toBe(0);
      expect(calculateShipping(FREE_SHIPPING_FROM + 1000)).toBe(0);
    });

    test('is free when a free-shipping code is used, and never charged on an empty amount', () => {
      expect(calculateShipping(1000, true)).toBe(0);
      expect(calculateShipping(0)).toBe(0);
    });
  });

  describe('discount codes', () => {
    test('no code means no discount', () => {
      expect(resolveDiscount('', 3000)).toEqual({ code: null, amount: 0, freeShipping: false });
      expect(resolveDiscount(undefined, 3000).amount).toBe(0);
    });

    test('percent codes round to the nearest penny and ignore case and spaces', () => {
      expect(resolveDiscount('  welcome10 ', 3048)).toEqual({ code: 'WELCOME10', amount: 305, freeShipping: false });
    });

    test('fixed codes respect their minimum spend', () => {
      expect(resolveDiscount('GREEN5', 3000).amount).toBe(500);
      expect(() => resolveDiscount('GREEN5', 2999)).toThrow(/£30.00 or more/);
    });

    test('FREESHIP gives free delivery but no money off', () => {
      expect(resolveDiscount('FREESHIP', 1000)).toEqual({ code: 'FREESHIP', amount: 0, freeShipping: true });
    });

    test('unknown codes are rejected with a 400', () => {
      expect(() => resolveDiscount('HALFPRICE', 3000)).toThrow(expect.objectContaining({ statusCode: 400 }));
    });
  });

  describe('calculateTotals', () => {
    test('a small basket pays delivery', () => {
      expect(calculateTotals(basket)).toMatchObject({
        subtotal: 3048,
        discount: 0,
        shipping: STANDARD_SHIPPING,
        total: 3048 + STANDARD_SHIPPING,
        discountCode: null,
      });
    });

    test('the free-delivery threshold is checked after the discount', () => {
      // £52 basket, minus 10% is £46.80, which is under £50, so delivery is charged again.
      const totals = calculateTotals([{ price: 5200, quantity: 1 }], 'WELCOME10');
      expect(totals.discount).toBe(520);
      expect(totals.shipping).toBe(STANDARD_SHIPPING);
      expect(totals.total).toBe(5200 - 520 + STANDARD_SHIPPING);
    });

    test('VAT is reported as the portion already included in the total', () => {
      const totals = calculateTotals([{ price: 3000, quantity: 2 }]);
      expect(totals.total).toBe(6000);
      expect(totals.vat).toBe(1000);
      expect(vatIncludedIn(120)).toBe(20);
    });
  });
});
