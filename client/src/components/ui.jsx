import { useState } from 'react';
import { Link } from 'react-router';
import { ChevronLeft, ChevronRight, ImageOff, Star, StarHalf } from 'lucide-react';
import { formatMoney } from '../lib/format.js';

export function Spinner({ label = 'Loading…', block = false }) {
  return (
    <div className={block ? 'spinner-block' : 'spinner-inline'} role="status">
      <span className="spinner" aria-hidden="true" />
      <span className={block ? '' : 'sr-only'}>{label}</span>
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="empty-state">
      <h2>Something went wrong</h2>
      <p>{error?.message || 'Please try again.'}</p>
      {onRetry && <button className="btn btn-secondary" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="empty-state">
      {Icon && <Icon size={44} strokeWidth={1.5} className="empty-icon" />}
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Stars({ value, count, size = 14, showValue = false }) {
  const full = Math.floor(value);
  const half = value - full >= 0.25 && value - full < 0.75;
  const rounded = value - full >= 0.75 ? full + 1 : full;
  return (
    <span className="stars" aria-label={`Rated ${value} out of 5`}>
      {showValue && <span className="stars-value">{value.toFixed(1)}</span>}
      {[0, 1, 2, 3, 4].map((i) => {
        if (i < (half ? full : rounded)) return <Star key={i} size={size} className="star filled" />;
        if (half && i === full) return <StarHalf key={i} size={size} className="star filled" />;
        return <Star key={i} size={size} className="star" />;
      })}
      {count != null && <span className="stars-count">({count.toLocaleString('en-IN')})</span>}
    </span>
  );
}

export function Price({ cents, listCents, discount, size = 'md' }) {
  return (
    <div className={`price price-${size}`}>
      <span className="price-now">{formatMoney(cents)}</span>
      {listCents > cents && (
        <>
          <span className="price-was">{formatMoney(listCents)}</span>
          {discount > 0 && <span className="price-off">-{discount}%</span>}
        </>
      )}
    </div>
  );
}

/** Product image with a graceful placeholder when the remote image fails. */
export function ProductImage({ src, alt, className = '', eager = false }) {
  const [failed, setFailed] = useState(false);
  if (failed || !src) {
    return (
      <div className={`img-fallback ${className}`} role="img" aria-label={alt}>
        <ImageOff size={28} strokeWidth={1.5} />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

export function Pagination({ page, pages, onChange }) {
  if (pages <= 1) return null;
  const nums = new Set([1, pages, page - 1, page, page + 1, page - 2, page + 2]);
  const list = [...nums].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const items = [];
  list.forEach((n, i) => {
    if (i && n - list[i - 1] > 1) items.push(<span key={`gap${n}`} className="page-gap">…</span>);
    items.push(
      <button key={n} className={`page-btn ${n === page ? 'active' : ''}`} onClick={() => onChange(n)} aria-current={n === page ? 'page' : undefined}>
        {n}
      </button>,
    );
  });
  return (
    <nav className="pagination" aria-label="Pagination">
      <button className="page-btn" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page">
        <ChevronLeft size={16} />
      </button>
      {items}
      <button className="page-btn" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Next page">
        <ChevronRight size={16} />
      </button>
    </nav>
  );
}

export function StatusBadge({ status, label }) {
  return <span className={`badge status-${status}`}>{label || status.replace('_', ' ')}</span>;
}

export function QuantitySelect({ value, max = 10, onChange, disabled, id }) {
  const limit = Math.max(1, Math.min(10, max));
  return (
    <select id={id} className="qty-select" value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} aria-label="Quantity">
      {Array.from({ length: Math.max(limit, value) }, (_, i) => i + 1).map((n) => (
        <option key={n} value={n}>Qty: {n}</option>
      ))}
    </select>
  );
}

export function Breadcrumbs({ items }) {
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      {items.map((it, i) => (
        <span key={i}>
          {i > 0 && <span className="crumb-sep">/</span>}
          {it.to ? <Link to={it.to}>{it.label}</Link> : <span aria-current="page">{it.label}</span>}
        </span>
      ))}
    </nav>
  );
}

export function Field({ label, error, hint, children, id }) {
  return (
    <div className={`field ${error ? 'has-error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      {error ? <p className="field-error">{error}</p> : hint ? <p className="field-hint">{hint}</p> : null}
    </div>
  );
}
