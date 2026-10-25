import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from './AuthContext.jsx';

const CartContext = createContext(null);
const STORAGE_KEY = 'sv_guest_cart';
const EMPTY = { items: [], warnings: [], subtotalCents: 0, shippingCents: 0, taxCents: 0, totalCents: 0 };

function readGuest() {
  try {
    const items = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(items) ? items.filter((i) => i.productId > 0 && i.quantity > 0) : [];
  } catch {
    return [];
  }
}

function writeGuest(items) {
  try {
    if (items.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage unavailable (private mode): the cart still works for this page view
  }
}

/**
 * Signed-in carts live on the server. Guest carts live in localStorage and are priced by the
 * server's /cart/preview, then merged into the account on sign-in.
 */
export function CartProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const [cart, setCart] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const guestItems = useRef(readGuest());

  const priceGuest = useCallback(async () => {
    const items = guestItems.current;
    setCart(items.length ? await api.post('/cart/preview', { items }) : EMPTY);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        let next;
        if (user) {
          const pending = guestItems.current;
          next = pending.length ? await api.post('/cart/merge', { items: pending }) : await api.get('/cart');
          guestItems.current = [];
          writeGuest([]);
        } else {
          guestItems.current = readGuest();
          next = guestItems.current.length ? await api.post('/cart/preview', { items: guestItems.current }) : EMPTY;
        }
        if (!cancelled) setCart(next);
      } catch {
        if (!cancelled) setCart(EMPTY);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, authLoading]);

  const updateGuest = useCallback(async (fn) => {
    guestItems.current = fn(guestItems.current);
    writeGuest(guestItems.current);
    await priceGuest();
  }, [priceGuest]);

  const add = useCallback(async (productId, quantity = 1) => {
    if (user) return setCart(await api.post('/cart/items', { productId, quantity }));
    await updateGuest((items) => {
      const existing = items.find((i) => i.productId === productId);
      return existing
        ? items.map((i) => (i.productId === productId ? { ...i, quantity: Math.min(10, i.quantity + quantity) } : i))
        : [{ productId, quantity }, ...items];
    });
  }, [user, updateGuest]);

  const update = useCallback(async (productId, quantity) => {
    if (user) return setCart(await api.put(`/cart/items/${productId}`, { quantity }));
    await updateGuest((items) => items.map((i) => (i.productId === productId ? { ...i, quantity } : i)));
  }, [user, updateGuest]);

  const remove = useCallback(async (productId) => {
    if (user) return setCart(await api.del(`/cart/items/${productId}`));
    await updateGuest((items) => items.filter((i) => i.productId !== productId));
  }, [user, updateGuest]);

  const refresh = useCallback(async () => {
    if (user) setCart(await api.get('/cart'));
    else await priceGuest();
  }, [user, priceGuest]);

  const value = useMemo(() => ({
    cart,
    loading,
    count: cart.items.reduce((n, i) => n + i.quantity, 0),
    quantityOf: (id) => cart.items.find((i) => i.product.id === id)?.quantity ?? 0,
    add,
    update,
    remove,
    refresh,
  }), [cart, loading, add, update, remove, refresh]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
