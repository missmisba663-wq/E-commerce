import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ordersApi } from '../api';
import StatusBadge from '../components/StatusBadge';
import TotalsTable from '../components/TotalsTable';
import Loading from '../components/Loading';
import Alert from '../components/Alert';
import { formatDate, formatPrice } from '../utils/format';
import { STATUS_LABELS } from '../utils/catalog';

export default function OrderDetailPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const justPlaced = params.get('placed') === '1';

  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    ordersApi
      .get(id)
      .then((res) => setOrder(res.order))
      .catch((err) => setError(err.message));
  }, [id]);

  const cancel = async () => {
    if (!window.confirm('Cancel this order? Your card will be refunded in full.')) return;
    setCancelling(true);
    setError('');
    try {
      const res = await ordersApi.cancel(order._id);
      setOrder(res.order);
    } catch (err) {
      setError(err.message);
    } finally {
      setCancelling(false);
    }
  };

  if (!order && error) return <Alert>{error}</Alert>;
  if (!order) return <Loading />;

  const { shippingAddress: a } = order;

  return (
    <div className="order-detail">
      {justPlaced && (
        <Alert tone="success">
          Thanks, your order's in! Most orders are packed within one working day, and you can follow its progress here.
        </Alert>
      )}

      <div className="order-header">
        <div>
          <h1>Order {order.orderNumber}</h1>
          <p className="muted">Placed {formatDate(order.createdAt)}</p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <Alert>{error}</Alert>

      <div className="order-grid">
        <section>
          <h2>Items</h2>
          <ul className="summary-lines">
            {order.items.map((item) => (
              <li key={item.product}>
                <span>
                  {item.quantity} × {item.name}
                </span>
                <span>{formatPrice(item.price * item.quantity)}</span>
              </li>
            ))}
          </ul>
          <TotalsTable totals={order.totals} discountCode={order.discountCode} />
          <p className="muted">Paid by card ending {order.payment.last4}</p>
        </section>

        <section>
          <h2>Delivering to</h2>
          <address>
            {a.fullName}
            <br />
            {a.line1}
            <br />
            {a.line2 && (
              <>
                {a.line2}
                <br />
              </>
            )}
            {a.city} {a.postcode}
            <br />
            {a.country}
          </address>

          <h2>Progress</h2>
          <ol className="timeline">
            {order.statusHistory.map((h, i) => (
              <li key={i}>
                <strong>{STATUS_LABELS[h.status] || h.status}</strong>
                <span className="muted"> · {formatDate(h.at)}</span>
                {h.note && <div className="muted">{h.note}</div>}
              </li>
            ))}
          </ol>

          {order.status === 'paid' && (
            <button type="button" className="danger" onClick={cancel} disabled={cancelling}>
              {cancelling ? 'Cancelling…' : 'Cancel order'}
            </button>
          )}
        </section>
      </div>

      <p>
        <Link to="/orders">← All orders</Link>
      </p>
    </div>
  );
}
