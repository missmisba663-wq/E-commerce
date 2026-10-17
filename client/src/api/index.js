import { request } from './client';

export { ApiError, tokenStore } from './client';

export const authApi = {
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  register: (details) => request('/auth/register', { method: 'POST', body: details }),
  me: () => request('/auth/me'),
};

export const productsApi = {
  list: (params) => request('/products', { params }),
  get: (idOrSlug) => request(`/products/${encodeURIComponent(idOrSlug)}`),
  categories: () => request('/products/categories'),
};

export const cartApi = {
  get: () => request('/cart'),
  add: (productId, quantity = 1) => request('/cart/items', { method: 'POST', body: { productId, quantity } }),
  update: (productId, quantity) => request(`/cart/items/${productId}`, { method: 'PATCH', body: { quantity } }),
  remove: (productId) => request(`/cart/items/${productId}`, { method: 'DELETE' }),
  clear: () => request('/cart', { method: 'DELETE' }),
};

export const checkoutApi = {
  quote: (discountCode) => request('/checkout/quote', { method: 'POST', body: { discountCode } }),
  placeOrder: (payload) => request('/checkout', { method: 'POST', body: payload }),
};

export const ordersApi = {
  list: () => request('/orders'),
  get: (id) => request(`/orders/${id}`),
  cancel: (id) => request(`/orders/${id}/cancel`, { method: 'POST' }),
};

export const adminApi = {
  stats: () => request('/admin/stats'),
  products: (params) => request('/admin/products', { params }),
  createProduct: (data) => request('/admin/products', { method: 'POST', body: data }),
  updateProduct: (id, data) => request(`/admin/products/${id}`, { method: 'PUT', body: data }),
  archiveProduct: (id) => request(`/admin/products/${id}`, { method: 'DELETE' }),
  orders: (params) => request('/admin/orders', { params }),
  updateOrderStatus: (id, status, note) =>
    request(`/admin/orders/${id}/status`, { method: 'PATCH', body: { status, note } }),
};
