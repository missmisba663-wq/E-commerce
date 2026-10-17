import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ordersApi } from '../api';
import StatusBadge from '../components/StatusBadge';
import Loading from '../components/Loading';
import Alert from '../components/Alert';
import { formatDate, formatPrice, pluralise } from '../utils/format';

export default function OrdersPage() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    ordersApi
      .list()
      .then((res) => setOrders(res.orders))
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <Alert>{error}</Alert>;
  if (!orders) return <Loading />;

  if (orders.length === 0) {
    return (
      <div className="empty-state">
        <h1>No orders yet</h1>
        <p>
          When you place an order it'll show up here. <Link to="/">Start shopping</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="orders-page">
      <h1>My orders</h1>
      <ul className="order-list">
        {orders.map((order) => (
          <li key={order._id}>
            <Link to={`/orders/${order._id}`} className="order-row">
              <span className="order-number">{order.orderNumber}</span>
              <span className="muted">{formatDate(order.createdAt)}</span>
              <span>{pluralise(order.items.reduce((n, i) => n + i.quantity, 0), 'item')}</span>
              <span>{formatPrice(order.totals.total)}</span>
              <StatusBadge status={order.status} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
