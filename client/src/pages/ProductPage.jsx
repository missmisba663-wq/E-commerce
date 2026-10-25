import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Check, Heart, MessageSquareText, PackageCheck, RotateCcw, ShieldCheck, ShoppingCart, Truck, Zap } from 'lucide-react';
import { api } from '../api/client.js';
import { ProductRail } from '../components/ProductCard.jsx';
import { Breadcrumbs, ErrorState, Pagination, Price, ProductImage, QuantitySelect, Spinner, Stars } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useFreeShippingThreshold } from '../context/ShopContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useWishlist } from '../context/WishlistContext.jsx';
import { useApi, useDocumentTitle } from '../hooks/useApi.js';
import { formatCompact, formatDate, formatMoney } from '../lib/format.js';

function deliveryWindow() {
  const fmt = (d) => d.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });
  const from = new Date(Date.now() + 3 * 86_400_000);
  const to = new Date(Date.now() + 5 * 86_400_000);
  return `${fmt(from)} – ${fmt(to)}`;
}

export default function ProductPage() {
  const { id } = useParams();
  const { data, error, loading, reload } = useApi(`/catalog/products/${id}`);
  useDocumentTitle(data?.product.title.slice(0, 70));
  const freeOver = useFreeShippingThreshold();

  if (loading && !data) return <Spinner block />;
  if (error) {
    return (
      <div className="container">
        {error.status === 404
          ? <div className="empty-state"><h1>Product not found</h1><p>It may have been removed or is no longer available.</p><Link to="/" className="btn btn-primary">Keep shopping</Link></div>
          : <ErrorState error={error} onRetry={reload} />}
      </div>
    );
  }
  const { product, related, alsoBought } = data;

  return (
    <div className="container product-page" key={product.id}>
      <Breadcrumbs items={[
        { label: 'Home', to: '/' },
        { label: product.department.name, to: `/c/${product.department.slug}` },
        { label: product.category.name, to: `/c/${product.department.slug}/${product.category.slug}` },
      ]} />
      <div className="pdp">
        <div className="pdp-gallery">
          <ProductImage src={product.imageLarge} alt={product.title} eager className="pdp-image" />
        </div>
        <div className="pdp-info">
          <h1 className="pdp-title">{product.title}</h1>
          <div className="pdp-meta">
            <Stars value={product.stars} showValue size={16} count={product.ratingCount || undefined} />
            {product.isBestseller && <span className="badge badge-bestseller">Best Seller</span>}
          </div>
          {product.boughtLastMonth > 0 && <p className="bought">{formatCompact(product.boughtLastMonth)}+ bought in past month</p>}
          <hr />
          <Price cents={product.priceCents} listCents={product.listPriceCents} discount={product.discountPercent} size="lg" />
          {product.listPriceCents > product.priceCents && (
            <p className="savings">You save {formatMoney(product.listPriceCents - product.priceCents)}</p>
          )}
          <p className="muted small">Inclusive of all taxes. Free delivery on orders over {freeOver}.</p>
          {product.highlights.length > 0 && (
            <section className="highlights">
              <h2>About this item</h2>
              <ul>{product.highlights.map((h, i) => <li key={i}>{h}</li>)}</ul>
            </section>
          )}
        </div>
        <BuyBox product={product} />
      </div>

      <ProductRail title="Customers who bought this also bought" products={alsoBought} />
      <ProductRail title={`More in ${product.category.name}`} products={related} link={`/c/${product.department.slug}/${product.category.slug}`} />
      <Reviews product={product} />
    </div>
  );
}

function BuyBox({ product }) {
  const { add, quantityOf } = useCart();
  const wishlist = useWishlist();
  const { toast, error } = useToast();
  const navigate = useNavigate();
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(null);
  const inCart = quantityOf(product.id);
  const saved = wishlist.has(product.id);

  async function addToCart(buyNow) {
    setBusy(buyNow ? 'buy' : 'add');
    try {
      await add(product.id, qty);
      if (buyNow) navigate('/checkout');
      else toast(`Added ${qty} to cart`, { action: <Link to="/cart" className="toast-link">View cart</Link> });
    } catch (e) {
      error(e.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <aside className="buy-box card">
      <Price cents={product.priceCents} size="md" />
      <p className="delivery"><Truck size={18} /> <span>Delivery <b>{deliveryWindow()}</b></span></p>
      {product.inStock ? (
        <p className={`stock ${product.stock <= 5 ? 'low' : 'ok'}`}>
          {product.stock <= 5 ? `Only ${product.stock} left in stock — order soon.` : 'In stock'}
        </p>
      ) : (
        <p className="stock out">Currently unavailable</p>
      )}
      {product.inStock && (
        <>
          <QuantitySelect id="qty" value={qty} max={product.stock} onChange={setQty} />
          <button className="btn btn-primary btn-block" onClick={() => addToCart(false)} disabled={Boolean(busy)}>
            <ShoppingCart size={18} /> {busy === 'add' ? 'Adding…' : 'Add to cart'}
          </button>
          <button className="btn btn-accent-dark btn-block" onClick={() => addToCart(true)} disabled={Boolean(busy)}>
            <Zap size={18} /> {busy === 'buy' ? 'One moment…' : 'Buy now'}
          </button>
          {inCart > 0 && <p className="in-cart"><Check size={16} /> {inCart} in your cart · <Link to="/cart">View cart</Link></p>}
        </>
      )}
      <button className={`btn btn-secondary btn-block ${saved ? 'is-saved' : ''}`} onClick={() => wishlist.toggle(product.id)}>
        <Heart size={18} fill={saved ? 'currentColor' : 'none'} /> {saved ? 'Saved to wishlist' : 'Add to wishlist'}
      </button>
      <ul className="assurances">
        <li><ShieldCheck size={16} /> Secure transaction</li>
        <li><RotateCcw size={16} /> Cancel any time before it ships</li>
        <li><PackageCheck size={16} /> Cash on delivery available</li>
      </ul>
    </aside>
  );
}

function Reviews({ product }) {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const { data, reload } = useApi(`/catalog/products/${product.id}/reviews?page=${page}`);
  const [editing, setEditing] = useState(false);

  return (
    <section className="reviews" id="reviews">
      <div className="reviews-summary">
        <h2>Customer reviews</h2>
        <div className="rating-big">
          <Stars value={product.stars} size={20} />
          <span>{product.stars.toFixed(1)} out of 5</span>
        </div>
        {product.ratingCount > 0 && <p className="muted">{product.ratingCount.toLocaleString('en-IN')} global ratings</p>}
        {data && data.total > 0 && (
          <>
            <p className="small"><b>{data.total}</b> verified ShopVerse {data.total === 1 ? 'review' : 'reviews'}</p>
            <div className="breakdown">
              {data.breakdown.map((b) => (
                <div key={b.stars} className="breakdown-row">
                  <span>{b.stars} star</span>
                  <div className="bar"><div style={{ width: `${(b.count / data.total) * 100}%` }} /></div>
                  <span className="muted">{b.count}</span>
                </div>
              ))}
            </div>
          </>
        )}
        <div className="review-cta">
          <h3>Review this product</h3>
          {!user ? (
            <p className="small muted"><Link to="/login" state={{ from: `${window.location.pathname}#reviews` }}>Sign in</Link> to share your thoughts.</p>
          ) : data?.canReview ? (
            <button className="btn btn-secondary btn-block" onClick={() => setEditing(true)}>
              {data.mine ? 'Edit your review' : 'Write a customer review'}
            </button>
          ) : (
            <p className="small muted">Reviews are from verified buyers. You can review this item after it's delivered to you.</p>
          )}
        </div>
      </div>
      <div className="reviews-list">
        {editing && <ReviewForm productId={product.id} existing={data?.mine} onDone={() => { setEditing(false); reload(); }} />}
        {!data ? <Spinner /> : data.reviews.length === 0 ? (
          <div className="empty-reviews">
            <MessageSquareText size={32} strokeWidth={1.5} />
            <p>No written reviews on ShopVerse yet. Buyers can review this product once it's delivered.</p>
          </div>
        ) : (
          <>
            {data.reviews.map((r) => (
              <article key={r.id} className="review">
                <div className="review-author"><span className="avatar">{r.author[0]}</span>{r.author}</div>
                <div className="review-head"><Stars value={r.rating} /> <b>{r.title}</b></div>
                <p className="muted small">Reviewed on {formatDate(r.createdAt)} {r.verifiedPurchase && <span className="verified">· Verified Purchase</span>}</p>
                <p className="review-body">{r.body}</p>
              </article>
            ))}
            <Pagination page={data.page} pages={data.pages} onChange={setPage} />
          </>
        )}
      </div>
    </section>
  );
}

function ReviewForm({ productId, existing, onDone }) {
  const { toast, error } = useToast();
  const [rating, setRating] = useState(existing?.rating || 5);
  const [title, setTitle] = useState(existing?.title || '');
  const [body, setBody] = useState(existing?.body || '');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.put(`/catalog/products/${productId}/reviews`, { rating, title, body });
      toast('Thanks! Your review is live.');
      onDone();
    } catch (err) {
      error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    await api.del(`/catalog/products/${productId}/reviews`);
    toast('Review deleted');
    onDone();
  }

  return (
    <form className="card review-form" onSubmit={submit}>
      <h3>{existing ? 'Edit your review' : 'Write a review'}</h3>
      <div className="star-picker" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button type="button" key={n} role="radio" aria-checked={rating === n} className={n <= rating ? 'on' : ''} onClick={() => setRating(n)} aria-label={`${n} stars`}>★</button>
        ))}
      </div>
      <label className="field"><span>Headline</span><input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required placeholder="What's most important to know?" /></label>
      <label className="field"><span>Your review</span><textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} maxLength={4000} required placeholder="What did you like or dislike?" /></label>
      <div className="row gap">
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Submitting…' : 'Submit review'}</button>
        <button type="button" className="btn btn-secondary" onClick={onDone}>Cancel</button>
        {existing && <button type="button" className="btn btn-danger-ghost" onClick={remove}>Delete</button>}
      </div>
    </form>
  );
}
