import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { productsApi } from '../api';
import ProductCard from '../components/ProductCard';
import Loading from '../components/Loading';
import Alert from '../components/Alert';
import { CATEGORY_META, SORT_OPTIONS, categoryLabel } from '../utils/catalog';
import { pluralise } from '../utils/format';

const PAGE_SIZE = 12;

export default function CataloguePage() {
  // Filters live in the URL so a search can be bookmarked, shared, or gone back to.
  const [params, setParams] = useSearchParams();
  const category = params.get('category') || '';
  const search = params.get('search') || '';
  const sort = params.get('sort') || 'newest';
  const page = Number(params.get('page')) || 1;

  const [data, setData] = useState(null);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState('');
  const [searchText, setSearchText] = useState(search);

  useEffect(() => {
    productsApi
      .categories()
      .then((res) => setCategories(res.categories))
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setError('');
    productsApi
      .list({ category, search, sort, page, limit: PAGE_SIZE })
      .then((res) => !cancelled && setData(res))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [category, search, sort, page]);

  const updateParams = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
    if (!('page' in changes)) next.delete('page'); // any new filter starts back on page 1
    setParams(next);
  };

  const onSearch = (event) => {
    event.preventDefault();
    updateParams({ search: searchText.trim() });
  };

  return (
    <div className="catalogue">
      <section className="hero">
        <div className="hero-text">
          <p className="hero-kicker">Grown slowly in Yorkshire</p>
          <h1>Plants that fit your life.</h1>
          <p>
            Houseplants, handmade pots and the few tools you actually need. Every plant is checked over by hand before it
            leaves the greenhouse. Free UK delivery over £50.
          </p>
        </div>
      </section>

      <ul className="promises">
        <li>
          <strong>🌱 Healthy or it's on us</strong>
          <span>If your plant arrives unhappy, send us a photo within 30 days and we'll replace it.</span>
        </li>
        <li>
          <strong>📦 Plastic-free packing</strong>
          <span>Paper, card and a lot of care. Everything we send can go straight in the recycling.</span>
        </li>
        <li>
          <strong>💬 Real plant advice</strong>
          <span>Every plant comes with care notes. Not sure what to pick? Each listing tells you how much light it needs.</span>
        </li>
      </ul>

      <div className="catalogue-layout">
        <aside className="filters" aria-label="Filters">
          <form onSubmit={onSearch} role="search">
            <label htmlFor="search">Search</label>
            <div className="search-row">
              <input
                id="search"
                type="search"
                placeholder="Monstera, terracotta…"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
              <button type="submit">Go</button>
            </div>
          </form>

          <h2>Category</h2>
          <ul className="category-list">
            <li>
              <button
                type="button"
                className={!category ? 'active' : ''}
                aria-pressed={!category}
                onClick={() => updateParams({ category: '' })}
              >
                Everything
              </button>
            </li>
            {categories.map((c) => (
              <li key={c.name}>
                <button
                  type="button"
                  className={category === c.name ? 'active' : ''}
                  aria-pressed={category === c.name}
                  onClick={() => updateParams({ category: c.name })}
                >
                  {CATEGORY_META[c.name]?.emoji} {categoryLabel(c.name)} <span className="count">{c.count}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="results" aria-live="polite">
          <div className="results-bar">
            <p>
              {data ? pluralise(data.total, 'product') : ''}
              {search && (
                <>
                  {' '}
                  for “{search}”{' '}
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => {
                      setSearchText('');
                      updateParams({ search: '' });
                    }}
                  >
                    clear
                  </button>
                </>
              )}
            </p>
            <label>
              Sort by{' '}
              <select value={sort} onChange={(e) => updateParams({ sort: e.target.value })}>
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <Alert>{error}</Alert>
          {!data && !error && <Loading label="Finding plants…" />}

          {data && data.products.length === 0 && (
            <div className="empty-state">
              <p>Nothing matches that just now. Try a different search or category.</p>
            </div>
          )}

          {data && data.products.length > 0 && (
            <div className="product-grid">
              {data.products.map((p) => (
                <ProductCard key={p._id} product={p} />
              ))}
            </div>
          )}

          {data && data.totalPages > 1 && (
            <nav className="pagination" aria-label="Pagination">
              <button type="button" disabled={page <= 1} onClick={() => updateParams({ page: String(page - 1) })}>
                Previous
              </button>
              <span>
                Page {page} of {data.totalPages}
              </span>
              <button
                type="button"
                disabled={page >= data.totalPages}
                onClick={() => updateParams({ page: String(page + 1) })}
              >
                Next
              </button>
            </nav>
          )}
        </section>
      </div>
    </div>
  );
}
