import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ProductCard from '../components/ProductCard.jsx';
import { AuthProvider } from '../context/AuthContext.jsx';
import { CartProvider, useCart } from '../context/CartContext.jsx';
import { ToastProvider } from '../context/ToastContext.jsx';
import { WishlistProvider } from '../context/WishlistContext.jsx';

const product = {
  id: 7,
  slug: 'wireless-headphones',
  title: 'Wireless Headphones with Noise Cancelling',
  image: 'https://m.media-amazon.com/images/I/x._AC_UL320_.jpg',
  priceCents: 249900,
  listPriceCents: 399900,
  discountPercent: 38,
  stars: 4.5,
  ratingCount: 1234,
  boughtLastMonth: 2000,
  isBestseller: true,
  stock: 12,
  inStock: true,
  category: { slug: 'headphones', name: 'Headphones' },
  department: { slug: 'electronics', name: 'Electronics' },
};

/** Fake API: guest session, cart preview echoes priced items. */
function mockApi() {
  return vi.fn(async (url, opts = {}) => {
    const json = (body) => ({ ok: true, status: 200, json: async () => body });
    if (url === '/api/auth/me') return json({ user: null });
    if (url === '/api/cart/preview') {
      const { items } = JSON.parse(opts.body);
      const lines = items.map((i) => ({ product, quantity: i.quantity }));
      const subtotal = lines.reduce((s, l) => s + l.product.priceCents * l.quantity, 0);
      return json({ items: lines, warnings: [], subtotalCents: subtotal, shippingCents: 0, taxCents: 0, totalCents: subtotal });
    }
    return { ok: false, status: 404, json: async () => ({ error: 'not found' }) };
  });
}

function CartCount() {
  const { count } = useCart();
  return <span data-testid="count">{count}</span>;
}

function renderWithShop(ui) {
  const router = createMemoryRouter([
    {
      element: <WishlistProvider><Outlet /></WishlistProvider>,
      children: [
        { path: '/', element: <>{ui}<CartCount /></> },
        { path: '/login', element: <p>Login page</p> },
      ],
    },
  ]);
  return render(
    <ToastProvider>
      <AuthProvider>
        <CartProvider>
          <RouterProvider router={router} />
        </CartProvider>
      </AuthProvider>
    </ToastProvider>,
  );
}

describe('ProductCard', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', mockApi());
  });
  afterEach(() => vi.unstubAllGlobals());

  it('shows price, discount and best-seller badge', async () => {
    renderWithShop(<ProductCard product={product} />);
    expect(screen.getByText('₹2,499')).toBeInTheDocument();
    expect(screen.getByText('₹3,999')).toBeInTheDocument();
    expect(screen.getByText('38% off')).toBeInTheDocument();
    expect(screen.getByText('Best Seller')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: product.title })).toHaveAttribute('href', '/p/7/wireless-headphones');
  });

  it('adds to a guest cart stored in localStorage', async () => {
    const user = userEvent.setup();
    renderWithShop(<ProductCard product={product} />);
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('0'));
    await user.click(screen.getByRole('button', { name: /add to cart/i }));
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('1'));
    expect(JSON.parse(localStorage.getItem('sv_guest_cart'))).toEqual([{ productId: 7, quantity: 1 }]);
    expect(await screen.findByText('Added to cart')).toBeInTheDocument();
  });

  it('sends guests to sign in when they tap the wishlist heart', async () => {
    const user = userEvent.setup();
    renderWithShop(<ProductCard product={product} />);
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('0'));
    await user.click(screen.getByRole('button', { name: /save to wishlist/i }));
    expect(await screen.findByText('Login page')).toBeInTheDocument();
  });

  it('disables purchase when out of stock', () => {
    renderWithShop(<ProductCard product={{ ...product, inStock: false, stock: 0 }} />);
    expect(screen.getByRole('button', { name: /out of stock/i })).toBeDisabled();
  });
});
