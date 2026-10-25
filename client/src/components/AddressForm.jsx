import { useState } from 'react';
import { Field } from './ui.jsx';

export const EMPTY_ADDRESS = {
  fullName: '', phone: '', line1: '', line2: '', city: '', state: '', postalCode: '', country: 'India', isDefault: false,
};

/** Controlled address fields; server-side validation messages are mapped back onto fields. */
export default function AddressForm({ initial = EMPTY_ADDRESS, onSubmit, submitLabel = 'Save address', onCancel, extra }) {
  const [a, setA] = useState({ ...EMPTY_ADDRESS, ...initial });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setA((s) => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      await onSubmit(a);
    } catch (err) {
      const fieldErrors = {};
      for (const d of err.details || []) fieldErrors[d.field.replace(/^address\./, '')] = d.message;
      setErrors(Object.keys(fieldErrors).length ? fieldErrors : { form: err.message });
    } finally {
      setBusy(false);
    }
  }

  const input = (k, props = {}) => <input id={`addr-${k}`} value={a[k]} onChange={set(k)} {...props} />;

  return (
    <form className="address-form" onSubmit={submit} noValidate>
      {errors.form && <div className="alert alert-error">{errors.form}</div>}
      <div className="grid-2">
        <Field label="Full name" id="addr-fullName" error={errors.fullName}>{input('fullName', { autoComplete: 'name', required: true })}</Field>
        <Field label="Phone number" id="addr-phone" error={errors.phone} hint="For delivery updates">{input('phone', { autoComplete: 'tel', type: 'tel', required: true, placeholder: '+91 98765 43210' })}</Field>
      </div>
      <Field label="Address line 1" id="addr-line1" error={errors.line1}>{input('line1', { autoComplete: 'address-line1', placeholder: 'Flat, house no., building, street', required: true })}</Field>
      <Field label="Address line 2 (optional)" id="addr-line2" error={errors.line2}>{input('line2', { autoComplete: 'address-line2', placeholder: 'Area, landmark' })}</Field>
      <div className="grid-3">
        <Field label="Town / City" id="addr-city" error={errors.city}>{input('city', { autoComplete: 'address-level2', required: true })}</Field>
        <Field label="State" id="addr-state" error={errors.state}>{input('state', { autoComplete: 'address-level1', required: true })}</Field>
        <Field label="PIN code" id="addr-postalCode" error={errors.postalCode}>{input('postalCode', { autoComplete: 'postal-code', required: true })}</Field>
      </div>
      <Field label="Country" id="addr-country" error={errors.country}>{input('country', { autoComplete: 'country-name', required: true })}</Field>
      {extra?.(a, setA)}
      <div className="row gap">
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : submitLabel}</button>
        {onCancel && <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}
