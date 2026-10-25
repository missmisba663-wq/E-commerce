import { Link } from 'react-router';
import { Heart } from 'lucide-react';
import { ProductGrid } from '../components/ProductCard.jsx';
import { EmptyState, ErrorState, Spinner } from '../components/ui.jsx';
import { useWishlist } from '../context/WishlistContext.jsx';
import { useApi, useDocumentTitle } from '../hooks/useApi.js';

export default function WishlistPage() {
  useDocumentTitle('Wishlist');
  const { count } = useWishlist();
  // Re-fetch when items are removed so the grid stays in sync with the hearts.
  const { data, error, loading, reload } = useApi(`/account/wishlist?v=${count}`);

  if (loading && !data) return <Spinner block />;
  if (error) return <div className="container"><ErrorState error={error} onRetry={reload} /></div>;
  return (
    <div className="container">
      <h1>Your wishlist</h1>
      {data.items.length === 0 ? (
        <EmptyState icon={Heart} title="Your wishlist is empty" action={<Link to="/" className="btn btn-primary">Discover products</Link>}>
          Tap the heart on any product to save it for later.
        </EmptyState>
      ) : (
        <>
          <p className="muted">{data.items.length} saved {data.items.length === 1 ? 'item' : 'items'}</p>
          <ProductGrid products={data.items} />
        </>
      )}
    </div>
  );
}
