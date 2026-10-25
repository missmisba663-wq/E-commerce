import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { SearchX, SlidersHorizontal, X } from 'lucide-react';
import { qs } from '../api/client.js';
import { ProductGrid } from '../components/ProductCard.jsx';
import { Breadcrumbs, EmptyState, ErrorState, Pagination, Spinner, Stars } from '../components/ui.jsx';
import { useShop } from '../context/ShopContext.jsx';
import { useApi, useDocumentTitle } from '../hooks/useApi.js';
import { formatNumber } from '../lib/format.js';

const SORTS = [
  ['relevance', 'Featured'],
  ['popular', 'Most popular'],
  ['price_asc', 'Price: low to high'],
  ['price_desc', 'Price: high to low'],
  ['rating', 'Avg. customer rating'],
  ['discount', 'Biggest discount'],
];
const PRICE_RANGES = [
  [null, 500, 'Under ₹500'],
  [500, 1000, '₹500 – ₹1,000'],
  [1000, 2500, '₹1,000 – ₹2,500'],
  [2500, 5000, '₹2,500 – ₹5,000'],
  [5000, 10000, '₹5,000 – ₹10,000'],
  [10000, null, 'Over ₹10,000'],
];
const FILTER_KEYS = ['minPrice', 'maxPrice', 'minRating', 'sale', 'bestseller', 'inStock'];

/** Handles /search, /deals, /c/:department and /c/:department/:category. */
export default function BrowsePage({ deals = false }) {
  const { department: deptSlug, category: catSlug } = useParams();
  const [params, setParams] = useSearchParams();
  const { department } = useShop();
  const [showFilters, setShowFilters] = useState(false);

  const dept = deptSlug ? department(deptSlug) : null;
  const cat = dept && catSlug ? dept.categories.find((c) => c.slug === catSlug) : null;
  const q = params.get('q') || '';
  const page = Number(params.get('page')) || 1;
  const sort = params.get('sort') || (deals ? 'discount' : 'relevance');

  const query = {
    q,
    department: deptSlug,
    category: catSlug,
    sort,
    page,
    sale: deals ? 1 : params.get('sale'),
    ...Object.fromEntries(FILTER_KEYS.filter((k) => k !== 'sale').map((k) => [k, params.get(k)])),
  };
  const { data, error, loading, reload } = useApi(`/catalog/products${qs(query)}`);

  const heading = deals ? "Today's Deals" : cat?.name || dept?.name || (q ? `Results for “${q}”` : 'All products');
  useDocumentTitle(heading.replace(/[“”]/g, '"'));

  useEffect(() => setShowFilters(false), [deptSlug, catSlug, q]);

  function setParam(updates, resetPage = true) {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === undefined || v === '' || v === false) next.delete(k);
      else next.set(k, String(v));
    }
    if (resetPage) next.delete('page');
    setParams(next);
  }

  const goToPage = (n) => {
    setParam({ page: n > 1 ? n : null }, false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const activeFilters = FILTER_KEYS.filter((k) => params.get(k) && !(deals && k === 'sale'));
  const crumbs = [{ label: 'Home', to: '/' }];
  if (dept) crumbs.push({ label: dept.name, to: cat ? `/c/${dept.slug}` : undefined });
  if (cat) crumbs.push({ label: cat.name });
  if (!dept) crumbs.push({ label: deals ? "Today's Deals" : 'Search' });

  const catLink = (c) => {
    const base = `/c/${c.department}/${c.slug}`;
    const keep = new URLSearchParams(params);
    keep.delete('page');
    const s = keep.toString();
    return s ? `${base}?${s}` : base;
  };

  const priceKey = `${params.get('minPrice') || ''}-${params.get('maxPrice') || ''}`;

  return (
    <div className="container browse">
      <Breadcrumbs items={crumbs} />
      <div className="browse-head">
        <div>
          <h1>{heading}</h1>
          {data && (
            <p className="muted">
              {formatNumber(data.total)} {data.total === 1 ? 'result' : 'results'}
              {q && (dept || cat) ? <> for “{q}”</> : null}
            </p>
          )}
        </div>
        <div className="browse-tools">
          <button className="btn btn-secondary btn-sm filters-toggle" onClick={() => setShowFilters(true)}>
            <SlidersHorizontal size={16} /> Filters{activeFilters.length ? ` (${activeFilters.length})` : ''}
          </button>
          <label className="sort">
            <span>Sort by</span>
            <select value={sort} onChange={(e) => setParam({ sort: e.target.value })}>
              {SORTS.filter(([v]) => v !== 'relevance' || q || !deals).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="browse-body">
        <aside className={`filters ${showFilters ? 'open' : ''}`} aria-label="Filters">
          <div className="filters-head">
            <strong>Filters</strong>
            <button className="icon-btn" onClick={() => setShowFilters(false)} aria-label="Close filters"><X size={20} /></button>
          </div>

          {dept && !cat && dept.categories.length > 0 && !q && (
            <section className="filter-group">
              <h3>Category</h3>
              <ul className="filter-links">
                {dept.categories.map((c) => (
                  <li key={c.slug}><Link to={`/c/${dept.slug}/${c.slug}`}>{c.name} <span className="muted">({formatNumber(c.productCount)})</span></Link></li>
                ))}
              </ul>
            </section>
          )}
          {(q || cat || deals || !dept) && data?.facets.categories.length > 0 && (
            <section className="filter-group">
              <h3>Category</h3>
              <ul className="filter-links">
                {cat && <li><Link to={`/c/${dept.slug}${q ? qs({ q }) : ''}`}>‹ Any {dept.name}</Link></li>}
                {data.facets.categories.slice(0, 15).map((c) => (
                  <li key={c.slug}>
                    <Link to={catLink(c)} className={c.slug === catSlug ? 'active' : ''}>
                      {c.name} <span className="muted">({formatNumber(c.count)})</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="filter-group">
            <h3>Customer reviews</h3>
            {[4, 3].map((r) => (
              <button key={r} className={`filter-option ${params.get('minRating') === String(r) ? 'active' : ''}`}
                onClick={() => setParam({ minRating: params.get('minRating') === String(r) ? null : r })}>
                <Stars value={r} /> &amp; up
              </button>
            ))}
          </section>

          <section className="filter-group">
            <h3>Price</h3>
            {PRICE_RANGES.map(([min, max, label]) => {
              const key = `${min ?? ''}-${max ?? ''}`;
              return (
                <button key={key} className={`filter-option ${priceKey === key ? 'active' : ''}`}
                  onClick={() => setParam(priceKey === key ? { minPrice: null, maxPrice: null } : { minPrice: min, maxPrice: max })}>
                  {label}
                </button>
              );
            })}
            <PriceInputs key={priceKey} min={params.get('minPrice')} max={params.get('maxPrice')} onApply={(minPrice, maxPrice) => setParam({ minPrice, maxPrice })} />
          </section>

          <section className="filter-group">
            <h3>Deals &amp; availability</h3>
            {!deals && (
              <label className="check"><input type="checkbox" checked={Boolean(params.get('sale'))} onChange={(e) => setParam({ sale: e.target.checked ? 1 : null })} /> On sale</label>
            )}
            <label className="check"><input type="checkbox" checked={Boolean(params.get('bestseller'))} onChange={(e) => setParam({ bestseller: e.target.checked ? 1 : null })} /> Best sellers</label>
            <label className="check"><input type="checkbox" checked={Boolean(params.get('inStock'))} onChange={(e) => setParam({ inStock: e.target.checked ? 1 : null })} /> In stock only</label>
          </section>

          {activeFilters.length > 0 && (
            <button className="btn btn-secondary btn-sm btn-block" onClick={() => setParam(Object.fromEntries(FILTER_KEYS.map((k) => [k, null])))}>
              Clear all filters
            </button>
          )}
        </aside>
        {showFilters && <div className="filters-backdrop" onClick={() => setShowFilters(false)} />}

        <section className="results" aria-busy={loading}>
          {error && !data ? (
            <ErrorState error={error} onRetry={reload} />
          ) : !data ? (
            <Spinner block />
          ) : data.items.length === 0 ? (
            <EmptyState icon={SearchX} title="No products match" action={activeFilters.length ? (
              <button className="btn btn-primary" onClick={() => setParam(Object.fromEntries(FILTER_KEYS.map((k) => [k, null])))}>Clear filters</button>
            ) : <Link to="/" className="btn btn-primary">Back to home</Link>}>
              Try different keywords, check the spelling, or remove some filters.
            </EmptyState>
          ) : (
            <div className={loading ? 'is-refreshing' : ''}>
              <ProductGrid products={data.items} />
              <Pagination page={data.page} pages={Math.min(data.pages, 1000)} onChange={goToPage} />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function PriceInputs({ min, max, onApply }) {
  const [lo, setLo] = useState(min || '');
  const [hi, setHi] = useState(max || '');
  return (
    <form className="price-inputs" onSubmit={(e) => { e.preventDefault(); onApply(lo || null, hi || null); }}>
      <input type="number" min="0" placeholder="₹ Min" value={lo} onChange={(e) => setLo(e.target.value)} aria-label="Minimum price" />
      <input type="number" min="0" placeholder="₹ Max" value={hi} onChange={(e) => setHi(e.target.value)} aria-label="Maximum price" />
      <button className="btn btn-secondary btn-sm" type="submit">Go</button>
    </form>
  );
}
