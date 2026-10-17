import { formatPrice } from '../utils/format';

export default function TotalsTable({ totals, discountCode }) {
  if (!totals) return null;
  return (
    <dl className="totals">
      <div>
        <dt>Subtotal</dt>
        <dd>{formatPrice(totals.subtotal)}</dd>
      </div>
      {totals.discount > 0 && (
        <div className="discount">
          <dt>Discount{discountCode ? ` (${discountCode})` : ''}</dt>
          <dd>−{formatPrice(totals.discount)}</dd>
        </div>
      )}
      <div>
        <dt>Delivery</dt>
        <dd>{totals.shipping === 0 ? 'Free' : formatPrice(totals.shipping)}</dd>
      </div>
      <div className="grand-total">
        <dt>Total</dt>
        <dd>{formatPrice(totals.total)}</dd>
      </div>
      <p className="vat-note">Includes {formatPrice(totals.vat)} VAT</p>
    </dl>
  );
}
