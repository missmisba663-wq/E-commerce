import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { checkoutApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import TotalsTable from '../components/TotalsTable';
import Alert from '../components/Alert';
import { formatPrice } from '../utils/format';

const ADDRESS_FIELDS = [
  { name: 'fullName', label: 'Full name', autoComplete: 'name' },
  { name: 'line1', label: 'Address line 1', autoComplete: 'address-line1' },
  { name: 'line2', label: 'Address line 2 (optional)', autoComplete: 'address-line2', optional: true },
  { name: 'city', label: 'Town or city', autoComplete: 'address-level2' },
  { name: 'postcode', label: 'Postcode', autoComplete: 'postal-code' },
];

function Field({ id, label, error, ...inputProps }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} {...inputProps} />
      {error && (
        <span className="field-error" id={`${id}-error`}>
          {error}
        </span>
      )}
    </div>
  );
}

export default function CheckoutPage() {
  const { user } = useAuth();
  const { cart, reset } = useCart();
  const navigate = useNavigate();

  const [address, setAddress] = useState({ fullName: user?.name || '', line1: '', line2: '', city: '', postcode: '' });
  const [card, setCard] = useState({ cardNumber: '', expiry: '', cvc: '' });
  const [codeInput, setCodeInput] = useState('');
  const [appliedCode, setAppliedCode] = useState('');
  const [quote, setQuote] = useState(null);
  const [codeError, setCodeError] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    if (cart.items.length === 0) return;
    checkoutApi
      .quote()
      .then((res) => setQuote(res.totals))
      .catch((err) => setError(err.message));
    // We only want the opening quote here. Applying a code fetches its own quote later.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (cart.items.length === 0 && !placing) return <Navigate to="/cart" replace />;

  const applyCode = async (event) => {
    event.preventDefault();
    setCodeError('');
    try {
      const res = await checkoutApi.quote(codeInput.trim());
      setQuote(res.totals);
      setAppliedCode(res.totals.discountCode || '');
    } catch (err) {
      setCodeError(err.message);
    }
  };

  const removeCode = async () => {
    setAppliedCode('');
    setCodeInput('');
    const res = await checkoutApi.quote();
    setQuote(res.totals);
  };

  const placeOrder = async (event) => {
    event.preventDefault();
    setError('');
    setFieldErrors({});
    setPlacing(true);
    try {
      const { order } = await checkoutApi.placeOrder({
        shippingAddress: address,
        discountCode: appliedCode || undefined,
        payment: card,
      });
      reset();
      navigate(`/orders/${order._id}?placed=1`, { replace: true });
    } catch (err) {
      setError(err.message);
      setFieldErrors(err.fieldErrors || {});
      setPlacing(false);
    }
  };

  return (
    <div className="checkout-page">
      <h1>Checkout</h1>

      <form className="checkout-form" onSubmit={placeOrder} noValidate>
        <section>
          <h2>Delivery address</h2>
          {ADDRESS_FIELDS.map((f) => (
            <Field
              key={f.name}
              id={f.name}
              label={f.label}
              autoComplete={f.autoComplete}
              required={!f.optional}
              value={address[f.name]}
              error={fieldErrors[`shippingAddress.${f.name}`]}
              onChange={(e) => setAddress({ ...address, [f.name]: e.target.value })}
            />
          ))}
          <p className="muted">We currently deliver within the UK only.</p>
        </section>

        <section>
          <h2>Payment</h2>
          <p className="sandbox-note">
            This is a demo shop, so no real money moves. Use card <code>4242 4242 4242 4242</code> with any future
            expiry and any CVC. Card <code>4000 0000 0000 0002</code> will be declined.
          </p>
          <Field
            id="cardNumber"
            label="Card number"
            inputMode="numeric"
            autoComplete="cc-number"
            value={card.cardNumber}
            error={fieldErrors['payment.cardNumber']}
            onChange={(e) => setCard({ ...card, cardNumber: e.target.value })}
          />
          <div className="field-row">
            <Field
              id="expiry"
              label="Expiry (MM/YY)"
              autoComplete="cc-exp"
              placeholder="MM/YY"
              value={card.expiry}
              error={fieldErrors['payment.expiry']}
              onChange={(e) => setCard({ ...card, expiry: e.target.value })}
            />
            <Field
              id="cvc"
              label="CVC"
              inputMode="numeric"
              autoComplete="cc-csc"
              value={card.cvc}
              error={fieldErrors['payment.cvc']}
              onChange={(e) => setCard({ ...card, cvc: e.target.value })}
            />
          </div>
        </section>

        <aside className="checkout-summary">
          <h2>Order summary</h2>
          <ul className="summary-lines">
            {cart.items.map(({ product, quantity, lineTotal }) => (
              <li key={product._id}>
                <span>
                  {quantity} × {product.name}
                </span>
                <span>{formatPrice(lineTotal)}</span>
              </li>
            ))}
          </ul>

          <div className="discount-form">
            {appliedCode ? (
              <p>
                Code <strong>{appliedCode}</strong> applied.{' '}
                <button type="button" className="link-button" onClick={removeCode}>
                  Remove
                </button>
              </p>
            ) : (
              <>
                <label htmlFor="discountCode">Discount code</label>
                <div className="search-row">
                  <input id="discountCode" value={codeInput} onChange={(e) => setCodeInput(e.target.value)} />
                  <button type="button" onClick={applyCode} disabled={!codeInput.trim()}>
                    Apply
                  </button>
                </div>
                {codeError && <span className="field-error">{codeError}</span>}
              </>
            )}
          </div>

          <TotalsTable totals={quote} discountCode={appliedCode} />
          <Alert>{error}</Alert>

          <button type="submit" className="primary wide" disabled={placing || !quote}>
            {placing ? 'Placing order…' : quote ? `Pay ${formatPrice(quote.total)}` : 'Pay'}
          </button>
        </aside>
      </form>
    </div>
  );
}
