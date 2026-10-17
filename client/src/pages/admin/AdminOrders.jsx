import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { adminApi } from '../../api';
import StatusBadge from '../../components/StatusBadge';
import Loading from '../../components/Loading';
import Alert from '../../components/Alert';
import { formatDate, formatPrice } from '../../utils/format';
import { NEXT_STATUSES, STATUS_LABELS } from '../../utils/catalog';

const ACTION_LABELS = {
  packed: 'Mark packed',
  shipped: 'Mark shipped',
  delivered: 'Mark delivered',
  cancelled: 'Cancel',
};

export default function AdminOrders() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '';

  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    setOrders(null);
    adminApi
      .orders({ status, limit: 50 })
      .then((res) => setOrders(res.orders))
      .catch((err) => setError(err.message));
  }, [status]);

  const move = async (order, next) => {
    if (next === 'cancelled' && !window.confirm(`Cancel ${order.orderNumber}? Stock will be returned to the shelves.`)) {
      return;
    }
    setError('');
    setBusyId(order._id);
    try {
      const res = await adminApi.updateOrderStatus(order._id, next);
      setOrders((list) =>
        list
          .map((o) => (o._id === order._id ? res.order : o))
          // If we're looking at one status, drop an order once it moves on to another.
          .filter((o) => !status || o.status === status)
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="admin-orders">
      <div className="admin-toolbar">
        <h1>Orders</h1>
        <label>
          Show{' '}
          <select
            value={status}
            onChange={(e) => setParams(e.target.value ? { status: e.target.value } : {})}
            aria-label="Filter by status"
          >
            <option value="">All orders</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <Alert>{error}</Alert>

      {!orders ? (
        <Loading />
      ) : orders.length === 0 ? (
        <p className="muted">No orders here.</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Order</th>
                <th scope="col">Customer</th>
                <th scope="col">Placed</th>
                <th scope="col">Total</th>
                <th scope="col">Status</th>
                <th scope="col">Next step</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o._id}>
                  <td>
                    <Link to={`/orders/${o._id}`}>{o.orderNumber}</Link>
                  </td>
                  <td>
                    {o.user?.name}
                    <br />
                    <span className="muted">{o.user?.email}</span>
                  </td>
                  <td>{formatDate(o.createdAt)}</td>
                  <td>{formatPrice(o.totals.total)}</td>
                  <td>
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="row-actions">
                    {NEXT_STATUSES[o.status].length === 0 && <span className="muted">Done</span>}
                    {NEXT_STATUSES[o.status].map((next) => (
                      <button
                        key={next}
                        type="button"
                        className={next === 'cancelled' ? 'link-button danger-text' : 'small'}
                        disabled={busyId === o._id}
                        onClick={() => move(o, next)}
                      >
                        {ACTION_LABELS[next]}
                      </button>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
