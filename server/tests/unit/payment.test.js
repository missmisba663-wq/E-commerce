const { passesLuhn, isExpired, validateCard, charge } = require('../../src/services/payment');

const card = (overrides = {}) => ({ cardNumber: '4242 4242 4242 4242', expiry: '12/39', cvc: '123', ...overrides });

describe('sandbox payments', () => {
  test('Luhn check accepts real test numbers and rejects typos', () => {
    expect(passesLuhn('4242424242424242')).toBe(true);
    expect(passesLuhn('4000000000000002')).toBe(true);
    expect(passesLuhn('4242424242424241')).toBe(false);
  });

  test('a card is valid until the end of its expiry month', () => {
    const midJune2026 = new Date(2026, 5, 15);
    expect(isExpired(6, 2026, midJune2026)).toBe(false);
    expect(isExpired(5, 2026, midJune2026)).toBe(true);
  });

  test('validateCard returns the last four digits', () => {
    expect(validateCard(card())).toEqual({ digits: '4242424242424242', last4: '4242' });
  });

  test('validateCard lists every problem at once', () => {
    let error;
    try {
      validateCard({ cardNumber: '1234', expiry: '13/30', cvc: '1' });
    } catch (err) {
      error = err;
    }
    expect(error.statusCode).toBe(400);
    expect(error.details.map((d) => d.field)).toEqual(['payment.cardNumber', 'payment.expiry', 'payment.cvc']);
  });

  test('expired cards are refused', () => {
    expect(() => validateCard(card({ expiry: '01/20' }))).toThrow(/check your card/);
  });

  test('charge approves a good card', async () => {
    const result = await charge({ amount: 1999, card: card() });
    expect(result).toMatchObject({ last4: '4242', amount: 1999 });
    expect(result.transactionId).toMatch(/^txn_[a-f0-9]{16}$/);
  });

  test('charge declines the decline test card with a 402', async () => {
    await expect(charge({ amount: 1999, card: card({ cardNumber: '4000000000000002' }) })).rejects.toMatchObject({
      statusCode: 402,
    });
  });
});
