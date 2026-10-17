import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { cartApi } from '../api';
import { useAuth } from './AuthContext';

export const EMPTY_CART = { items: [], itemCount: 0, subtotal: 0 };

export const CartContext = createContext(null);

export function CartProvider({ children }) {
  const { user } = useAuth();
  const [cart, setCart] = useState(EMPTY_CART);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await cartApi.get();
      setCart(data.cart);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) refresh().catch(() => setCart(EMPTY_CART));
    else setCart(EMPTY_CART);
  }, [user, refresh]);

  // Each change returns the updated basket from the server, so the totals always match what checkout will charge.
  const apply = useCallback(async (call) => {
    const data = await call();
    setCart(data.cart);
    return data.cart;
  }, []);

  const value = useMemo(
    () => ({
      cart,
      loading,
      refresh,
      addItem: (productId, quantity) => apply(() => cartApi.add(productId, quantity)),
      updateItem: (productId, quantity) => apply(() => cartApi.update(productId, quantity)),
      removeItem: (productId) => apply(() => cartApi.remove(productId)),
      reset: () => setCart(EMPTY_CART),
    }),
    [cart, loading, refresh, apply]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
}
