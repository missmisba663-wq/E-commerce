import { Navigate, Outlet, createBrowserRouter, useLocation } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import Layout from './components/Layout.jsx';
import { Spinner } from './components/ui.jsx';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { CartProvider } from './context/CartContext.jsx';
import { ShopProvider } from './context/ShopContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { WishlistProvider } from './context/WishlistContext.jsx';
import AccountPage from './pages/AccountPage.jsx';
import { LoginPage, RegisterPage } from './pages/AuthPages.jsx';
import BrowsePage from './pages/BrowsePage.jsx';
import CartPage from './pages/CartPage.jsx';
import CheckoutPage from './pages/CheckoutPage.jsx';
import HomePage from './pages/HomePage.jsx';
import { AboutPage, DepartmentsPage, NotFoundPage } from './pages/MiscPages.jsx';
import OrderDetailPage from './pages/OrderDetailPage.jsx';
import OrdersPage from './pages/OrdersPage.jsx';
import ProductPage from './pages/ProductPage.jsx';
import WishlistPage from './pages/WishlistPage.jsx';
import AdminDashboard from './pages/admin/AdminDashboard.jsx';
import AdminLayout from './pages/admin/AdminLayout.jsx';
import { AdminOrderDetail, AdminOrders } from './pages/admin/AdminOrders.jsx';
import { AdminCustomers, AdminProducts } from './pages/admin/AdminProducts.jsx';

function RequireAuth({ admin = false }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner block />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (admin && user.role !== 'admin') return <NotFoundPage />;
  return <Outlet />;
}

/** Providers that need router context (navigation from the wishlist) live inside the route tree. */
function Root() {
  return (
    <WishlistProvider>
      <Outlet />
    </WishlistProvider>
  );
}

export const routes = [
  {
    element: <Root />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      {
        element: <Layout />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'search', element: <BrowsePage /> },
          { path: 'deals', element: <BrowsePage deals /> },
          { path: 'departments', element: <DepartmentsPage /> },
          { path: 'c/:department', element: <BrowsePage /> },
          { path: 'c/:department/:category', element: <BrowsePage /> },
          { path: 'p/:id/:slug?', element: <ProductPage /> },
          { path: 'cart', element: <CartPage /> },
          { path: 'about', element: <AboutPage /> },
          {
            element: <RequireAuth />,
            children: [
              { path: 'checkout', element: <CheckoutPage /> },
              { path: 'orders', element: <OrdersPage /> },
              { path: 'orders/:id', element: <OrderDetailPage /> },
              { path: 'wishlist', element: <WishlistPage /> },
              { path: 'account', element: <AccountPage /> },
            ],
          },
          {
            path: 'admin',
            element: <RequireAuth admin />,
            children: [{
              element: <AdminLayout />,
              children: [
                { index: true, element: <AdminDashboard /> },
                { path: 'orders', element: <AdminOrders /> },
                { path: 'orders/:id', element: <AdminOrderDetail /> },
                { path: 'products', element: <AdminProducts /> },
                { path: 'customers', element: <AdminCustomers /> },
              ],
            }],
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
];

const router = createBrowserRouter(routes);

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <ShopProvider>
          <CartProvider>
            <RouterProvider router={router} />
          </CartProvider>
        </ShopProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
