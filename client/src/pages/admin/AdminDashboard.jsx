import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../api';
import StatusBadge from '../../components/StatusBadge';
import Loading from '../../components/Loading';
import Alert from '../../components/Alert';
import { formatDate, formatPrice } from '../../utils/format';
import { STATUS_LABELS } from '../../utils/catalog';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    adminApi
      .stats()
      .then((res) => setStats(res.stats))
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <Alert>{error}</Alert>;
  if (!stats) return <Loading />;

  const toPack = stats.ordersByStatus.paid;

  return (
    <div className="admin-dashboard">
      <h1>Overview</h1>

      <div className="stat-grid">
        <div className="stat">
          <span className="stat-label">Revenue</span>
          <span className="stat-value">{formatPrice(stats.revenue)}</span>
          <span className="muted">excluding cancelled orders</span>
        </div>
        <div className="stat">
          <span className="stat-label">Orders</span>
          <span className="stat-value">{stats.orderCount}</span>
          <Link to="/admin/orders?status=paid">{toPack} waiting to be packed</Link>
        </div>
        <div className="stat">
          <span className="stat-label">Live products</span>
          <span className="stat-value">{stats.productCount}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Customers</span>
          <span className="stat-value">{stats.customerCount}</span>
        </div>
      </div>

      <div className="admin-columns">
        <section>
          <h2>Orders by status</h2>
          <ul className="plain-list">
            {Object.entries(stats.ordersByStatus).map(([status, count]) => (
              <li key={status}>
                <Link to={`/admin/orders?status=${status}`}>{STATUS_LABELS[status]}</Link>
                <span>{count}</span>
              </li>
            ))}
          </ul>

          <h2>Running low (≤ {stats.lowStockThreshold})</h2>
          {stats.lowStock.length === 0 ? (
            <p className="muted">Everything is well stocked.</p>
          ) : (
            <ul className="plain-list">
              {stats.lowStock.map((p) => (
                <li key={p._id}>
                  <span>{p.name}</span>
                  <span className={p.stock === 0 ? 'stock-note out' : 'stock-note low'}>{p.stock} left</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2>Latest orders</h2>
          {stats.recentOrders.length === 0 ? (
            <p className="muted">No orders yet.</p>
          ) : (
            <ul className="plain-list">
              {stats.recentOrders.map((o) => (
                <li key={o._id}>
                  <span>
                    <strong>{o.orderNumber}</strong>
                    <br />
                    <span className="muted">
                      {o.user?.name || 'Deleted user'} · {formatDate(o.createdAt)}
                    </span>
                  </span>
                  <span>
                    {formatPrice(o.totals.total)} <StatusBadge status={o.status} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
