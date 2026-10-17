import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { vi } from 'vitest';
import { AuthContext } from '../context/AuthContext';
import { CartContext, EMPTY_CART } from '../context/CartContext';

// Prints the current URL so tests can check where a page sent the user.
function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname + location.search}</output>;
}

/**
 * Renders a page inside a router, with the auth and cart contexts filled by fakes,
 * so each test controls exactly who's signed in and what's in the basket.
 */
export function renderWithProviders(ui, { route = '/', path = '/', auth = {}, cart = {} } = {}) {
  const authValue = { user: null, loading: false, login: vi.fn(), register: vi.fn(), logout: vi.fn(), ...auth };
  const cartValue = {
    cart: EMPTY_CART,
    loading: false,
    refresh: vi.fn(),
    addItem: vi.fn(),
    updateItem: vi.fn(),
    removeItem: vi.fn(),
    reset: vi.fn(),
    ...cart,
  };

  const utils = render(
    <MemoryRouter initialEntries={[route]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthContext.Provider value={authValue}>
        <CartContext.Provider value={cartValue}>
          <Routes>
            <Route path={path} element={ui} />
            <Route path="*" element={null} />
          </Routes>
          <LocationProbe />
        </CartContext.Provider>
      </AuthContext.Provider>
    </MemoryRouter>
  );

  return { ...utils, auth: authValue, cart: cartValue };
}

export const customer = { _id: 'u1', name: 'Sam Okafor', email: 'sam@example.com', role: 'customer' };
export const admin = { _id: 'u2', name: 'Fernleaf Admin', email: 'admin@fernleaf.test', role: 'admin' };

export const makeProduct = (overrides = {}) => ({
  _id: 'p1',
  name: 'Monstera Deliciosa',
  slug: 'monstera-deliciosa',
  description: 'The Swiss cheese plant.',
  price: 3200,
  category: 'plants',
  stock: 14,
  imageUrl: '',
  isActive: true,
  ...overrides,
});

export const makeCart = (lines) => ({
  items: lines.map(({ product, quantity }) => ({
    product,
    quantity,
    lineTotal: product.price * quantity,
    inStock: product.stock >= quantity,
  })),
  itemCount: lines.reduce((n, l) => n + l.quantity, 0),
  subtotal: lines.reduce((s, l) => s + l.product.price * l.quantity, 0),
});
