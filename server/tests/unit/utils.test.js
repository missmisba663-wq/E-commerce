const slugify = require('../../src/utils/slugify');
const { isObjectId, pick, toInt, escapeRegex } = require('../../src/utils/validate');
const { parseAddress } = require('../../src/controllers/checkoutController');
const { generateOrderNumber } = require('../../src/models/Order');

describe('small helpers', () => {
  test('slugify makes URL-safe slugs', () => {
    expect(slugify('Terracotta Pot - Small')).toBe('terracotta-pot-small');
    expect(slugify('  Café Monstera!! ')).toBe('cafe-monstera');
  });

  test('isObjectId only accepts 24 hex characters', () => {
    expect(isObjectId('65f1c2a9e4b0a1b2c3d4e5f6')).toBe(true);
    expect(isObjectId('snake-plants')).toBe(false); // 12 chars, which mongoose would accept
    expect(isObjectId(undefined)).toBe(false);
  });

  test('pick copies only allowed keys that are present', () => {
    expect(pick({ name: 'Fern', role: 'admin', price: undefined }, ['name', 'price'])).toEqual({ name: 'Fern' });
    expect(pick(null, ['name'])).toEqual({});
  });

  test('toInt falls back on garbage', () => {
    expect(toInt('12', 1)).toBe(12);
    expect(toInt('abc', 1)).toBe(1);
  });

  test('escapeRegex neutralises special characters', () => {
    expect(new RegExp(escapeRegex('a.b*')).test('aXbbb')).toBe(false);
  });

  test('order numbers include the date and a random suffix', () => {
    expect(generateOrderNumber(new Date(2026, 9, 17))).toMatch(/^FL-20261017-[A-F0-9]{6}$/);
  });

  test('parseAddress trims values, defaults the country and reports missing fields', () => {
    expect(parseAddress({ fullName: ' Ana ', line1: '1 High St', city: 'Bath', postcode: 'BA1 1AA' })).toMatchObject({
      fullName: 'Ana',
      country: 'United Kingdom',
      line2: '',
    });

    expect(() => parseAddress({ fullName: 'Ana' })).toThrow(
      expect.objectContaining({
        statusCode: 400,
        details: expect.arrayContaining([expect.objectContaining({ field: 'shippingAddress.postcode' })]),
      })
    );
  });
});
