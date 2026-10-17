import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import AdminDashboard from '../AdminDashboard';
import AdminProducts from '../AdminProducts';
import AdminOrders from '../AdminOrders';
import { adminApi, ApiError } from '../../../api';
import { admin, makeProduct, renderWithProviders } from '../../../test/renderWithProviders';

vi.mock('../../../api', async () => {
  const { ApiError: RealApiError } = await vi.importActual('../../../api/client');
  return {
    ApiError: RealApiError,
    adminApi: {
      stats: vi.fn(),
      products: vi.fn(),
      createProduct: vi.fn(),
      updateProduct: vi.fn(),
      archiveProduct: vi.fn(),
      orders: vi.fn(),
      updateOrderStatus: vi.fn(),
    },
  };
});

const renderAdmin = (ui, route) => renderWithProviders(ui, { route, path: route.split('?')[0], auth: { user: admin } });

describe('Admin dashboard (admin module)', () => {
  test('shows the headline numbers and low-stock warnings', async () => {
    adminApi.stats.mockResolvedValue({
      stats: {
        revenue: 128450,
        orderCount: 42,
        productCount: 16,
        customerCount: 31,
        ordersByStatus: { paid: 3, packed: 1, shipped: 2, delivered: 35, cancelled: 1 },
        lowStock: [{ _id: 'p9', name: 'Chunky Aroid Potting Mix', stock: 2 }],
        lowStockThreshold: 5,
        recentOrders: [],
      },
    });
    renderAdmin(<AdminDashboard />, '/admin');

    expect(await screen.findByText('£1,284.50')).toBeInTheDocument();
    expect(screen.getByText('3 waiting to be packed')).toBeInTheDocument();
    expect(screen.getByText('Chunky Aroid Potting Mix')).toBeInTheDocument();
    expect(screen.getByText('2 left')).toBeInTheDocument();
  });
});

describe('Admin products (admin module)', () => {
  beforeEach(() => {
    adminApi.products.mockResolvedValue({
      products: [makeProduct(), makeProduct({ _id: 'p2', name: 'Old Fern', isActive: false })],
    });
  });

  test('lists live and archived products', async () => {
    renderAdmin(<AdminProducts />, '/admin/products');

    const row = (await screen.findByText('Old Fern')).closest('tr');
    expect(within(row).getByText('Archived')).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Restore' })).toBeInTheDocument();
  });

  test('creating a product converts pounds to pence before sending', async () => {
    const user = userEvent.setup();
    adminApi.createProduct.mockResolvedValue({ product: makeProduct({ name: 'Peace Lily' }) });
    renderAdmin(<AdminProducts />, '/admin/products');

    await user.click(await screen.findByRole('button', { name: 'New product' }));
    const form = screen.getByRole('form', { name: 'New product' });
    await user.type(within(form).getByLabelText('Name'), 'Peace Lily');
    await user.type(within(form).getByLabelText('Price (£)'), '19.99');
    await user.clear(within(form).getByLabelText('Stock'));
    await user.type(within(form).getByLabelText('Stock'), '8');
    await user.click(within(form).getByRole('button', { name: 'Create product' }));

    expect(adminApi.createProduct).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Peace Lily', price: 1999, stock: 8, category: 'plants' })
    );
    expect(await screen.findByText('Peace Lily is now live in the shop.')).toBeInTheDocument();
  });

  test('catches a bad price before calling the API', async () => {
    const user = userEvent.setup();
    renderAdmin(<AdminProducts />, '/admin/products');

    await user.click(await screen.findByRole('button', { name: 'New product' }));
    const form = screen.getByRole('form', { name: 'New product' });
    await user.type(within(form).getByLabelText('Name'), 'Peace Lily');
    await user.type(within(form).getByLabelText('Price (£)'), 'twenty');
    await user.click(within(form).getByRole('button', { name: 'Create product' }));

    expect(screen.getByText('Enter a price like 12.99')).toBeInTheDocument();
    expect(adminApi.createProduct).not.toHaveBeenCalled();
  });

  test('editing pre-fills the form and saves changes', async () => {
    const user = userEvent.setup();
    adminApi.updateProduct.mockResolvedValue({ product: makeProduct({ price: 3500 }) });
    renderAdmin(<AdminProducts />, '/admin/products');

    const row = (await screen.findByText('Monstera Deliciosa')).closest('tr');
    await user.click(within(row).getByRole('button', { name: 'Edit' }));

    const form = screen.getByRole('form', { name: 'Edit product' });
    const price = within(form).getByLabelText('Price (£)');
    expect(price).toHaveValue('32.00');
    await user.clear(price);
    await user.type(price, '35');
    await user.click(within(form).getByRole('button', { name: 'Save changes' }));

    expect(adminApi.updateProduct).toHaveBeenCalledWith('p1', expect.objectContaining({ price: 3500 }));
  });

  test('shows a server error, such as a duplicate name', async () => {
    const user = userEvent.setup();
    adminApi.createProduct.mockRejectedValue(new ApiError('Something with that slug already exists', 409));
    renderAdmin(<AdminProducts />, '/admin/products');

    await user.click(await screen.findByRole('button', { name: 'New product' }));
    const form = screen.getByRole('form', { name: 'New product' });
    await user.type(within(form).getByLabelText('Name'), 'Monstera Deliciosa');
    await user.type(within(form).getByLabelText('Price (£)'), '32');
    await user.click(within(form).getByRole('button', { name: 'Create product' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('already exists');
    expect(screen.getByRole('form', { name: 'New product' })).toBeInTheDocument(); // form stays open so nothing is lost
  });

  test('archiving asks first', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    adminApi.archiveProduct.mockResolvedValue({});
    renderAdmin(<AdminProducts />, '/admin/products');

    const row = (await screen.findByText('Monstera Deliciosa')).closest('tr');
    await user.click(within(row).getByRole('button', { name: 'Archive' }));

    expect(window.confirm).toHaveBeenCalled();
    expect(adminApi.archiveProduct).toHaveBeenCalledWith('p1');
  });
});

describe('Admin orders (admin module)', () => {
  const order = (overrides = {}) => ({
    _id: 'o1',
    orderNumber: 'FL-20261017-A1B2C3',
    createdAt: '2026-10-17T10:00:00.000Z',
    status: 'paid',
    totals: { total: 3695 },
    user: { name: 'Sam Okafor', email: 'sam@example.com' },
    ...overrides,
  });

  test('offers only the next valid steps for each order', async () => {
    adminApi.orders.mockResolvedValue({
      orders: [order(), order({ _id: 'o2', orderNumber: 'FL-2', status: 'shipped' }), order({ _id: 'o3', orderNumber: 'FL-3', status: 'delivered' })],
    });
    renderAdmin(<AdminOrders />, '/admin/orders');

    const paidRow = (await screen.findByText('FL-20261017-A1B2C3')).closest('tr');
    expect(within(paidRow).getByRole('button', { name: 'Mark packed' })).toBeInTheDocument();
    expect(within(paidRow).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();

    const shippedRow = screen.getByText('FL-2').closest('tr');
    expect(within(shippedRow).getByRole('button', { name: 'Mark delivered' })).toBeInTheDocument();
    expect(within(shippedRow).queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();

    expect(within(screen.getByText('FL-3').closest('tr')).getByText('Done')).toBeInTheDocument();
  });

  test('moving an order on updates its row', async () => {
    const user = userEvent.setup();
    adminApi.orders.mockResolvedValue({ orders: [order()] });
    adminApi.updateOrderStatus.mockResolvedValue({ order: order({ status: 'packed' }) });
    renderAdmin(<AdminOrders />, '/admin/orders');

    await user.click(await screen.findByRole('button', { name: 'Mark packed' }));

    expect(adminApi.updateOrderStatus).toHaveBeenCalledWith('o1', 'packed');
    expect(await screen.findByRole('button', { name: 'Mark shipped' })).toBeInTheDocument();
  });

  test('filtering by status asks the API for that status', async () => {
    const user = userEvent.setup();
    adminApi.orders.mockResolvedValue({ orders: [] });
    renderAdmin(<AdminOrders />, '/admin/orders');

    await user.selectOptions(screen.getByLabelText('Filter by status'), 'shipped');
    await waitFor(() => expect(adminApi.orders).toHaveBeenLastCalledWith({ status: 'shipped', limit: 50 }));
  });

  test('shows a 409 from the server if someone else got there first', async () => {
    const user = userEvent.setup();
    adminApi.orders.mockResolvedValue({ orders: [order()] });
    adminApi.updateOrderStatus.mockRejectedValue(new ApiError("An order that is shipped can't be moved to packed", 409));
    renderAdmin(<AdminOrders />, '/admin/orders');

    await user.click(await screen.findByRole('button', { name: 'Mark packed' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("can't be moved to packed");
  });
});
