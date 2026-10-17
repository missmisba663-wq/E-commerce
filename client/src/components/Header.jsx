import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

export default function Header() {
  const { user, logout } = useAuth();
  const { cart } = useCart();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link to="/" className="logo" aria-label="Fernleaf home">
          <span aria-hidden="true">🌿</span> Fernleaf
        </Link>

        <nav className="main-nav" aria-label="Main">
          <NavLink to="/" end>
            Shop
          </NavLink>
          {user && <NavLink to="/orders">My orders</NavLink>}
          {user?.role === 'admin' && <NavLink to="/admin">Admin</NavLink>}
        </nav>

        <div className="header-actions">
          {user ? (
            <>
              <span className="hello">Hi, {user.name.split(' ')[0]}</span>
              <button type="button" className="link-button" onClick={handleLogout}>
                Sign out
              </button>
            </>
          ) : (
            <NavLink to="/login">Sign in</NavLink>
          )}
          <NavLink to="/cart" className="basket-link" aria-label={`Basket, ${cart.itemCount} items`}>
            Basket
            {cart.itemCount > 0 && <span className="badge">{cart.itemCount}</span>}
          </NavLink>
        </div>
      </div>
    </header>
  );
}
