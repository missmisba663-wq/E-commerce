import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { Banknote, CreditCard, Lock, MapPin, Plus } from 'lucide-react';
import { api } from '../api/client.js';
import AddressForm from '../components/AddressForm.jsx';
import { ProductImage, Spinner } from '../components/ui.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useShop } from '../context/ShopContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useApi, useDocumentTitle } from '../hooks/useApi.js';
import { formatMoney } from '../lib/format.js';
import { OrderTotals } from './CartPage.jsx';

export default function CheckoutPage() {
  useDocumentTitle('Checkout');
  const { cart, loading, refresh } = useCart();
  const { config } = useShop();
  const { error } = useToast();
  const navigate = useNavigate();
  const addresses = useApi('/account/addresses');
  const [addressId, setAddressId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [payment, setPayment] = useState('cod');
  const [placing, setPlacing] = useState(false);
  const [problem, setProblem] = useState(null);

  const list = addresses.data?.addresses || [];
  useEffect(() => {
    if (addresses.data && !addressId) {
      if (list.length) setAddressId(list[0].id);
      else setAdding(true);
    }
  }, [addresses.data]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (config?.cardPayments) setPayment('card');
  }, [config?.cardPayments]);

  if (loading || addresses.loading) return <Spinner block />;
  const items = cart.items.filter((i) => i.product.inStock);
  if (!items.length && !placing) return <Navigate to="/cart" replace />;

  async function saveAddress(a) {
    const res = await api.post('/account/addresses', a);
    addresses.setData({ addresses: res.addresses });
    setAddressId(res.id);
    setAdding(false);
  }

  async function placeOrder() {
    setPlacing(true);
    setProblem(null);
    try {
      const { order, checkoutUrl } = await api.post('/orders', { addressId, paymentMethod: payment });
      if (checkoutUrl) {
        window.location.assign(checkoutUrl);
        return;
      }
      await refresh();
      navigate(`/orders/${order.id}?placed=1`, { replace: true });
    } catch (e) {
      setProblem(e.message);
      if (e.status === 409) refresh();
      else error(e.message);
      setPlacing(false);
    }
  }

  const count = items.reduce((n, i) => n + i.quantity, 0);
  const selected = list.find((a) => a.id === addressId);

  return (
    <div className="container checkout">
      <h1>Checkout <span className="muted">({count} {count === 1 ? 'item' : 'items'})</span></h1>
      <div className="checkout-grid">
        <div className="checkout-steps">
          <section className="card step">
            <h2><span className="step-num">1</span> Delivery address</h2>
            {list.length > 0 && !adding && (
              <div className="address-options">
                {list.map((a) => (
                  <label key={a.id} className={`address-option ${a.id === addressId ? 'selected' : ''}`}>
                    <input type="radio" name="address" checked={a.id === addressId} onChange={() => setAddressId(a.id)} />
                    <span>
                      <b>{a.fullName}</b> {a.isDefault && <span className="badge">Default</span>}<br />
                      {a.line1}{a.line2 && `, ${a.line2}`}, {a.city}, {a.state} {a.postalCode}, {a.country}<br />
                      <span className="muted">Phone: {a.phone}</span>
                    </span>
                  </label>
                ))}
                <button className="link-btn" onClick={() => setAdding(true)}><Plus size={16} /> Add a new address</button>
              </div>
            )}
            {adding && (
              <AddressForm onSubmit={saveAddress} submitLabel="Use this address" onCancel={list.length ? () => setAdding(false) : undefined} />
            )}
          </section>

          <section className="card step">
            <h2><span className="step-num">2</span> Payment method</h2>
            <div className="payment-options">
              <label className={`payment-option ${payment === 'card' ? 'selected' : ''} ${config?.cardPayments ? '' : 'disabled'}`}>
                <input type="radio" name="payment" value="card" checked={payment === 'card'} disabled={!config?.cardPayments} onChange={() => setPayment('card')} />
                <CreditCard size={22} />
                <span>
                  <b>Credit or debit card</b><br />
                  <span className="muted small">
                    {config?.cardPayments ? 'Pay securely on Stripe Checkout. Visa, Mastercard, RuPay and more.' : 'Card payments are not enabled on this store yet.'}
                  </span>
                </span>
              </label>
              <label className={`payment-option ${payment === 'cod' ? 'selected' : ''}`}>
                <input type="radio" name="payment" value="cod" checked={payment === 'cod'} onChange={() => setPayment('cod')} />
                <Banknote size={22} />
                <span><b>Cash on delivery</b><br /><span className="muted small">Pay when your order arrives.</span></span>
              </label>
            </div>
          </section>

          <section className="card step">
            <h2><span className="step-num">3</span> Review items</h2>
            <ul className="review-items">
              {items.map(({ product, quantity }) => (
                <li key={product.id}>
                  <ProductImage src={product.image} alt="" />
                  <span className="review-item-title">{product.title}</span>
                  <span className="muted">× {Math.min(quantity, product.stock)}</span>
                  <b>{formatMoney(product.priceCents * Math.min(quantity, product.stock))}</b>
                </li>
              ))}
            </ul>
            <Link to="/cart" className="link small">Change quantities in your cart</Link>
          </section>
        </div>

        <aside className="card checkout-summary">
          {problem && <div className="alert alert-error">{problem}</div>}
          <button className="btn btn-primary btn-block btn-lg" onClick={placeOrder} disabled={placing || !selected || adding}>
            <Lock size={18} /> {placing ? 'Placing your order…' : payment === 'card' ? 'Continue to payment' : 'Place your order'}
          </button>
          {selected && (
            <p className="small muted ship-to"><MapPin size={14} /> Delivering to {selected.fullName}, {selected.city}</p>
          )}
          <OrderTotals totals={cart} count={count} />
          <p className="small muted">By placing your order you agree to ShopVerse's conditions of use. You can cancel any time before your order ships.</p>
        </aside>
      </div>
    </div>
  );
}
