import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import ProductPage from '../ProductPage';
import { productsApi } from '../../api';
import { customer, makeProduct, renderWithProviders } from '../../test/renderWithProviders';

vi.mock('../../api', () => ({ productsApi: { get: vi.fn() } }));

const renderPage = (options = {}) =>
  renderWithProviders(<ProductPage />, { route: '/products/monstera-deliciosa', path: '/products/:slug', ...options });

describe('ProductPage (catalogue + cart modules)', () => {
  test('loads the product from the slug in the URL', async () => {
    productsApi.get.mockResolvedValue({ product: makeProduct() });
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Monstera Deliciosa' })).toBeInTheDocument();
    expect(productsApi.get).toHaveBeenCalledWith('monstera-deliciosa');
    expect(screen.getByText('The Swiss cheese plant.')).toBeInTheDocument();
  });

  test('adds the chosen quantity to the basket', async () => {
    const user = userEvent.setup();
    productsApi.get.mockResolvedValue({ product: makeProduct() });
    const addItem = vi.fn().mockResolvedValue({});
    renderPage({ auth: { user: customer }, cart: { addItem } });

    await user.selectOptions(await screen.findByLabelText(/Quantity/), '3');
    await user.click(screen.getByRole('button', { name: 'Add to basket' }));

    expect(addItem).toHaveBeenCalledWith('p1', 3);
    expect(await screen.findByText(/Added 3 × Monstera Deliciosa/)).toBeInTheDocument();
  });

  test('never offers more than is in stock', async () => {
    productsApi.get.mockResolvedValue({ product: makeProduct({ stock: 2 }) });
    renderPage({ auth: { user: customer } });

    const select = await screen.findByLabelText(/Quantity/);
    expect(Array.from(select.options).map((o) => o.value)).toEqual(['1', '2']);
    expect(screen.getByText('Only 2 left')).toBeInTheDocument();
  });

  test('sends guests to sign in, remembering where they were', async () => {
    const user = userEvent.setup();
    productsApi.get.mockResolvedValue({ product: makeProduct() });
    const { cart } = renderPage();

    await user.click(await screen.findByRole('button', { name: 'Add to basket' }));

    expect(cart.addItem).not.toHaveBeenCalled();
    expect(screen.getByTestId('location')).toHaveTextContent('/login');
  });

  test('shows the server message if adding fails, e.g. stock ran out', async () => {
    const user = userEvent.setup();
    productsApi.get.mockResolvedValue({ product: makeProduct() });
    const addItem = vi.fn().mockRejectedValue(new Error('Only 1 of Monstera Deliciosa left in stock'));
    renderPage({ auth: { user: customer }, cart: { addItem } });

    await user.click(await screen.findByRole('button', { name: 'Add to basket' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Only 1 of Monstera Deliciosa left in stock');
  });

  test('sold-out products cannot be added', async () => {
    productsApi.get.mockResolvedValue({ product: makeProduct({ stock: 0 }) });
    renderPage({ auth: { user: customer } });

    expect(await screen.findByText(/Out of stock/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add to basket' })).not.toBeInTheDocument();
  });

  test('shows the photo, its credit and the care notes', async () => {
    productsApi.get.mockResolvedValue({
      product: makeProduct({
        imageUrl: '/images/products/monstera-deliciosa.jpg',
        imageCredit: { author: 'kallerna', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:x.jpg' },
        care: { light: 'Bright, indirect', water: 'When the top 5cm is dry', petSafe: false },
      }),
    });
    renderPage();

    expect(await screen.findByRole('img', { name: 'Monstera Deliciosa' })).toHaveAttribute(
      'src',
      '/images/products/monstera-deliciosa.jpg'
    );
    expect(screen.getByText(/Photo: kallerna, CC BY-SA 4.0/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Looking after it' })).toBeInTheDocument();
    expect(screen.getByText('Bright, indirect')).toBeInTheDocument();
    expect(screen.getByText('Keep away from curious cats and dogs')).toBeInTheDocument();
  });

  test('pots and tools have no care card', async () => {
    productsApi.get.mockResolvedValue({ product: makeProduct({ category: 'pots', care: undefined }) });
    renderPage();
    await screen.findByRole('heading', { name: 'Monstera Deliciosa' });
    expect(screen.queryByRole('heading', { name: 'Looking after it' })).not.toBeInTheDocument();
  });

  test('unknown products show a not-found message', async () => {
    productsApi.get.mockRejectedValue(new Error('not found'));
    renderPage();
    expect(await screen.findByRole('heading', { name: /couldn't find that plant/ })).toBeInTheDocument();
  });
});
