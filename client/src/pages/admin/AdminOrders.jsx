import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { api, qs } from '../../api/client.js';
import { Breadcrumbs, ErrorState, Pagination, ProductImage, Spinner, StatusBadge } from '../../components/ui.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useApi, useDocumentTitle } from '../../hooks/useApi.js';
import { formatDateTime, formatMoney } from '../../lib/format.js';
import { OrderSummaryBlocks, OrderTimeline } from '../OrderDetailPage.jsx';

const STATUSES = [
  ['', 'All'], ['pending_payment', 'Awaiting payment'], ['processing', 'To ship'], ['shipped', 'Shipped'], ['delivered', 'Delivered'], ['cancelled', 'Cancelled'],
];

export function AdminOrders() {
  useDocumentTitle('Orders · Admin');
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('q') || '');
  const status = params.get('status') || '';
  const page = Number(params.get('page')) || 1;
  const { data, error, loading, reload } = useApi(`/admin/orders${qs({ status, q: params.get('q'), page })}`);

  const update = (u) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(u)) (v ? next.set(k, v) : next.delete(k));
    if (!('page' in u)) next.delete('page');
    setParams(next);
  };

  return (
    <div>
      <h1>Orders</h1>
      <div className="toolbar">
        <div className="segmented">
          {STATUSES.map(([v, l]) => <button key={v} className={status === v ? 'active' : ''} onClick={() => update({ status: v })}>{l}</button>)}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); update({ q: search.trim() }); }}>
          <input type="search" placeholder="Order #, customer name or email" value={search} onChange={(e) => setSearch(e.target.value)} />
        </form>
      </div>
      {error ? <ErrorState error={error} onRetry={reload} /> : !data ? <Spinner block /> : (
        <div className={`card table-wrap ${loading ? 'is-refreshing' : ''}`}>
          <table className="table">
            <thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Payment</th><th>Status</th><th className="num">Items</th><th className="num">Total</th></tr></thead>
            <tbody>
              {data.orders.map((o) => (
                <tr key={o.id}>
                  <td><Link to={`/admin/orders/${o.id}`}>{o.number}</Link></td>
                  <td>{formatDateTime(o.createdAt)}</td>
                  <td>{o.customerName}<br /><span className="muted small">{o.customerEmail}</span></td>
                  <td>{o.paymentMethod === 'cod' ? 'COD' : 'Card'} · <span className={`pay-${o.paymentStatus}`}>{o.paymentStatus}</span></td>
                  <td><StatusBadge status={o.status} label={o.statusLabel} /></td>
                  <td className="num">{o.units}</td>
                  <td className="num">{formatMoney(o.totalCents)}</td>
                </tr>
              ))}
              {!data.orders.length && <tr><td colSpan={7} className="muted center">No orders found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {data && <Pagination page={data.page} pages={data.pages} onChange={(n) => update({ page: String(n) })} />}
    </div>
  );
}

const NEXT_LABEL = { processing: 'Mark as paid', shipped: 'Mark as shipped', delivered: 'Mark as delivered' };

export function AdminOrderDetail() {
  const { id } = useParams();
  const { data, error, loading, reload, setData } = useApi(`/admin/orders/${id}`);
  const { toast, error: toastError } = useToast();
  const [tracking, setTracking] = useState('');
  const [busy, setBusy] = useState(false);
  useDocumentTitle(data ? `${data.order.number} · Admin` : 'Order · Admin');

  if (loading && !data) return <Spinner block />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  const { order } = data;

  async function act(fn, message) {
    setBusy(true);
    try {
      setData(await fn());
      toast(message);
    } catch (e) {
      toastError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const advance = (status) => act(() => api.patch(`/admin/orders/${order.id}`, { status, trackingNumber: tracking || undefined }), 'Order updated');
  const cancel = () => {
    const reason = window.prompt('Reason for cancelling (shown to the customer):', 'Item unavailable');
    if (reason !== null) act(() => api.post(`/admin/orders/${order.id}/cancel`, { reason }), 'Order cancelled');
  };

  return (
    <div className="order-detail">
      <Breadcrumbs items={[{ label: 'Orders', to: '/admin/orders' }, { label: order.number }]} />
      <div className="order-detail-head">
        <div>
          <h1>{order.number}</h1>
          <p className="muted">{order.customer.name} · {order.customer.email} · placed {formatDateTime(order.createdAt)}</p>
        </div>
        <StatusBadge status={order.status} label={order.statusLabel} />
      </div>

      {order.nextStatuses.length > 0 && (
        <section className="card fulfil">
          <h2>Fulfilment</h2>
          {order.nextStatuses.includes('shipped') && (
            <label className="field"><span>Tracking number (optional)</span><input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="e.g. 1Z999AA10123456784" /></label>
          )}
          <div className="row gap">
            {order.nextStatuses.filter((s) => s !== 'cancelled').map((s) => (
              <button key={s} className="btn btn-primary" disabled={busy} onClick={() => advance(s)}>{NEXT_LABEL[s]}</button>
            ))}
            {order.canCancel && <button className="btn btn-danger-ghost" disabled={busy} onClick={cancel}>Cancel order</button>}
          </div>
        </section>
      )}

      <div className="card"><OrderTimeline order={order} /></div>
      <OrderSummaryBlocks order={order} />
      <section className="card">
        <h2>Items</h2>
        <ul className="order-items">
          {order.items.map((i) => (
            <li key={i.productId}>
              <ProductImage src={i.image} alt="" />
              <div><Link to={`/p/${i.productId}`} className="order-item-title">{i.title}</Link><p className="muted small">{formatMoney(i.unitPriceCents)} × {i.quantity}</p></div>
              <b>{formatMoney(i.lineTotalCents)}</b>
            </li>
          ))}
        </ul>
      </section>
      <section className="card">
        <h2>History</h2>
        <ul className="events">
          {[...order.events].reverse().map((e, i) => <li key={i}><b>{e.status}</b>{e.note && ` — ${e.note}`}<br /><span className="muted small">{formatDateTime(e.at)}</span></li>)}
        </ul>
      </section>
    </div>
  );
}
