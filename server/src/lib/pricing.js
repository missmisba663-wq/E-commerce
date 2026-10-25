import { config } from '../config.js';

/** Order totals in integer cents. Shared by cart previews and order creation. */
export function computeTotals(lines) {
  const subtotal = lines.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0);
  const { freeShippingThresholdCents, shippingCents, taxRate } = config.shop;
  const shipping = subtotal === 0 || subtotal >= freeShippingThresholdCents ? 0 : shippingCents;
  const tax = Math.round(subtotal * taxRate);
  return {
    subtotalCents: subtotal,
    shippingCents: shipping,
    taxCents: tax,
    totalCents: subtotal + shipping + tax,
    freeShippingThresholdCents,
  };
}
