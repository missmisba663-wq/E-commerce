import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import CheckoutPage from '../CheckoutPage';
import { checkoutApi, ApiError } from '../../api';
import { customer, makeCart, makeProduct, renderWithProviders } from '../../test/renderWithProviders';

vi.mock('../../api', async () => {
  const { ApiError: RealApiError } = await vi.importActual('../../api/client');
  return { ApiError: RealApiError, checkoutApi: { quote: vi.fn(), placeOrder: vi.fn() } };
});

const cart = makeCart([{ product: makeProduct(), quantity: 1 }]); // £32.00

const baseQuote = { subtotal: 3200, discount: 0, discountCode: null, shipping: 495, vat: 616, total: 3695 };

const renderCheckout = (extra = {}) =>
  renderWithProviders(<CheckoutPage />, {
    route: '/checkout',
    path: '/checkout',
    auth: { user: customer },
    cart: { cart, ...extra },
  });

async function fillForm(user, card = '4242 4242 4242 4242') {
  await user.type(screen.getByLabelText('Address line 1'), '14 Elm Row');
  await user.type(screen.getByLabelText('Town or city'), 'Leeds');
  await user.type(screen.getByLabelText('Postcode'), 'LS6 2AB');
  await user.type(screen.getByLabelText('Card number'), card);
  await user.type(screen.getByLabelText('Expiry (MM/YY)'), '12/39');
  await user.type(screen.getByLabelText('CVC'), '123');
}

beforeEach(() => {
  checkoutApi.quote.mockResolvedValue({ totals: baseQuote });
});

describe('CheckoutPage (checkout module)', () => {
  test('shows the server-calculated totals, with the name pre-filled', async () => {
    renderCheckout();

    expect(await screen.findByRole('button', { name: 'Pay £36.95' })).toBeEnabled();
    expect(screen.getByText('£4.95')).toBeInTheDocument();
    expect(screen.getByLabelText('Full name')).toHaveValue('Sam Okafor');
  });

  test('applies a discount code and shows the saving', async () => {
    const user = userEvent.setup();
    checkoutApi.quote.mockResolvedValueOnce({ totals: baseQuote }).mockResolvedValueOnce({
      totals: { ...baseQuote, discount: 320, discountCode: 'WELCOME10', total: 3375 },
    });
    renderCheckout();

    await user.type(screen.getByLabelText('Discount code'), 'welcome10');
    await user.click(screen.getByRole('button', { name: 'Apply' }));

    expect(checkoutApi.quote).toHaveBeenLastCalledWith('welcome10');
    expect(await screen.findByText('Discount (WELCOME10)')).toBeInTheDocument();
    expect(screen.getByText('−£3.20')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pay £33.75' })).toBeInTheDocument();
  });

  test('explains why a discount code was rejected', async () => {
    const user = userEvent.setup();
    checkoutApi.quote
      .mockResolvedValueOnce({ totals: baseQuote })
      .mockRejectedValueOnce(new ApiError("That discount code isn't valid", 400));
    renderCheckout();

    await user.type(screen.getByLabelText('Discount code'), 'NOPE');
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(await screen.findByText("That discount code isn't valid")).toBeInTheDocument();
  });

  test('places the order, clears the basket and shows the confirmation', async () => {
    const user = userEvent.setup();
    checkoutApi.placeOrder.mockResolvedValue({ order: { _id: 'order123' } });
    const { cart: cartCtx } = renderCheckout();

    await screen.findByRole('button', { name: 'Pay £36.95' });
    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Pay £36.95' }));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/orders/order123?placed=1'));
    expect(checkoutApi.placeOrder).toHaveBeenCalledWith({
      shippingAddress: { fullName: 'Sam Okafor', line1: '14 Elm Row', line2: '', city: 'Leeds', postcode: 'LS6 2AB' },
      discountCode: undefined,
      payment: { cardNumber: '4242 4242 4242 4242', expiry: '12/39', cvc: '123' },
    });
    expect(cartCtx.reset).toHaveBeenCalled();
  });

  test('a declined card keeps the shopper on the page with the reason', async () => {
    const user = userEvent.setup();
    checkoutApi.placeOrder.mockRejectedValue(new ApiError('Your card was declined. No money was taken.', 402));
    const { cart: cartCtx } = renderCheckout();

    await screen.findByRole('button', { name: 'Pay £36.95' });
    await fillForm(user, '4000 0000 0000 0002');
    await user.click(screen.getByRole('button', { name: 'Pay £36.95' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Your card was declined');
    expect(cartCtx.reset).not.toHaveBeenCalled();
    expect(screen.getByTestId('location')).toHaveTextContent('/checkout');
  });

  test('puts server validation errors next to the right fields', async () => {
    const user = userEvent.setup();
    checkoutApi.placeOrder.mockRejectedValue(
      new ApiError('Some fields need attention', 400, [{ field: 'shippingAddress.postcode', message: 'This field is required' }])
    );
    renderCheckout();

    await user.click(await screen.findByRole('button', { name: 'Pay £36.95' }));

    expect(await screen.findByText('This field is required')).toBeInTheDocument();
    expect(screen.getByLabelText('Postcode')).toHaveAttribute('aria-invalid', 'true');
  });

  test('an empty basket goes back to the basket page', () => {
    renderWithProviders(<CheckoutPage />, {
      route: '/checkout',
      path: '/checkout',
      auth: { user: customer },
      cart: { cart: makeCart([]) },
    });
    expect(screen.getByTestId('location')).toHaveTextContent('/cart');
  });
});
