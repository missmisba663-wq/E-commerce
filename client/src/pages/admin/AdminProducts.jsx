import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Plus, X } from 'lucide-react';
import { api, qs } from '../../api/client.js';
import { ErrorState, Field, Pagination, ProductImage, Spinner } from '../../components/ui.jsx';
import { useShop } from '../../context/ShopContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useApi, useDocumentTitle } from '../../hooks/useApi.js';
import { formatMoney, formatNumber, productPath } from '../../lib/format.js';

const toCents = (v) => Math.round(Number(v || 0) * 100);
const toDollars = (c) => (c ? (c / 100).toFixed(2) : '');

function ProductEditor({ product, onClose, onSaved }) {
  const { departments } = useShop();
  const { toast } = useToast();
  const isNew = !product;
  const [f, setF] = useState(() => ({
    title: product?.title || '',
    image: product?.imageLarge || '',
    categoryId: product?.categoryId || '',
    price: toDollars(product?.priceCents),
    listPrice: toDollars(product?.listPriceCents),
    stock: product?.stock ?? 10,
    isActive: product?.isActive ?? true,
  }));
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const body = {
      title: f.title,
      categoryId: Number(f.categoryId),
      priceCents: toCents(f.price),
      listPriceCents: toCents(f.listPrice),
      stock: Number(f.stock),
      isActive: f.isActive,
    };
    // Dataset products keep their Amazon image id unless the admin enters a new URL.
    if (isNew || f.image !== product.imageLarge) body.image = f.image;
    try {
      if (isNew) await api.post('/admin/products', body);
      else await api.patch(`/admin/products/${product.id}`, body);
      toast(isNew ? 'Product created' : 'Product updated');
      onSaved();
    } catch (e2) {
      setErr(e2.message);
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="card modal" onClick={(e) => e.stopPropagation()} onSubmit={submit} aria-label={isNew ? 'New product' : 'Edit product'}>
        <div className="section-head">
          <h2>{isNew ? 'New product' : `Edit product #${product.id}`}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>
        {err && <div className="alert alert-error">{err}</div>}
        <Field label="Title" id="pe-title"><textarea id="pe-title" rows={2} value={f.title} onChange={set('title')} required minLength={5} /></Field>
        <div className="editor-image">
          {f.image && <ProductImage src={f.image} alt="" />}
          <Field label="Image URL" id="pe-image"><input id="pe-image" type="url" value={f.image} onChange={set('image')} required /></Field>
        </div>
        <Field label="Category" id="pe-cat">
          <select id="pe-cat" value={f.categoryId} onChange={set('categoryId')} required>
            <option value="">Choose a category</option>
            {departments.map((d) => (
              <optgroup key={d.slug} label={d.name}>
                {d.categories.map((c) => <option key={c.slug} value={c.id ?? ''}>{c.name}</option>)}
              </optgroup>
            ))}
          </select>
        </Field>
        <div className="grid-3">
          <Field label="Price (₹)" id="pe-price"><input id="pe-price" type="number" min="0.01" step="0.01" value={f.price} onChange={set('price')} required /></Field>
          <Field label="MRP (₹)" id="pe-list" hint="Leave empty if not discounted"><input id="pe-list" type="number" min="0" step="0.01" value={f.listPrice} onChange={set('listPrice')} /></Field>
          <Field label="Stock" id="pe-stock"><input id="pe-stock" type="number" min="0" step="1" value={f.stock} onChange={set('stock')} required /></Field>
        </div>
        <label className="check"><input type="checkbox" checked={f.isActive} onChange={set('isActive')} /> Visible in the store</label>
        <div className="row gap">
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save product'}</button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </div>
  );
}

export function AdminProducts() {
  useDocumentTitle('Products · Admin');
  const [params, setParams] = useSearchParams();
  const { departments } = useShop();
  const [search, setSearch] = useState(params.get('q') || '');
  const [editing, setEditing] = useState(null); // null | 'new' | product
  const query = { q: params.get('q'), department: params.get('department'), stock: params.get('stock'), status: params.get('status'), page: params.get('page') };
  const { data, error, loading, reload } = useApi(`/admin/products${qs(query)}`);

  const update = (u) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(u)) (v ? next.set(k, v) : next.delete(k));
    if (!('page' in u)) next.delete('page');
    setParams(next);
  };

  return (
    <div>
      <div className="section-head">
        <h1>Products</h1>
        <button className="btn btn-primary btn-sm" onClick={() => setEditing('new')}><Plus size={16} /> New product</button>
      </div>
      <div className="toolbar">
        <form onSubmit={(e) => { e.preventDefault(); update({ q: search.trim() }); }}>
          <input type="search" placeholder="Search title or product ID" value={search} onChange={(e) => setSearch(e.target.value)} />
        </form>
        <select value={query.department || ''} onChange={(e) => update({ department: e.target.value })} aria-label="Department">
          <option value="">All departments</option>
          {departments.map((d) => <option key={d.slug} value={d.slug}>{d.name}</option>)}
        </select>
        <select value={query.stock || ''} onChange={(e) => update({ stock: e.target.value })} aria-label="Stock">
          <option value="">Any stock</option>
          <option value="low">Low stock (1–5)</option>
          <option value="out">Out of stock</option>
        </select>
        <select value={query.status || ''} onChange={(e) => update({ status: e.target.value })} aria-label="Visibility">
          <option value="">Any visibility</option>
          <option value="active">Visible</option>
          <option value="inactive">Hidden</option>
        </select>
      </div>
      {error ? <ErrorState error={error} onRetry={reload} /> : !data ? <Spinner block /> : (
        <>
          <p className="muted small">{formatNumber(data.total)} products</p>
          <div className={`card table-wrap ${loading ? 'is-refreshing' : ''}`}>
            <table className="table products-table">
              <thead><tr><th /><th>Product</th><th>Category</th><th className="num">Price</th><th className="num">Stock</th><th>Status</th><th /></tr></thead>
              <tbody>
                {data.products.map((p) => (
                  <tr key={p.id}>
                    <td><ProductImage src={p.image} alt="" className="thumb" /></td>
                    <td><Link to={productPath(p)} className="truncate" title={p.title}>{p.title}</Link><span className="muted small">#{p.id}</span></td>
                    <td className="small">{p.category.name}</td>
                    <td className="num">{formatMoney(p.priceCents)}</td>
                    <td className={`num ${p.stock === 0 ? 'text-danger' : p.stock <= 5 ? 'text-warn' : ''}`}>{p.stock}</td>
                    <td>{p.isActive ? <span className="badge status-delivered">Visible</span> : <span className="badge status-cancelled">Hidden</span>}</td>
                    <td><button className="btn btn-secondary btn-sm" onClick={() => setEditing(p)}>Edit</button></td>
                  </tr>
                ))}
                {!data.products.length && <tr><td colSpan={7} className="muted center">No products found.</td></tr>}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} pages={data.pages} onChange={(n) => update({ page: String(n) })} />
        </>
      )}
      {editing && <ProductEditor product={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
    </div>
  );
}

export function AdminCustomers() {
  useDocumentTitle('Customers · Admin');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState({ q: '', page: 1 });
  const { data, error, reload } = useApi(`/admin/users${qs(query)}`);
  const { toast, error: toastError } = useToast();

  async function setRole(u, role) {
    if (!window.confirm(`Make ${u.name} ${role === 'admin' ? 'an admin' : 'a customer'}?`)) return;
    try {
      await api.patch(`/admin/users/${u.id}`, { role });
      toast('Role updated');
      reload();
    } catch (e) {
      toastError(e.message);
    }
  }

  return (
    <div>
      <h1>Customers</h1>
      <div className="toolbar">
        <form onSubmit={(e) => { e.preventDefault(); setQuery({ q: q.trim(), page: 1 }); }}>
          <input type="search" placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} />
        </form>
      </div>
      {error ? <ErrorState error={error} onRetry={reload} /> : !data ? <Spinner block /> : (
        <>
          <div className="card table-wrap">
            <table className="table">
              <thead><tr><th>Name</th><th>Email</th><th>Joined</th><th className="num">Orders</th><th className="num">Spent</th><th>Role</th></tr></thead>
              <tbody>
                {data.users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td>{u.email}</td>
                    <td>{u.createdAt.slice(0, 10)}</td>
                    <td className="num">{u.orders}</td>
                    <td className="num">{formatMoney(u.spentCents)}</td>
                    <td>
                      <select value={u.role} onChange={(e) => setRole(u, e.target.value)} aria-label={`Role for ${u.name}`}>
                        <option value="customer">Customer</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} pages={data.pages} onChange={(page) => setQuery({ ...query, page })} />
        </>
      )}
    </div>
  );
}
