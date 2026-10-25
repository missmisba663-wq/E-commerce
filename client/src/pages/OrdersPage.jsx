import { useState } from 'react';
import { Link } from 'react-router';
import { Package } from 'lucide-react';
import { EmptyState, ErrorState, Pagination, ProductImage, Spinner, StatusBadge } from '../components/ui.jsx';
import { useApi, useDocumentTitle } from '../hooks/useApi.js';
import { formatDate, formatMoney } from '../lib/format.js';

export default function OrdersPage() {
  useDocumentTitle('Your orders');
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useApi(`/orders?page=${page}`);

  if (loading && !data) return <Spinner block />;
  if (error) return <div className="container"><ErrorState error={error} onRetry={reload} /></div>;
  if (!data.orders.length) {
    return (
      <div className="container">
        <EmptyState icon={Package} title="No orders yet" action={<Link to="/" className="btn btn-primary">Start shopping</Link>}>
          When you place an order, you can track it here.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="container narrow">
      <h1>Your orders</h1>
      <p className="muted">{data.total} {data.total === 1 ? 'order' : 'orders'} placed</p>
      <div className="order-list">
        {data.orders.map((o) => (
          <article key={o.id} className="card order-card">
            <header className="order-card-head">
              <div><small>ORDER PLACED</small>{formatDate(o.createdAt)}</div>
              <div><small>TOTAL</small>{formatMoney(o.totalCents)}</div>
              <div><small>PAYMENT</small>{o.paymentMethod === 'cod' ? 'Cash on delivery' : 'Card'}</div>
              <div className="order-card-num"><small>ORDER # {o.number}</small><Link to={`/orders/${o.id}`}>View order details</Link></div>
            </header>
            <div className="order-card-body">
              <div>
                <StatusBadge status={o.status} label={o.statusLabel} />
                <p className="small muted">{o.itemCount} {o.itemCount === 1 ? 'item' : 'items'}</p>
              </div>
              <div className="order-thumbs">
                {o.previewItems.map((i, idx) => <ProductImage key={idx} src={i.image} alt={i.title} />)}
              </div>
              <Link to={`/orders/${o.id}`} className="btn btn-secondary btn-sm">Track order</Link>
            </div>
          </article>
        ))}
      </div>
      <Pagination page={data.page} pages={data.pages} onChange={setPage} />
    </div>
  );
}
