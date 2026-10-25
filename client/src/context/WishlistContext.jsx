import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { api } from '../api/client.js';
import { useAuth } from './AuthContext.jsx';
import { useToast } from './ToastContext.jsx';

const WishlistContext = createContext(null);

export function WishlistProvider({ children }) {
  const { user } = useAuth();
  const { toast, error } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [ids, setIds] = useState(() => new Set());

  useEffect(() => {
    if (!user) return setIds(new Set());
    api.get('/account/wishlist/ids').then((d) => setIds(new Set(d.ids))).catch(() => {});
  }, [user]);

  const toggle = useCallback(async (productId) => {
    if (!user) {
      navigate('/login', { state: { from: location.pathname + location.search, reason: 'Sign in to save items to your wishlist' } });
      return;
    }
    const saved = ids.has(productId);
    setIds((s) => {
      const next = new Set(s);
      if (saved) next.delete(productId);
      else next.add(productId);
      return next;
    });
    try {
      if (saved) await api.del(`/account/wishlist/${productId}`);
      else await api.put(`/account/wishlist/${productId}`);
      toast(saved ? 'Removed from your wishlist' : 'Saved to your wishlist');
    } catch (e) {
      setIds((s) => {
        const next = new Set(s);
        if (saved) next.add(productId);
        else next.delete(productId);
        return next;
      });
      error(e.message);
    }
  }, [user, ids, navigate, location, toast, error]);

  const value = useMemo(() => ({ has: (id) => ids.has(id), toggle, count: ids.size }), [ids, toggle]);
  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export const useWishlist = () => useContext(WishlistContext);
