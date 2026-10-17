import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import CataloguePage from '../CataloguePage';
import { productsApi } from '../../api';
import { makeProduct, renderWithProviders } from '../../test/renderWithProviders';

vi.mock('../../api', () => ({
  productsApi: { list: vi.fn(), categories: vi.fn() },
}));

const products = [
  makeProduct(),
  makeProduct({ _id: 'p2', name: 'Calathea Orbifolia', slug: 'calathea-orbifolia', price: 2400, stock: 3 }),
  makeProduct({ _id: 'p3', name: 'String of Pearls', slug: 'string-of-pearls', price: 1450, stock: 0 }),
];

beforeEach(() => {
  productsApi.categories.mockResolvedValue({
    categories: [
      { name: 'plants', count: 3 },
      { name: 'pots', count: 0 },
      { name: 'tools', count: 0 },
      { name: 'care', count: 0 },
    ],
  });
  productsApi.list.mockResolvedValue({ products, total: 3, page: 1, totalPages: 1 });
});

describe('CataloguePage (catalogue module)', () => {
  test('shows products with prices and stock warnings', async () => {
    renderWithProviders(<CataloguePage />);

    expect(await screen.findByRole('heading', { name: 'Monstera Deliciosa' })).toBeInTheDocument();
    expect(screen.getByText('£32.00')).toBeInTheDocument();
    expect(screen.getByText('Only 3 left')).toBeInTheDocument();
    expect(screen.getByText('Out of stock')).toBeInTheDocument();
    expect(screen.getByText('3 products')).toBeInTheDocument();
  });

  test('product cards link to their detail page', async () => {
    renderWithProviders(<CataloguePage />);
    const card = (await screen.findByRole('heading', { name: 'Calathea Orbifolia' })).closest('a');
    expect(card).toHaveAttribute('href', '/products/calathea-orbifolia');
  });

  test('choosing a category filters the list and updates the URL', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CataloguePage />);

    const filters = screen.getByRole('complementary', { name: 'Filters' });
    await user.click(await within(filters).findByRole('button', { name: /Pots & planters/ }));

    await waitFor(() =>
      expect(productsApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ category: 'pots', page: 1 }))
    );
    expect(screen.getByTestId('location')).toHaveTextContent('/?category=pots');
  });

  test('searching sends the search term', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CataloguePage />);

    await user.type(screen.getByLabelText('Search'), 'fern');
    await user.click(screen.getByRole('button', { name: 'Go' }));

    await waitFor(() => expect(productsApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'fern' })));
  });

  test('changing the sort order asks the API for that order', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CataloguePage />);

    await user.selectOptions(screen.getByLabelText(/Sort by/), 'price_asc');
    await waitFor(() =>
      expect(productsApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ sort: 'price_asc' }))
    );
  });

  test('shows a friendly message when nothing matches', async () => {
    productsApi.list.mockResolvedValue({ products: [], total: 0, page: 1, totalPages: 1 });
    renderWithProviders(<CataloguePage />, { route: '/?search=cactus' });
    expect(await screen.findByText(/Nothing matches that just now/)).toBeInTheDocument();
  });

  test('shows the error if the API is down', async () => {
    productsApi.list.mockRejectedValue(new Error("We couldn't reach the shop."));
    renderWithProviders(<CataloguePage />);
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't reach the shop.");
  });

  test('paginates', async () => {
    const user = userEvent.setup();
    productsApi.list.mockResolvedValue({ products, total: 30, page: 1, totalPages: 3 });
    renderWithProviders(<CataloguePage />);

    expect(await screen.findByText('Page 1 of 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(productsApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })));
  });
});
