import { useState } from 'react';
import { Link } from 'react-router';
import { Heart, MapPin, Package, Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '../api/client.js';
import AddressForm from '../components/AddressForm.jsx';
import { Field, Spinner } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useApi, useDocumentTitle } from '../hooks/useApi.js';
import { formatDate } from '../lib/format.js';

export default function AccountPage() {
  useDocumentTitle('Your account');
  const { user } = useAuth();
  return (
    <div className="container narrow account">
      <h1>Your account</h1>
      <p className="muted">Member since {formatDate(user.createdAt)}</p>
      <div className="account-links">
        <Link to="/orders" className="card account-link"><Package size={28} /><span><b>Your orders</b><br /><small>Track, cancel or review</small></span></Link>
        <Link to="/wishlist" className="card account-link"><Heart size={28} /><span><b>Wishlist</b><br /><small>Items you saved</small></span></Link>
        <a href="#addresses" className="card account-link"><MapPin size={28} /><span><b>Addresses</b><br /><small>Delivery addresses</small></span></a>
      </div>
      <ProfileForm />
      <PasswordForm />
      <Addresses />
    </div>
  );
}

function ProfileForm() {
  const { user, setUser } = useAuth();
  const { toast, error } = useToast();
  const [name, setName] = useState(user.name);
  async function submit(e) {
    e.preventDefault();
    try {
      setUser((await api.patch('/auth/me', { name })).user);
      toast('Profile updated');
    } catch (err) {
      error(err.message);
    }
  }
  return (
    <section className="card">
      <h2>Profile</h2>
      <form onSubmit={submit} className="inline-form">
        <Field label="Name" id="profile-name"><input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} /></Field>
        <Field label="Email" id="profile-email"><input id="profile-email" value={user.email} disabled /></Field>
        <button className="btn btn-primary" disabled={name.trim() === user.name}>Save</button>
      </form>
    </section>
  );
}

function PasswordForm() {
  const { toast } = useToast();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '' });
  const [err, setErr] = useState(null);
  async function submit(e) {
    e.preventDefault();
    setErr(null);
    try {
      await api.post('/auth/me/password', form);
      setForm({ currentPassword: '', newPassword: '' });
      toast('Password changed');
    } catch (e2) {
      setErr(e2.message);
    }
  }
  return (
    <section className="card">
      <h2>Change password</h2>
      {err && <div className="alert alert-error">{err}</div>}
      <form onSubmit={submit} className="inline-form">
        <Field label="Current password" id="pw-current"><input id="pw-current" type="password" autoComplete="current-password" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} required /></Field>
        <Field label="New password" id="pw-new" hint="8+ characters with a letter and a number"><input id="pw-new" type="password" autoComplete="new-password" value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} required /></Field>
        <button className="btn btn-primary">Update password</button>
      </form>
    </section>
  );
}

function Addresses() {
  const { data, setData } = useApi('/account/addresses');
  const { toast, error } = useToast();
  const [editing, setEditing] = useState(null); // null | 'new' | address

  async function save(a) {
    const res = editing === 'new' ? await api.post('/account/addresses', a) : await api.put(`/account/addresses/${editing.id}`, a);
    setData({ addresses: res.addresses });
    setEditing(null);
    toast('Address saved');
  }
  async function remove(id) {
    if (!window.confirm('Delete this address?')) return;
    try {
      setData(await api.del(`/account/addresses/${id}`));
    } catch (e) {
      error(e.message);
    }
  }

  return (
    <section className="card" id="addresses">
      <div className="section-head">
        <h2>Your addresses</h2>
        {!editing && <button className="btn btn-secondary btn-sm" onClick={() => setEditing('new')}><Plus size={16} /> Add address</button>}
      </div>
      {editing ? (
        <AddressForm
          initial={editing === 'new' ? undefined : editing}
          onSubmit={save}
          onCancel={() => setEditing(null)}
          extra={(a, setA) => (
            <label className="check"><input type="checkbox" checked={a.isDefault} onChange={(e) => setA({ ...a, isDefault: e.target.checked })} /> Make this my default address</label>
          )}
        />
      ) : !data ? <Spinner /> : data.addresses.length === 0 ? (
        <p className="muted">No saved addresses yet. You can add one here or during checkout.</p>
      ) : (
        <div className="address-grid">
          {data.addresses.map((a) => (
            <div key={a.id} className="address-card">
              {a.isDefault && <span className="badge">Default</span>}
              <p><b>{a.fullName}</b><br />{a.line1}{a.line2 && <>, {a.line2}</>}<br />{a.city}, {a.state} {a.postalCode}<br />{a.country}<br /><span className="muted">{a.phone}</span></p>
              <div className="row gap">
                <button className="link-btn" onClick={() => setEditing(a)}><Pencil size={14} /> Edit</button>
                <button className="link-btn danger" onClick={() => remove(a.id)}><Trash2 size={14} /> Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
