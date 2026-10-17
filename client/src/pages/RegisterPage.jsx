import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Alert from '../components/Alert';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setFieldErrors({});
    try {
      await register(form);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message);
      setFieldErrors(err.fieldErrors || {});
      setBusy(false);
    }
  };

  return (
    <div className="auth-card">
      <h1>Create an account</h1>
      <form onSubmit={submit} noValidate>
        {[
          { key: 'name', label: 'Your name', type: 'text', autoComplete: 'name' },
          { key: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
          { key: 'password', label: 'Password (8+ characters)', type: 'password', autoComplete: 'new-password' },
        ].map((f) => (
          <div className="field" key={f.key}>
            <label htmlFor={f.key}>{f.label}</label>
            <input id={f.key} type={f.type} autoComplete={f.autoComplete} value={form[f.key]} onChange={set(f.key)} />
            {fieldErrors[f.key] && <span className="field-error">{fieldErrors[f.key]}</span>}
          </div>
        ))}
        <Alert>{error}</Alert>
        <button type="submit" className="primary wide" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p className="muted">
        Already have one? <Link to="/login" state={location.state}>Sign in</Link>
      </p>
    </div>
  );
}
