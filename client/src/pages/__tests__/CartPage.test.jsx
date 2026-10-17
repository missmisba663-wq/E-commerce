import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import CartPage from '../CartPage';
import { customer, makeCart, makeProduct, renderWithProviders } from '../../test/renderWithProviders';

const monstera = makeProduct();
const pot = makeProduct({ _id: 'p2', name: 'Terracotta Pot', slug: 'terracotta-pot', price: 650, category: 'pots', stock: 40 });

const renderCart = (cart, extra = {}) =>
  renderWithProviders(<CartPage />, { route: '/cart', path: '/cart', auth: { user: customer }, cart: { cart, ...extra } });

describe('CartPage (cart module)', () => {
  test('lists each line with its total and the basket subtotal', () => {
    renderCart(
      makeCart([
        { product: monstera, quantity: 1 },
        { product: pot, quantity: 2 },
      ])
    );

    expect(screen.getByRole('link', { name: 'Terracotta Pot' })).toBeInTheDocument();
    expect(screen.getByText('£13.00')).toBeInTheDocument(); // 2 × £6.50
    expect(screen.getByTestId('cart-subtotal')).toHaveTextContent('£45.00');
    expect(screen.getByText('Subtotal (3 items)')).toBeInTheDocument();
  });

  test('changing a quantity updates the basket', async () => {
    const user = userEvent.setup();
    const updateItem = vi.fn().mockResolvedValue({});
    renderCart(makeCart([{ product: pot, quantity: 1 }]), { updateItem });

    await user.selectOptions(screen.getByLabelText('Quantity for Terracotta Pot'), '4');
    expect(updateItem).toHaveBeenCalledWith('p2', 4);
  });

  test('removing a line', async () => {
    const user = userEvent.setup();
    const removeItem = vi.fn().mockResolvedValue({});
    renderCart(makeCart([{ product: pot, quantity: 1 }]), { removeItem });

    await user.click(screen.getByRole('button', { name: 'Remove Terracotta Pot' }));
    expect(removeItem).toHaveBeenCalledWith('p2');
  });

  test('shows the server error if an update is refused', async () => {
    const user = userEvent.setup();
    const updateItem = vi.fn().mockRejectedValue(new Error('Only 5 of Terracotta Pot left in stock'));
    renderCart(makeCart([{ product: pot, quantity: 1 }]), { updateItem });

    await user.selectOptions(screen.getByLabelText('Quantity for Terracotta Pot'), '6');
    expect(await screen.findByRole('alert')).toHaveTextContent('Only 5 of Terracotta Pot left');
  });

  test('blocks checkout while a line is short on stock', () => {
    const scarce = makeProduct({ stock: 1 });
    renderCart(makeCart([{ product: scarce, quantity: 3 }]));

    expect(screen.getByText(/Only 1 available/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to checkout' })).toBeDisabled();
  });

  test('goes to checkout', async () => {
    const user = userEvent.setup();
    renderCart(makeCart([{ product: pot, quantity: 1 }]));

    await user.click(screen.getByRole('button', { name: 'Go to checkout' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/checkout');
  });

  test('empty basket', () => {
    renderCart(makeCart([]));
    expect(screen.getByRole('heading', { name: 'Your basket is empty' })).toBeInTheDocument();
  });
});
