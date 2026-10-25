import { Link, useNavigate } from 'react-router';
import { AlertTriangle, ShoppingCart, Trash2, Truck } from 'lucide-react';
import { EmptyState, Price, ProductImage, QuantitySelect, Spinner } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useDocumentTitle } from '../hooks/useApi.js';
import { formatMoney, productPath } from '../lib/format.js';

export function OrderTotals({ totals, count }) {
  const toFree = totals.freeShippingThresholdCents - totals.subtotalCents;
  return (
    <dl className="totals">
      <div><dt>Items ({count})</dt><dd>{formatMoney(totals.subtotalCents)}</dd></div>
      <div><dt>Delivery</dt><dd>{totals.shippingCents ? formatMoney(totals.shippingCents) : <span className="free">FREE</span>}</dd></div>
      {totals.taxCents > 0 && <div><dt>Estimated tax</dt><dd>{formatMoney(totals.taxCents)}</dd></div>}
      <div className="totals-grand"><dt>Order total</dt><dd>{formatMoney(totals.totalCents)}</dd></div>
      {!totals.taxCents && <p className="small muted totals-note">Inclusive of all taxes (GST)</p>}
      {toFree > 0 && totals.subtotalCents > 0 && (
        <p className="free-ship-hint"><Truck size={16} /> Add {formatMoney(toFree)} more for FREE delivery</p>
      )}
    </dl>
  );
}

export default function CartPage() {
  useDocumentTitle('Shopping cart');
  const { cart, loading, count, update, remove } = useCart();
  const { user } = useAuth();
  const { error } = useToast();
  const navigate = useNavigate();

  if (loading) return <Spinner block />;
  if (!cart.items.length) {
    return (
      <div className="container">
        <EmptyState icon={ShoppingCart} title="Your cart is empty" action={<Link to="/" className="btn btn-primary">Start shopping</Link>}>
          {user ? 'Find something you love among 138,000+ products.' : 'Sign in to see items you added previously, or start shopping.'}
        </EmptyState>
      </div>
    );
  }

  const run = (p) => p.catch((e) => error(e.message));
  const purchasable = cart.items.filter((i) => i.product.inStock);

  return (
    <div className="container cart-page">
      <section className="card cart-items">
        <div className="cart-head">
          <h1>Shopping cart</h1>
          <span className="muted">Price</span>
        </div>
        {cart.warnings.length > 0 && (
          <div className="alert alert-warning">
            <AlertTriangle size={18} />
            <ul>{cart.warnings.map((w) => <li key={w.productId}>{w.message}</li>)}</ul>
          </div>
        )}
        {cart.items.map(({ product, quantity }) => (
          <article key={product.id} className={`cart-line ${product.inStock ? '' : 'unavailable'}`}>
            <Link to={productPath(product)} className="cart-line-img"><ProductImage src={product.image} alt="" /></Link>
            <div className="cart-line-info">
              <Link to={productPath(product)} className="cart-line-title">{product.title}</Link>
              <p className={`stock small ${product.inStock ? (product.stock <= 5 ? 'low' : 'ok') : 'out'}`}>
                {!product.inStock ? 'Out of stock' : product.stock <= 5 ? `Only ${product.stock} left` : 'In stock'}
              </p>
              <div className="cart-line-actions">
                {product.inStock && <QuantitySelect value={quantity} max={product.stock} onChange={(q) => run(update(product.id, q))} />}
                <button className="link-btn" onClick={() => run(remove(product.id))}><Trash2 size={15} /> Delete</button>
              </div>
            </div>
            <div className="cart-line-price">
              <Price cents={product.priceCents * quantity} />
              {quantity > 1 && <span className="muted small">{formatMoney(product.priceCents)} each</span>}
            </div>
          </article>
        ))}
        <p className="cart-subtotal">Subtotal ({count} {count === 1 ? 'item' : 'items'}): <b>{formatMoney(cart.subtotalCents)}</b></p>
      </section>

      <aside className="card cart-summary">
        <OrderTotals totals={cart} count={purchasable.reduce((n, i) => n + i.quantity, 0)} />
        <button className="btn btn-primary btn-block btn-lg" disabled={!purchasable.length}
          onClick={() => navigate(user ? '/checkout' : '/login', { state: { from: '/checkout', reason: 'Sign in to check out' } })}>
          Proceed to checkout
        </button>
        {!user && <p className="small muted center">You'll sign in or create an account at checkout. Your cart will be saved.</p>}
      </aside>
    </div>
  );
}
