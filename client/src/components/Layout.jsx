import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, ScrollRestoration, useLocation, useNavigate } from 'react-router';
import {
  ChevronDown, Heart, LayoutDashboard, LogOut, Menu, Package, ShieldCheck, ShoppingCart, Truck, User, RotateCcw, X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useFreeShippingThreshold, useShop } from '../context/ShopContext.jsx';
import DeptIcon from './DeptIcon.jsx';
import SearchBox from './SearchBox.jsx';

function Logo() {
  return (
    <Link to="/" className="logo" aria-label="ShopVerse home">
      <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="var(--accent)" />
        <path d="M9 11h14l-1.6 9.2a2 2 0 0 1-2 1.8h-6.8a2 2 0 0 1-2-1.8L9 11Zm3.5 0V9.5a3.5 3.5 0 0 1 7 0V11" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>Shop<b>Verse</b></span>
    </Link>
  );
}

function AccountMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  if (!user) {
    return (
      <Link to="/login" state={{ from: location.pathname + location.search }} className="header-action">
        <User size={22} />
        <span className="header-action-text"><small>Hello, sign in</small>Account</span>
      </Link>
    );
  }
  return (
    <div className="account-menu" ref={ref}>
      <button className="header-action" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu">
        <User size={22} />
        <span className="header-action-text"><small>Hello, {user.name.split(' ')[0]}</small><span className="inline-row">Account <ChevronDown size={14} /></span></span>
      </button>
      {open && (
        <div className="dropdown" role="menu">
          <Link to="/account" role="menuitem"><User size={16} /> Your account</Link>
          <Link to="/orders" role="menuitem"><Package size={16} /> Your orders</Link>
          <Link to="/wishlist" role="menuitem"><Heart size={16} /> Wishlist</Link>
          {user.role === 'admin' && <Link to="/admin" role="menuitem"><LayoutDashboard size={16} /> Admin dashboard</Link>}
          <button role="menuitem" onClick={async () => { await logout(); navigate('/'); }}><LogOut size={16} /> Sign out</button>
        </div>
      )}
    </div>
  );
}

function DepartmentDrawer({ open, onClose }) {
  const { departments } = useShop();
  const [expanded, setExpanded] = useState(null);
  if (!open) return null;
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()} aria-label="All departments">
        <div className="drawer-head">
          <strong>Shop by department</strong>
          <button className="icon-btn" onClick={onClose} aria-label="Close menu"><X size={20} /></button>
        </div>
        <ul className="drawer-list">
          {departments.map((d) => (
            <li key={d.slug}>
              <button className="drawer-dept" onClick={() => setExpanded(expanded === d.slug ? null : d.slug)} aria-expanded={expanded === d.slug}>
                <DeptIcon name={d.icon} size={18} />
                <span>{d.name}</span>
                <ChevronDown size={16} className={expanded === d.slug ? 'rot' : ''} />
              </button>
              {expanded === d.slug && (
                <ul className="drawer-cats">
                  <li><Link to={`/c/${d.slug}`} onClick={onClose}><b>All {d.name}</b></Link></li>
                  {d.categories.map((c) => (
                    <li key={c.slug}><Link to={`/c/${d.slug}/${c.slug}`} onClick={onClose}>{c.name}</Link></li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

export default function Layout() {
  const { count } = useCart();
  const { departments } = useShop();
  const [drawer, setDrawer] = useState(false);
  const freeOver = useFreeShippingThreshold();
  const location = useLocation();
  useEffect(() => setDrawer(false), [location.pathname]);

  return (
    <>
      <a href="#main" className="skip-link">Skip to content</a>
      <header className="site-header">
        <div className="header-main container">
          <Logo />
          <SearchBox />
          <nav className="header-actions">
            <AccountMenu />
            <Link to="/orders" className="header-action hide-sm">
              <Package size={22} />
              <span className="header-action-text"><small>Returns</small>&amp; Orders</span>
            </Link>
            <Link to="/cart" className="header-action cart-link" aria-label={`Cart, ${count} items`}>
              <span className="cart-icon">
                <ShoppingCart size={24} />
                {count > 0 && <span className="cart-count">{count > 99 ? '99+' : count}</span>}
              </span>
              <span className="header-action-text hide-sm">Cart</span>
            </Link>
          </nav>
        </div>
        <div className="header-nav">
          <div className="container nav-row">
            <button className="nav-all" onClick={() => setDrawer(true)}>
              <Menu size={18} /> All
            </button>
            {departments.slice(0, 9).map((d) => (
              <NavLink key={d.slug} to={`/c/${d.slug}`} className="nav-link">{d.name}</NavLink>
            ))}
            <NavLink to="/deals" className="nav-link nav-deals">Today's Deals</NavLink>
          </div>
        </div>
      </header>
      <DepartmentDrawer open={drawer} onClose={() => setDrawer(false)} />

      <main id="main" className="site-main">
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="container footer-perks">
          <div><Truck size={22} /><span><b>Free delivery</b> on orders over {freeOver}</span></div>
          <div><RotateCcw size={22} /><span><b>Easy cancellation</b> before your order ships</span></div>
          <div><ShieldCheck size={22} /><span><b>Secure checkout</b> powered by Stripe</span></div>
        </div>
        <div className="container footer-grid">
          <div>
            <Logo />
            <p className="muted">Everything you need, delivered. Shop 138,000+ products across {departments.length || 17} departments.</p>
          </div>
          <div>
            <h3>Shop</h3>
            {departments.slice(0, 6).map((d) => <Link key={d.slug} to={`/c/${d.slug}`}>{d.name}</Link>)}
            <Link to="/departments">All departments</Link>
          </div>
          <div>
            <h3>Your account</h3>
            <Link to="/account">Account settings</Link>
            <Link to="/orders">Orders</Link>
            <Link to="/wishlist">Wishlist</Link>
            <Link to="/cart">Cart</Link>
          </div>
          <div>
            <h3>About</h3>
            <Link to="/about">About this project</Link>
            <a href="https://www.kaggle.com/datasets/asaniczka/amazon-products-dataset-2023-1-4m-products" target="_blank" rel="noreferrer">Dataset source</a>
          </div>
        </div>
        <div className="container footer-bottom">© {new Date().getFullYear()} ShopVerse. Product data and images from the Amazon Products 2023 dataset (Kaggle).</div>
      </footer>
      <ScrollRestoration />
    </>
  );
}
