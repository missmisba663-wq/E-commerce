import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { Search, Tag } from 'lucide-react';
import { api, qs } from '../api/client.js';
import { useDebounced } from '../hooks/useApi.js';
import { formatMoney, productPath } from '../lib/format.js';
import { ProductImage } from './ui.jsx';

export default function SearchBox() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const [text, setText] = useState(() => (location.pathname === '/search' ? params.get('q') || '' : ''));
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [suggestions, setSuggestions] = useState({ products: [], categories: [] });
  const debounced = useDebounced(text.trim(), 180);
  const wrapper = useRef(null);

  // Keep the box in sync when navigating between searches.
  useEffect(() => {
    if (location.pathname === '/search') setText(params.get('q') || '');
  }, [location.pathname, params]);

  useEffect(() => {
    if (debounced.length < 2) {
      setSuggestions({ products: [], categories: [] });
      return;
    }
    let stale = false;
    api.get(`/catalog/products/suggest${qs({ q: debounced })}`)
      .then((d) => !stale && setSuggestions(d))
      .catch(() => {});
    return () => { stale = true; };
  }, [debounced]);

  useEffect(() => {
    const close = (e) => wrapper.current && !wrapper.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const options = [
    ...suggestions.categories.map((c) => ({ key: `c${c.slug}`, to: `/c/${c.department}/${c.slug}`, category: c })),
    ...suggestions.products.map((p) => ({ key: `p${p.id}`, to: productPath({ id: p.id, slug: '' }), product: p })),
  ];

  function go(to) {
    setOpen(false);
    setActive(-1);
    navigate(to);
  }

  function submit(e) {
    e.preventDefault();
    if (active >= 0 && options[active]) return go(options[active].to);
    const q = text.trim();
    if (q) go(`/search${qs({ q })}`);
  }

  function onKeyDown(e) {
    if (!open || !options.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => (a + 1) % options.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (a <= 0 ? options.length - 1 : a - 1));
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  const showList = open && debounced.length >= 2 && options.length > 0;

  return (
    <form className="search" role="search" onSubmit={submit} ref={wrapper}>
      <input
        type="search"
        placeholder="Search 138,000+ products"
        value={text}
        onChange={(e) => { setText(e.target.value); setOpen(true); setActive(-1); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        aria-label="Search products"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls="search-suggestions"
        autoComplete="off"
      />
      <button type="submit" className="search-btn" aria-label="Search">
        <Search size={20} />
      </button>
      {showList && (
        <ul className="suggestions" id="search-suggestions" role="listbox">
          {options.map((o, i) => (
            <li key={o.key} role="option" aria-selected={i === active}>
              <button type="button" className={i === active ? 'active' : ''} onMouseDown={(e) => e.preventDefault()} onClick={() => go(o.to)}>
                {o.category ? (
                  <>
                    <span className="sugg-icon"><Tag size={16} /></span>
                    <span className="sugg-text">Browse <strong>{o.category.name}</strong></span>
                  </>
                ) : (
                  <>
                    <ProductImage src={o.product.image} alt="" className="sugg-img" />
                    <span className="sugg-text">{o.product.title}</span>
                    <span className="sugg-price">{formatMoney(o.product.priceCents)}</span>
                  </>
                )}
              </button>
            </li>
          ))}
          <li>
            <button type="button" className="sugg-all" onMouseDown={(e) => e.preventDefault()} onClick={() => go(`/search${qs({ q: text.trim() })}`)}>
              See all results for “{text.trim()}”
            </button>
          </li>
        </ul>
      )}
    </form>
  );
}
