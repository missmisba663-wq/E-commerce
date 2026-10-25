import { useState } from 'react';
import { Link } from 'react-router';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { ErrorState, Spinner, StatusBadge } from '../../components/ui.jsx';
import { useApi, useDocumentTitle } from '../../hooks/useApi.js';
import { formatDate, formatMoney, formatMoneyCompact, formatNumber } from '../../lib/format.js';

const STATUS_LABELS = {
  pending_payment: 'Awaiting payment', processing: 'Confirmed', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled',
};

function Kpi({ label, value, delta, sub }) {
  return (
    <div className="card kpi">
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
      {delta != null && (
        <span className={`kpi-delta ${delta >= 0 ? 'up' : 'down'}`}>
          {delta >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          {Math.abs(delta).toFixed(0)}% vs previous period
        </span>
      )}
      {sub && <span className="kpi-sub">{sub}</span>}
    </div>
  );
}

function niceStep(raw) {
  const pow = 10 ** Math.floor(Math.log10(raw || 1));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

/** Single-series daily revenue bars with a hover tooltip and an accessible table. */
function RevenueChart({ series }) {
  const [hover, setHover] = useState(null);
  const W = 720;
  const H = 220;
  const pad = { top: 12, right: 8, bottom: 24, left: 52 };
  const max = Math.max(...series.map((d) => d.revenueCents), 10000);
  const step = niceStep(max / 4);
  const top = Math.ceil(max / step) * step;
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const bw = innerW / series.length;
  const y = (v) => pad.top + innerH - (v / top) * innerH;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const labelEvery = Math.ceil(series.length / 6);
  const active = hover != null ? series[hover] : null;

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Revenue per day" onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} className="chart-grid" />
            <text x={pad.left - 8} y={y(t)} className="chart-axis" textAnchor="end" dominantBaseline="middle">{formatMoneyCompact(t)}</text>
          </g>
        ))}
        {series.map((d, i) => {
          const x = pad.left + i * bw;
          const h = Math.max(0, pad.top + innerH - y(d.revenueCents));
          const w = Math.max(1, bw - 2);
          const r = Math.min(4, h, w / 2);
          return (
            <g key={d.day} onMouseEnter={() => setHover(i)}>
              <rect x={x} y={pad.top} width={bw} height={innerH} fill="transparent" />
              {h > 0 && (
                <path
                  className={`chart-bar ${hover === i ? 'active' : ''}`}
                  d={`M${x + 1},${pad.top + innerH} v${-(h - r)} q0,${-r} ${r},${-r} h${w - 2 * r} q${r},0 ${r},${r} v${h - r} z`}
                />
              )}
              {i % labelEvery === 0 && (
                <text x={x + bw / 2} y={H - 6} className="chart-axis" textAnchor="middle">
                  {new Date(`${d.day}T00:00:00`).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {active && (
        <div className="chart-tip" style={{ left: `${((pad.left + (hover + 0.5) * bw) / W) * 100}%` }}>
          <b>{formatDate(active.day)}</b>
          <span>{formatMoney(active.revenueCents)}</span>
          <span className="muted">{active.orders} {active.orders === 1 ? 'order' : 'orders'}</span>
        </div>
      )}
      <table className="sr-only">
        <caption>Revenue per day</caption>
        <thead><tr><th>Day</th><th>Revenue</th><th>Orders</th></tr></thead>
        <tbody>{series.map((d) => <tr key={d.day}><td>{d.day}</td><td>{formatMoney(d.revenueCents)}</td><td>{d.orders}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

function HBars({ rows }) {
  if (!rows.length) return <p className="muted">No sales in this period yet.</p>;
  const max = Math.max(...rows.map((r) => r.revenueCents));
  return (
    <ul className="hbars">
      {rows.map((r) => (
        <li key={r.name} title={`${r.name}: ${formatMoney(r.revenueCents)}`}>
          <span className="hbar-label">{r.name}</span>
          <span className="hbar-track"><span className="hbar-fill" style={{ width: `${(r.revenueCents / max) * 100}%` }} /></span>
          <span className="hbar-value">{formatMoney(r.revenueCents)}</span>
        </li>
      ))}
    </ul>
  );
}

export default function AdminDashboard() {
  useDocumentTitle('Admin dashboard');
  const [days, setDays] = useState(30);
  const { data, error, loading, reload } = useApi(`/admin/stats?days=${days}`);

  if (loading && !data) return <Spinner block />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  const delta = data.previousRevenueCents ? ((data.revenueCents - data.previousRevenueCents) / data.previousRevenueCents) * 100 : null;
  const statusCount = Object.fromEntries(data.ordersByStatus.map((s) => [s.status, s.count]));

  return (
    <div className={loading ? 'is-refreshing' : ''}>
      <div className="section-head">
        <h1>Dashboard</h1>
        <div className="segmented" role="group" aria-label="Date range">
          {[7, 30, 90].map((d) => (
            <button key={d} className={days === d ? 'active' : ''} onClick={() => setDays(d)}>{d} days</button>
          ))}
        </div>
      </div>
      <div className="kpis">
        <Kpi label="Revenue" value={formatMoney(data.revenueCents)} delta={delta} />
        <Kpi label="Orders" value={formatNumber(data.orders)} sub={`Avg. ${formatMoney(data.averageOrderCents)} per order`} />
        <Kpi label="New customers" value={formatNumber(data.newCustomers)} sub={`${formatNumber(data.totals.customers)} total`} />
        <Kpi label="To ship" value={formatNumber(data.totals.awaitingShipment)} sub={<Link to="/admin/orders?status=processing">View orders</Link>} />
      </div>

      <section className="card">
        <h2>Revenue per day</h2>
        <RevenueChart series={data.series} />
      </section>

      <div className="admin-grid">
        <section className="card">
          <h2>Sales by department</h2>
          <HBars rows={data.salesByDepartment} />
        </section>
        <section className="card">
          <h2>Orders by status</h2>
          <ul className="status-list">
            {Object.entries(STATUS_LABELS).map(([s, label]) => (
              <li key={s}><Link to={`/admin/orders?status=${s}`}><StatusBadge status={s} label={label} /></Link><b>{formatNumber(statusCount[s] || 0)}</b></li>
            ))}
          </ul>
          <p className="small muted">{formatNumber(data.totals.products)} active products · {formatNumber(data.totals.outOfStock)} out of stock · <Link to="/admin/products?stock=out">Restock</Link></p>
        </section>
      </div>

      <div className="admin-grid">
        <section className="card">
          <h2>Top products</h2>
          {data.topProducts.length === 0 ? <p className="muted">No sales in this period yet.</p> : (
            <table className="table">
              <thead><tr><th>Product</th><th className="num">Units</th><th className="num">Revenue</th></tr></thead>
              <tbody>
                {data.topProducts.map((p) => (
                  <tr key={p.id}><td><Link to={`/p/${p.id}`} className="truncate">{p.title}</Link></td><td className="num">{p.units}</td><td className="num">{formatMoney(p.revenueCents)}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <section className="card">
          <div className="section-head"><h2>Recent orders</h2><Link to="/admin/orders" className="link">All orders</Link></div>
          <table className="table">
            <tbody>
              {data.recentOrders.map((o) => (
                <tr key={o.id}>
                  <td><Link to={`/admin/orders/${o.id}`}>{o.number}</Link><br /><span className="muted small">{o.customerName}</span></td>
                  <td><StatusBadge status={o.status} label={o.statusLabel} /></td>
                  <td className="num">{formatMoney(o.totalCents)}</td>
                </tr>
              ))}
              {!data.recentOrders.length && <tr><td className="muted">No orders yet.</td></tr>}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
