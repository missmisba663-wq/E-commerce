import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';
import { formatMoney } from '../lib/format.js';

const ShopContext = createContext({ departments: [], config: null });

/** Store-wide data loaded once: the department tree and checkout settings. */
export function ShopProvider({ children }) {
  const [departments, setDepartments] = useState([]);
  const [config, setConfig] = useState(null);

  useEffect(() => {
    api.get('/catalog/departments').then((d) => setDepartments(d.departments)).catch(() => {});
    api.get('/config').then(setConfig).catch(() => {});
  }, []);

  const value = useMemo(() => ({
    departments,
    config,
    department: (slug) => departments.find((d) => d.slug === slug),
  }), [departments, config]);
  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export const useShop = () => useContext(ShopContext);

/** e.g. "₹499", from the server's delivery rules (with a fallback while they load). */
export function useFreeShippingThreshold() {
  const { config } = useShop();
  return formatMoney(config?.freeShippingThresholdCents ?? 49900);
}
