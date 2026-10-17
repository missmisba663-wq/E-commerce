import { useState } from 'react';
import { CATEGORY_META } from '../utils/catalog';

// Uses the photo if there is one. Otherwise, or if the link breaks, it shows a tile in the category's colour.
export default function ProductImage({ product, className = '' }) {
  const [broken, setBroken] = useState(false);

  if (product.imageUrl && !broken) {
    return (
      <img
        className={`product-image ${className}`}
        src={product.imageUrl}
        alt={product.name}
        loading="lazy"
        onError={() => setBroken(true)}
      />
    );
  }

  return (
    <div className={`product-image tile tile-${product.category} ${className}`} role="img" aria-label={product.name}>
      <span aria-hidden="true">{CATEGORY_META[product.category]?.emoji || '🌱'}</span>
    </div>
  );
}
