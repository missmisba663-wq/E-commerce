import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { productsApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import ProductImage from '../components/ProductImage';
import Loading from '../components/Loading';
import Alert from '../components/Alert';
import { formatPrice } from '../utils/format';
import { LOW_STOCK, categoryLabel } from '../utils/catalog';

export default function ProductPage() {
  const { slug } = useParams();
  const { user } = useAuth();
  const { addItem } = useCart();
  const navigate = useNavigate();
  const location = useLocation();

  const [product, setProduct] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    setProduct(null);
    setNotFound(false);
    productsApi
      .get(slug)
      .then((res) => setProduct(res.product))
      .catch(() => setNotFound(true));
  }, [slug]);

  if (notFound) {
    return (
      <div className="empty-state">
        <h1>We couldn't find that plant</h1>
        <p>
          It may have sold out for good. <Link to="/">Back to the shop</Link>
        </p>
      </div>
    );
  }
  if (!product) return <Loading />;

  const soldOut = product.stock === 0;
  const maxQty = Math.min(product.stock, 10);

  const handleAdd = async () => {
    if (!user) {
      navigate('/login', { state: { from: location } });
      return;
    }
    setAdding(true);
    setMessage(null);
    try {
      await addItem(product._id, quantity);
      setMessage({ tone: 'success', text: `Added ${quantity} × ${product.name} to your basket.` });
    } catch (err) {
      setMessage({ tone: 'error', text: err.message });
    } finally {
      setAdding(false);
    }
  };

  return (
    <article className="product-detail">
      <figure className="product-figure">
        <ProductImage product={product} className="large" />
        {product.imageCredit?.author && (
          <figcaption className="photo-credit">
            Photo: {product.imageCredit.author}
            {product.imageCredit.license && <>, {product.imageCredit.license}</>}
            {product.imageCredit.source && (
              <>
                {' · '}
                <a href={product.imageCredit.source} target="_blank" rel="noreferrer">
                  source
                </a>
              </>
            )}
          </figcaption>
        )}
      </figure>

      <div className="product-info">
        <p className="eyebrow">
          <Link to={`/?category=${product.category}`}>{categoryLabel(product.category)}</Link>
        </p>
        <h1>{product.name}</h1>
        <p className="price large">{formatPrice(product.price)}</p>
        <p className="description">{product.description}</p>

        {soldOut ? (
          <p className="stock-note out">Out of stock. We restock most plants within a couple of weeks.</p>
        ) : (
          <>
            {product.stock <= LOW_STOCK && <p className="stock-note low">Only {product.stock} left</p>}
            <div className="add-row">
              <label>
                Quantity{' '}
                <select value={quantity} onChange={(e) => setQuantity(Number(e.target.value))}>
                  {Array.from({ length: maxQty }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className="primary" onClick={handleAdd} disabled={adding}>
                {adding ? 'Adding…' : 'Add to basket'}
              </button>
            </div>
          </>
        )}

        {message && (
          <Alert tone={message.tone}>
            {message.text} {message.tone === 'success' && <Link to="/cart">View basket</Link>}
          </Alert>
        )}

        {product.care && (
          <section className="care-card" aria-labelledby="care-heading">
            <h2 id="care-heading">Looking after it</h2>
            <dl>
              <div>
                <dt>☀️ Light</dt>
                <dd>{product.care.light}</dd>
              </div>
              <div>
                <dt>💧 Water</dt>
                <dd>{product.care.water}</dd>
              </div>
              <div>
                <dt>🐾 Pets</dt>
                <dd>{product.care.petSafe ? 'Safe around cats and dogs' : 'Keep away from curious cats and dogs'}</dd>
              </div>
            </dl>
          </section>
        )}

        <ul className="promises-inline">
          <li>Packed in paper, not plastic</li>
          <li>30-day happy-plant guarantee</li>
        </ul>
      </div>
    </article>
  );
}
