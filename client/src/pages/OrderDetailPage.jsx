import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { CheckCircle2, Circle, CreditCard, XCircle } from 'lucide-react';
import { api } from '../api/client.js';
import { Breadcrumbs, ErrorState, ProductImage, Spinner, StatusBadge } from '../components/ui.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useApi, useDocumentTitle } from '../hooks/useApi.js';
import { formatDate, formatDateTime, formatMoney } from '../lib/format.js';

const STEPS = [
  ['placed', 'Ordered'],
  ['processing', 'Confirmed'],
  ['shipped', 'Shipped'],
  ['delivered', 'Delivered'],
];
const EVENT_LABELS = {
  placed: 'Order placed',
  paid: 'Payment received',
  processing: 'Order confirmed and being prepared',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Order cancelled',
};

export function OrderTimeline({ order }) {
  const reached = new Set(order.events.map((e) => e.status));
  if (order.status === 'cancelled') {
    return <div className="alert alert-error"><XCircle size={18} /> This order was cancelled.</div>;
  }
  return (
    <ol className="progress">
      {STEPS.map(([key, label]) => (
        <li key={key} className={reached.has(key) ? 'done' : ''}>
          {reached.has(key) ? <CheckCircle2 size={22} /> : <Circle size={22} />}
          <span>{label}</span>
        </li>
      ))}
    </ol>
  );
}

export function OrderSummaryBlocks({ order }) {
  const a = order.shippingAddress;
  return (
    <div className="card order-info">
      <div>
        <h3>Shipping address</h3>
        <p>{a.fullName}<br />{a.line1}{a.line2 && <><br />{a.line2}</>}<br />{a.city}, {a.state} {a.postalCode}<br />{a.country}<br /><span className="muted">{a.phone}</span></p>
      </div>
      <div>
        <h3>Payment</h3>
        <p>{order.paymentMethod === 'cod' ? 'Cash on delivery' : 'Card (Stripe)'}<br />
          <span className={`pay-${order.paymentStatus}`}>{order.paymentStatus === 'paid' ? 'Paid' : order.paymentStatus === 'refunded' ? 'Refunded' : 'Not paid yet'}</span></p>
        {order.trackingNumber && <><h3>Tracking</h3><p className="mono">{order.trackingNumber}</p></>}
      </div>
      <dl className="totals">
        <div><dt>Items</dt><dd>{formatMoney(order.subtotalCents)}</dd></div>
        <div><dt>Delivery</dt><dd>{order.shippingCents ? formatMoney(order.shippingCents) : 'FREE'}</dd></div>
        {order.taxCents > 0 && <div><dt>Tax</dt><dd>{formatMoney(order.taxCents)}</dd></div>}
        <div className="totals-grand"><dt>Grand total</dt><dd>{formatMoney(order.totalCents)}</dd></div>
        {!order.taxCents && <p className="small muted totals-note">Inclusive of all taxes (GST)</p>}
      </dl>
    </div>
  );
}

export default function OrderDetailPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { data, error, loading, reload, setData } = useApi(`/orders/${id}`);
  const { toast, error: toastError } = useToast();
  const [busy, setBusy] = useState(false);
  useDocumentTitle(data ? `Order ${data.order.number}` : 'Order');

  if (loading && !data) return <Spinner block />;
  if (error) return <div className="container"><ErrorState error={error} onRetry={reload} /></div>;
  const { order } = data;

  async function cancel() {
    if (!window.confirm('Cancel this order? Any payment will be refunded.')) return;
    setBusy(true);
    try {
      setData(await api.post(`/orders/${order.id}/cancel`, {}));
      toast('Your order has been cancelled');
    } catch (e) {
      toastError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function pay() {
    setBusy(true);
    try {
      const { checkoutUrl } = await api.post(`/orders/${order.id}/pay`);
      window.location.assign(checkoutUrl);
    } catch (e) {
      toastError(e.message);
      setBusy(false);
    }
  }

  const justPlaced = params.get('placed') || (params.get('payment') === 'success' && order.paymentStatus === 'paid');

  return (
    <div className="container narrow order-detail">
      <Breadcrumbs items={[{ label: 'Your orders', to: '/orders' }, { label: order.number }]} />
      {justPlaced && (
        <div className="alert alert-success big">
          <CheckCircle2 size={24} />
          <div><b>Thank you, your order has been placed.</b><br />We'll keep you updated here as it moves along.</div>
        </div>
      )}
      {params.get('payment') === 'cancelled' && order.status === 'pending_payment' && (
        <div className="alert alert-warning">Payment was not completed. Your items are reserved for 60 minutes, so you can pay now or cancel.</div>
      )}
      <div className="order-detail-head">
        <div>
          <h1>Order {order.number}</h1>
          <p className="muted">Placed {formatDateTime(order.createdAt)}</p>
        </div>
        <div className="row gap">
          <StatusBadge status={order.status} label={order.statusLabel} />
          {order.status === 'pending_payment' && <button className="btn btn-primary btn-sm" onClick={pay} disabled={busy}><CreditCard size={16} /> Pay now</button>}
          {order.canCancel && <button className="btn btn-secondary btn-sm" onClick={cancel} disabled={busy}>Cancel order</button>}
        </div>
      </div>

      <div className="card"><OrderTimeline order={order} /></div>
      <OrderSummaryBlocks order={order} />

      <section className="card">
        <h2>Items</h2>
        <ul className="order-items">
          {order.items.map((i) => (
            <li key={i.productId}>
              <Link to={`/p/${i.productId}`}><ProductImage src={i.image} alt="" /></Link>
              <div>
                <Link to={`/p/${i.productId}`} className="order-item-title">{i.title}</Link>
                <p className="muted small">{formatMoney(i.unitPriceCents)} × {i.quantity}</p>
                {order.status === 'delivered' && <Link to={`/p/${i.productId}#reviews`} className="link small">Write a product review</Link>}
              </div>
              <b>{formatMoney(i.lineTotalCents)}</b>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>Order history</h2>
        <ul className="events">
          {[...order.events].reverse().map((e, i) => (
            <li key={i}><b>{EVENT_LABELS[e.status] || e.status}</b>{e.note && <span> — {e.note}</span>}<br /><span className="muted small">{formatDateTime(e.at)}</span></li>
          ))}
        </ul>
        <p className="small muted">Last updated {formatDate(order.updatedAt)}</p>
      </section>
    </div>
  );
}
