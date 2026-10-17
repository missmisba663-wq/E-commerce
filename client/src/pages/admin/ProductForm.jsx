import { useState } from 'react';
import { CATEGORY_META } from '../../utils/catalog';
import { penceToPounds, poundsToPence } from '../../utils/format';

const blank = { name: '', description: '', price: '', category: 'plants', stock: '0', imageUrl: '' };

function toFormValues(product) {
  if (!product) return blank;
  return {
    name: product.name,
    description: product.description || '',
    price: penceToPounds(product.price),
    category: product.category,
    stock: String(product.stock),
    imageUrl: product.imageUrl || '',
  };
}

// Used for both creating and editing. The parent handles the API call and passes back any server-side errors.
export default function ProductForm({ product, onSubmit, onCancel, serverErrors = {} }) {
  const [values, setValues] = useState(() => toFormValues(product));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (key) => (e) => setValues({ ...values, [key]: e.target.value });

  const submit = async (event) => {
    event.preventDefault();
    const price = poundsToPence(values.price);
    const stock = Number(values.stock);

    const found = {};
    if (!values.name.trim()) found.name = 'Give the product a name';
    if (price === null) found.price = 'Enter a price like 12.99';
    if (!Number.isInteger(stock) || stock < 0) found.stock = 'Stock must be 0 or more';
    setErrors(found);
    if (Object.keys(found).length) return;

    setSaving(true);
    try {
      await onSubmit({
        name: values.name.trim(),
        description: values.description.trim(),
        price,
        category: values.category,
        stock,
        imageUrl: values.imageUrl.trim(),
      });
    } finally {
      setSaving(false);
    }
  };

  const errorFor = (key) => errors[key] || serverErrors[key];

  return (
    <form className="product-form" onSubmit={submit} noValidate aria-label={product ? 'Edit product' : 'New product'}>
      <h2>{product ? `Edit ${product.name}` : 'New product'}</h2>

      <div className="field">
        <label htmlFor="pf-name">Name</label>
        <input id="pf-name" value={values.name} onChange={set('name')} />
        {errorFor('name') && <span className="field-error">{errorFor('name')}</span>}
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="pf-price">Price (£)</label>
          <input id="pf-price" inputMode="decimal" value={values.price} onChange={set('price')} />
          {errorFor('price') && <span className="field-error">{errorFor('price')}</span>}
        </div>
        <div className="field">
          <label htmlFor="pf-stock">Stock</label>
          <input id="pf-stock" type="number" min="0" value={values.stock} onChange={set('stock')} />
          {errorFor('stock') && <span className="field-error">{errorFor('stock')}</span>}
        </div>
        <div className="field">
          <label htmlFor="pf-category">Category</label>
          <select id="pf-category" value={values.category} onChange={set('category')}>
            {Object.entries(CATEGORY_META).map(([key, meta]) => (
              <option key={key} value={key}>
                {meta.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="field">
        <label htmlFor="pf-image">Image URL (optional)</label>
        <input id="pf-image" type="url" value={values.imageUrl} onChange={set('imageUrl')} />
      </div>

      <div className="field">
        <label htmlFor="pf-description">Description</label>
        <textarea id="pf-description" rows={4} value={values.description} onChange={set('description')} />
      </div>

      <div className="form-actions">
        <button type="submit" className="primary" disabled={saving}>
          {saving ? 'Saving…' : product ? 'Save changes' : 'Create product'}
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
