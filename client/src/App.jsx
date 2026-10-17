import { Link, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import Header from './components/Header';
import RequireAuth from './components/RequireAuth';
import CataloguePage from './pages/CataloguePage';
import ProductPage from './pages/ProductPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import OrdersPage from './pages/OrdersPage';
import OrderDetailPage from './pages/OrderDetailPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import NotFoundPage from './pages/NotFoundPage';
import CreditsPage from './pages/CreditsPage';
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminProducts from './pages/admin/AdminProducts';
import AdminOrders from './pages/admin/AdminOrders';

const signedIn = (page) => <RequireAuth>{page}</RequireAuth>;

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <Header />
        <main className="container">
          <Routes>
            <Route path="/" element={<CataloguePage />} />
            <Route path="/products/:slug" element={<ProductPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/credits" element={<CreditsPage />} />
            <Route path="/cart" element={signedIn(<CartPage />)} />
            <Route path="/checkout" element={signedIn(<CheckoutPage />)} />
            <Route path="/orders" element={signedIn(<OrdersPage />)} />
            <Route path="/orders/:id" element={signedIn(<OrderDetailPage />)} />
            <Route
              path="/admin"
              element={
                <RequireAuth admin>
                  <AdminLayout />
                </RequireAuth>
              }
            >
              <Route index element={<AdminDashboard />} />
              <Route path="products" element={<AdminProducts />} />
              <Route path="orders" element={<AdminOrders />} />
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </main>
        <footer className="site-footer">
          <div className="container footer-inner">
            <div>
              <p className="footer-brand">🌿 Fernleaf Supply Co.</p>
              <p>
                A small team of plant people in a converted greenhouse outside Harrogate. We started Fernleaf because we
                were tired of plants arriving half-dead in a sea of polystyrene.
              </p>
            </div>
            <div>
              <p>Free UK delivery over £50 · Dispatched Monday to Thursday so nothing sits in a depot over the weekend</p>
              <p>
                <Link to="/credits">Photo credits</Link>
              </p>
            </div>
          </div>
        </footer>
      </CartProvider>
    </AuthProvider>
  );
}
