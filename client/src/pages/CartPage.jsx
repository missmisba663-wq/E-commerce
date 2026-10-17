import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import ProductImage from '../components/ProductImage';
import Alert from '../components/Alert';
import Loading from '../components/Loading';
import { formatPrice, pluralise } from '../utils/format';

export default function CartPage() {
  const { cart, loading, updateItem, removeItem } = useCart();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const run = async (productId, action) => {
    setError('');
    setBusyId(productId);
    try {
      await action();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  if (loading && cart.items.length === 0) return <Loading />;

  if (cart.items.length === 0) {
    return (
      <div className="empty-state">
        <h1>Your basket is empty</h1>
        <p>
          Nothing in here yet. <Link to="/">Have a browse</Link>
        </p>
      </div>
    );
  }

  const blocked = cart.items.some((i) => !i.inStock);

  return (
    <div className="cart-page">
      <h1>Your basket</h1>
      <Alert>{error}</Alert>

      <ul className="cart-lines">
        {cart.items.map(({ product, quantity, lineTotal, inStock }) => {
          // Lets the shopper keep a number that's now too high, so they can see it and fix it themselves.
          const options = Array.from({ length: Math.max(Math.min(product.stock, 10), quantity) }, (_, i) => i + 1);
          return (
            <li key={product._id} className="cart-line">
              {/* Same destination as the name link, so it's hidden from screen readers and skipped by Tab */}
              <Link to={`/products/${product.slug}`} aria-hidden="true" tabIndex={-1}>
                <ProductImage product={product} className="thumb" />
              </Link>
              <div className="cart-line-info">
                <Link to={`/products/${product.slug}`} className="cart-line-name">
                  {product.name}
                </Link>
                <span className="muted">{formatPrice(product.price)} each</span>
                {!inStock && (
                  <span className="stock-note out">
                    {product.stock === 0 ? 'Now out of stock' : `Only ${product.stock} available. Please lower the quantity.`}
                  </span>
                )}
              </div>
              <label className="qty">
                <span className="visually-hidden">Quantity for {product.name}</span>
                <select
                  value={quantity}
                  disabled={busyId === product._id}
                  onChange={(e) => run(product._id, () => updateItem(product._id, Number(e.target.value)))}
                >
                  {options.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <span className="line-total">{formatPrice(lineTotal)}</span>
              <button
                type="button"
                className="link-button"
                disabled={busyId === product._id}
                onClick={() => run(product._id, () => removeItem(product._id))}
                aria-label={`Remove ${product.name}`}
              >
                Remove
              </button>
            </li>
          );
        })}
      </ul>

      <aside className="cart-summary">
        <div className="summary-row">
          <span>Subtotal ({pluralise(cart.itemCount, 'item')})</span>
          <strong data-testid="cart-subtotal">{formatPrice(cart.subtotal)}</strong>
        </div>
        <p className="muted">Delivery and any discount codes are added at checkout.</p>
        <button type="button" className="primary wide" disabled={blocked} onClick={() => navigate('/checkout')}>
          Go to checkout
        </button>
        {blocked && <p className="muted">Sort out the stock issues above before checking out.</p>}
      </aside>
    </div>
  );
}
