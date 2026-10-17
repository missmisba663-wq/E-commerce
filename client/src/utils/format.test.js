import { formatPrice, poundsToPence, penceToPounds, pluralise } from './format';

describe('format helpers', () => {
  test('formatPrice shows pence as pounds', () => {
    expect(formatPrice(1299)).toBe('£12.99');
    expect(formatPrice(0)).toBe('£0.00');
    expect(formatPrice(128450)).toBe('£1,284.50');
  });

  test('poundsToPence accepts what an admin would naturally type', () => {
    expect(poundsToPence('12.99')).toBe(1299);
    expect(poundsToPence('£5')).toBe(500);
    expect(poundsToPence(' 0.1 ')).toBe(10);
    expect(poundsToPence('19.999')).toBeNull();
    expect(poundsToPence('-3')).toBeNull();
    expect(poundsToPence('')).toBeNull();
  });

  test('round trip survives float weirdness', () => {
    expect(poundsToPence('1.15')).toBe(115); // 1.15 * 100 = 114.99999999999999
    expect(penceToPounds(115)).toBe('1.15');
  });

  test('pluralise', () => {
    expect(pluralise(1, 'item')).toBe('1 item');
    expect(pluralise(3, 'item')).toBe('3 items');
  });
});
