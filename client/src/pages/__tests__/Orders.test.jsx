import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import OrdersPage from '../OrdersPage';
import OrderDetailPage from '../OrderDetailPage';
import { ordersApi } from '../../api';
import { customer, renderWithProviders } from '../../test/renderWithProviders';

vi.mock('../../api', () => ({ ordersApi: { list: vi.fn(), get: vi.fn(), cancel: vi.fn() } }));

const makeOrder = (overrides = {}) => ({
  _id: 'o1',
  orderNumber: 'FL-20261017-A1B2C3',
  createdAt: '2026-10-17T10:00:00.000Z',
  status: 'paid',
  items: [{ product: 'p1', name: 'Monstera Deliciosa', price: 3200, quantity: 2 }],
  totals: { subtotal: 6400, discount: 0, shipping: 0, vat: 1067, total: 6400 },
  discountCode: null,
  payment: { method: 'card', last4: '4242' },
  shippingAddress: { fullName: 'Sam Okafor', line1: '14 Elm Row', line2: '', city: 'Leeds', postcode: 'LS6 2AB', country: 'United Kingdom' },
  statusHistory: [{ status: 'paid', note: 'Payment received', at: '2026-10-17T10:00:00.000Z' }],
  ...overrides,
});

const renderDetail = (route = '/orders/o1') =>
  renderWithProviders(<OrderDetailPage />, { route, path: '/orders/:id', auth: { user: customer } });

describe('OrdersPage (order processing module)', () => {
  test('lists past orders with status and total', async () => {
    ordersApi.list.mockResolvedValue({
      orders: [makeOrder(), makeOrder({ _id: 'o2', orderNumber: 'FL-20261001-FFFFFF', status: 'delivered' })],
    });
    renderWithProviders(<OrdersPage />, { route: '/orders', path: '/orders', auth: { user: customer } });

    expect(await screen.findByText('FL-20261017-A1B2C3')).toBeInTheDocument();
    expect(screen.getByText('Delivered')).toBeInTheDocument();
    expect(screen.getAllByText('£64.00')).toHaveLength(2);
    expect(screen.getByText('FL-20261001-FFFFFF').closest('a')).toHaveAttribute('href', '/orders/o2');
  });

  test('empty state when there are no orders', async () => {
    ordersApi.list.mockResolvedValue({ orders: [] });
    renderWithProviders(<OrdersPage />, { route: '/orders', path: '/orders', auth: { user: customer } });
    expect(await screen.findByRole('heading', { name: 'No orders yet' })).toBeInTheDocument();
  });
});

describe('OrderDetailPage (order processing module)', () => {
  test('shows a thank-you banner straight after checkout', async () => {
    ordersApi.get.mockResolvedValue({ order: makeOrder() });
    renderDetail('/orders/o1?placed=1');

    expect(await screen.findByText(/Thanks, your order's in/)).toBeInTheDocument();
    expect(screen.getByText('2 × Monstera Deliciosa')).toBeInTheDocument();
    expect(screen.getByText(/card ending 4242/)).toBeInTheDocument();
  });

  test('a paid order can be cancelled after confirming', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    ordersApi.get.mockResolvedValue({ order: makeOrder() });
    ordersApi.cancel.mockResolvedValue({
      order: makeOrder({
        status: 'cancelled',
        statusHistory: [
          ...makeOrder().statusHistory,
          { status: 'cancelled', note: 'Cancelled by customer', at: '2026-10-17T11:00:00.000Z' },
        ],
      }),
    });
    renderDetail();

    await user.click(await screen.findByRole('button', { name: 'Cancel order' }));

    expect(ordersApi.cancel).toHaveBeenCalledWith('o1');
    expect(await screen.findByText('Cancelled by customer')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel order' })).not.toBeInTheDocument();
  });

  test('nothing happens if the shopper changes their mind', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    ordersApi.get.mockResolvedValue({ order: makeOrder() });
    renderDetail();

    await user.click(await screen.findByRole('button', { name: 'Cancel order' }));
    expect(ordersApi.cancel).not.toHaveBeenCalled();
  });

  test('shipped orders cannot be cancelled from the site', async () => {
    ordersApi.get.mockResolvedValue({ order: makeOrder({ status: 'shipped' }) });
    renderDetail();

    expect(await screen.findByText('Shipped')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel order' })).not.toBeInTheDocument();
  });
});
