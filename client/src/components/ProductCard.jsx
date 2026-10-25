import { useState } from 'react';
import { Link } from 'react-router';
import { Heart, ShoppingCart, Check } from 'lucide-react';
import { useCart } from '../context/CartContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useWishlist } from '../context/WishlistContext.jsx';
import { formatCompact, productPath } from '../lib/format.js';
import { Price, ProductImage, Stars } from './ui.jsx';

export default function ProductCard({ product, compact = false }) {
  const { add } = useCart();
  const wishlist = useWishlist();
  const { toast, error } = useToast();
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const saved = wishlist.has(product.id);
  const href = productPath(product);

  async function addToCart() {
    setAdding(true);
    try {
      await add(product.id, 1);
      setAdded(true);
      toast('Added to cart');
      setTimeout(() => setAdded(false), 1500);
    } catch (e) {
      error(e.message);
    } finally {
      setAdding(false);
    }
  }

  return (
    <article className={`product-card ${compact ? 'compact' : ''}`}>
      <Link to={href} className="product-card-media" tabIndex={-1} aria-hidden="true">
        <ProductImage src={product.image} alt="" />
        <div className="card-badges">
          {product.isBestseller && <span className="badge badge-bestseller">Best Seller</span>}
          {product.discountPercent >= 5 && <span className="badge badge-deal">{product.discountPercent}% off</span>}
        </div>
      </Link>
      <button
        className={`wish-btn ${saved ? 'saved' : ''}`}
        onClick={() => wishlist.toggle(product.id)}
        aria-label={saved ? 'Remove from wishlist' : 'Save to wishlist'}
        aria-pressed={saved}
      >
        <Heart size={18} fill={saved ? 'currentColor' : 'none'} />
      </button>
      <div className="product-card-body">
        <Link to={href} className="product-card-title" title={product.title}>{product.title}</Link>
        <Stars value={product.stars} count={product.ratingCount || undefined} />
        {product.boughtLastMonth > 0 && !compact && (
          <p className="bought">{formatCompact(product.boughtLastMonth)}+ bought in past month</p>
        )}
        <Price cents={product.priceCents} listCents={product.listPriceCents} discount={product.discountPercent} />
        {!compact && (
          product.inStock ? (
            <button className="btn btn-primary btn-sm btn-block" onClick={addToCart} disabled={adding}>
              {added ? <Check size={16} /> : <ShoppingCart size={16} />}
              {added ? 'Added' : adding ? 'Adding…' : 'Add to cart'}
            </button>
          ) : (
            <button className="btn btn-secondary btn-sm btn-block" disabled>Out of stock</button>
          )
        )}
      </div>
    </article>
  );
}

export function ProductGrid({ products }) {
  return (
    <div className="product-grid">
      {products.map((p) => <ProductCard key={p.id} product={p} />)}
    </div>
  );
}

export function ProductRail({ title, products, link, linkLabel = 'See all' }) {
  if (!products?.length) return null;
  return (
    <section className="rail">
      <div className="section-head">
        <h2>{title}</h2>
        {link && <Link to={link} className="link">{linkLabel}</Link>}
      </div>
      <div className="rail-track">
        {products.map((p) => <ProductCard key={p.id} product={p} compact />)}
      </div>
    </section>
  );
}
