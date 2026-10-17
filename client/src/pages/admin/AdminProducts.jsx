import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../../api';
import ProductForm from './ProductForm';
import Loading from '../../components/Loading';
import Alert from '../../components/Alert';
import { formatPrice } from '../../utils/format';
import { LOW_STOCK, categoryLabel } from '../../utils/catalog';

export default function AdminProducts() {
  const [products, setProducts] = useState(null);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null); // null = closed, 'new' = create, otherwise the product being edited
  const [serverErrors, setServerErrors] = useState({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(() => {
    adminApi
      .products({ search })
      .then((res) => setProducts(res.products))
      .catch((err) => setError(err.message));
  }, [search]);

  useEffect(() => {
    load();
  }, [load]);

  const openForm = (target) => {
    setServerErrors({});
    setNotice('');
    setEditing(target);
  };

  const save = async (data) => {
    setError('');
    try {
      if (editing === 'new') {
        const { product } = await adminApi.createProduct(data);
        setNotice(`${product.name} is now live in the shop.`);
      } else {
        const { product } = await adminApi.updateProduct(editing._id, data);
        setNotice(`Saved changes to ${product.name}.`);
      }
      setEditing(null);
      load();
    } catch (err) {
      setError(err.message);
      setServerErrors(err.fieldErrors || {});
    }
  };

  const toggleArchive = async (product) => {
    setError('');
    try {
      if (product.isActive) {
        if (!window.confirm(`Archive ${product.name}? It will disappear from the shop, but past orders keep it.`)) return;
        await adminApi.archiveProduct(product._id);
        setNotice(`${product.name} archived.`);
      } else {
        await adminApi.updateProduct(product._id, { isActive: true });
        setNotice(`${product.name} is back in the shop.`);
      }
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="admin-products">
      <div className="admin-toolbar">
        <h1>Products</h1>
        <input
          type="search"
          aria-label="Search products"
          placeholder="Search by name"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button type="button" className="primary" onClick={() => openForm('new')}>
          New product
        </button>
      </div>

      <Alert tone="success">{notice}</Alert>
      <Alert>{error}</Alert>

      {editing && (
        <ProductForm
          key={editing === 'new' ? 'new' : editing._id}
          product={editing === 'new' ? null : editing}
          serverErrors={serverErrors}
          onSubmit={save}
          onCancel={() => setEditing(null)}
        />
      )}

      {!products ? (
        <Loading />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Category</th>
                <th scope="col">Price</th>
                <th scope="col">Stock</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p._id} className={p.isActive ? '' : 'archived'}>
                  <td>{p.name}</td>
                  <td>{categoryLabel(p.category)}</td>
                  <td>{formatPrice(p.price)}</td>
                  <td className={p.stock <= LOW_STOCK ? 'stock-note low' : ''}>{p.stock}</td>
                  <td>{p.isActive ? 'Live' : 'Archived'}</td>
                  <td className="row-actions">
                    <button type="button" className="link-button" onClick={() => openForm(p)}>
                      Edit
                    </button>
                    <button type="button" className="link-button" onClick={() => toggleArchive(p)}>
                      {p.isActive ? 'Archive' : 'Restore'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {products.length === 0 && <p className="muted">No products match.</p>}
        </div>
      )}
    </div>
  );
}
