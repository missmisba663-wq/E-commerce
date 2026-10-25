import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import Logo from '../components/Logo.jsx';
import { Field } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useDocumentTitle } from '../hooks/useApi.js';

function useRedirectTarget() {
  const location = useLocation();
  const from = location.state?.from;
  return { from: from && !from.startsWith('/login') && !from.startsWith('/register') ? from : '/', reason: location.state?.reason };
}

function AuthShell({ title, children, footer }) {
  return (
    <div className="auth-page">
      <Logo className="auth-logo" />
      <div className="card auth-card">
        <h1>{title}</h1>
        {children}
      </div>
      {footer}
    </div>
  );
}

export function LoginPage() {
  useDocumentTitle('Sign in');
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const { from, reason } = useRedirectTarget();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={from} replace />;

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(form.email, form.password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Sign in"
      footer={(
        <div className="auth-footer">
          <div className="divider"><span>New to ShopVerse?</span></div>
          <Link to="/register" state={{ from }} className="btn btn-secondary btn-block">Create your ShopVerse account</Link>
        </div>
      )}
    >
      {reason && <div className="alert alert-info">{reason}</div>}
      {error && <div className="alert alert-error">{error}</div>}
      <form onSubmit={submit}>
        <Field label="Email" id="login-email"><input id="login-email" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required autoFocus /></Field>
        <Field label="Password" id="login-password"><input id="login-password" type="password" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></Field>
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </AuthShell>
  );
}

export function RegisterPage() {
  useDocumentTitle('Create account');
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const { from } = useRedirectTarget();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={from} replace />;

  async function submit(e) {
    e.preventDefault();
    if (form.password !== form.confirm) return setErrors({ confirm: 'Passwords do not match' });
    setBusy(true);
    setErrors({});
    try {
      await register({ name: form.name, email: form.email, password: form.password });
      navigate(from, { replace: true });
    } catch (err) {
      const fieldErrors = Object.fromEntries((err.details || []).map((d) => [d.field, d.message]));
      setErrors(Object.keys(fieldErrors).length ? fieldErrors : { form: err.message });
      setBusy(false);
    }
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <AuthShell
      title="Create account"
      footer={<p className="auth-footer center">Already have an account? <Link to="/login" state={{ from }}>Sign in</Link></p>}
    >
      {errors.form && <div className="alert alert-error">{errors.form}</div>}
      <form onSubmit={submit} noValidate>
        <Field label="Your name" id="reg-name" error={errors.name}><input id="reg-name" autoComplete="name" value={form.name} onChange={set('name')} required autoFocus /></Field>
        <Field label="Email" id="reg-email" error={errors.email}><input id="reg-email" type="email" autoComplete="email" value={form.email} onChange={set('email')} required /></Field>
        <Field label="Password" id="reg-password" error={errors.password} hint="At least 8 characters, with a letter and a number">
          <input id="reg-password" type="password" autoComplete="new-password" value={form.password} onChange={set('password')} required />
        </Field>
        <Field label="Re-enter password" id="reg-confirm" error={errors.confirm}><input id="reg-confirm" type="password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} required /></Field>
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
      </form>
    </AuthShell>
  );
}
