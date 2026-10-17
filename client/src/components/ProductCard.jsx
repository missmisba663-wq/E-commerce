import { Link } from 'react-router-dom';
import ProductImage from './ProductImage';
import { formatPrice } from '../utils/format';
import { LOW_STOCK } from '../utils/catalog';

export default function ProductCard({ product }) {
  const { stock } = product;

  return (
    <article className="product-card">
      <Link to={`/products/${product.slug}`} className="product-card-link">
        <ProductImage product={product} />
        <div className="product-card-body">
          <h3>{product.name}</h3>
          <p className="price">{formatPrice(product.price)}</p>
          {stock === 0 && <p className="stock-note out">Out of stock</p>}
          {stock > 0 && stock <= LOW_STOCK && <p className="stock-note low">Only {stock} left</p>}
        </div>
      </Link>
    </article>
  );
}
