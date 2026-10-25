import { describe, expect, it } from 'vitest';
import { qs } from '../api/client.js';
import { formatDate, formatMoney, plural, productPath } from '../lib/format.js';

describe('format helpers', () => {
  it('formats paise as Indian rupees with Indian digit grouping', () => {
    expect(formatMoney(109900)).toBe('₹1,099');
    expect(formatMoney(12499900)).toBe('₹1,24,999');
    expect(formatMoney(129950)).toBe('₹1,299.50');
    expect(formatMoney(0)).toBe('₹0');
  });

  it('treats SQLite timestamps as UTC', () => {
    expect(formatDate('2026-01-15 23:30:00')).toMatch(/1[56] Jan 2026/);
  });

  it('builds product paths and plurals', () => {
    expect(productPath({ id: 42, slug: 'red-shoes' })).toBe('/p/42/red-shoes');
    expect(plural(1, 'item')).toBe('1 item');
    expect(plural(125000, 'item')).toBe('1,25,000 items');
  });

  it('builds query strings without empty values', () => {
    expect(qs({ q: 'lego set', page: 2, sale: null, inStock: false, category: '' })).toBe('?q=lego+set&page=2');
    expect(qs({})).toBe('');
  });
});
