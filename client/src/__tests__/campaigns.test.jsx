import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import CampaignCarousel from '../components/CampaignCarousel.jsx';

const product = (id) => ({ id, slug: `p${id}`, title: `Product ${id}`, imageLarge: `https://m.media-amazon.com/images/I/${id}.jpg`, priceCents: 109900 });
const campaigns = [
  { id: 'fragrance', eyebrow: 'Fragrance Festival', title: 'Find your signature scent', theme: 'plum', offerPercent: 40, fromPriceCents: 29900, link: '/c/beauty/perfumes?sale=1', products: [1, 2, 3].map(product) },
  { id: 'toys', eyebrow: 'Build & Play', title: 'Building sets kids love', theme: 'sun', offerPercent: null, fromPriceCents: 30900, link: '/c/toys-games/building-toys', products: [4, 5, 6].map(product) },
];

describe('CampaignCarousel', () => {
  it('shows offers from live data and links to the category', () => {
    render(<MemoryRouter><CampaignCarousel campaigns={campaigns} /></MemoryRouter>);
    expect(screen.getByText('40% off')).toBeInTheDocument();
    expect(screen.getByText('₹309')).toBeInTheDocument(); // "Starting at" when there's no real discount
    expect(screen.getAllByRole('link', { name: /shop now/i })[0]).toHaveAttribute('href', '/c/beauty/perfumes?sale=1');
  });

  it('moves between slides with the arrows and dots', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><CampaignCarousel campaigns={campaigns} /></MemoryRouter>);
    const slide = (name) => screen.getByLabelText(new RegExp(name), { selector: 'article' });
    expect(slide('Fragrance Festival')).toHaveAttribute('aria-hidden', 'false');
    await user.click(screen.getByRole('button', { name: 'Next banner' }));
    expect(slide('Build & Play')).toHaveAttribute('aria-hidden', 'false');
    expect(slide('Fragrance Festival')).toHaveAttribute('aria-hidden', 'true');
    await user.click(screen.getByRole('tab', { name: 'Fragrance Festival' }));
    expect(slide('Fragrance Festival')).toHaveAttribute('aria-hidden', 'false');
  });
});
