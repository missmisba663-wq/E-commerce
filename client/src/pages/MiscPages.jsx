import { Link } from 'react-router';
import { Compass } from 'lucide-react';
import DeptIcon from '../components/DeptIcon.jsx';
import { EmptyState, Spinner } from '../components/ui.jsx';
import { useShop } from '../context/ShopContext.jsx';
import { useDocumentTitle } from '../hooks/useApi.js';
import { formatNumber } from '../lib/format.js';

export function DepartmentsPage() {
  useDocumentTitle('All departments');
  const { departments } = useShop();
  if (!departments.length) return <Spinner block />;
  return (
    <div className="container">
      <h1>Shop by department</h1>
      <p className="muted">{formatNumber(departments.reduce((n, d) => n + d.productCount, 0))} products in {departments.length} departments</p>
      <div className="dept-directory">
        {departments.map((d) => (
          <section key={d.slug} className="card dept-block">
            <h2><DeptIcon name={d.icon} /> <Link to={`/c/${d.slug}`}>{d.name}</Link></h2>
            <ul>
              {d.categories.map((c) => (
                <li key={c.slug}><Link to={`/c/${d.slug}/${c.slug}`}>{c.name}</Link> <span className="muted small">{formatNumber(c.productCount)}</span></li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

export function AboutPage() {
  useDocumentTitle('About');
  return (
    <div className="container narrow prose">
      <h1>About ShopVerse</h1>
      <p className="about-credit">Designed and built by <span className="signature">Misbah</span></p>
      <p>
        ShopVerse is a full-stack e-commerce application: product discovery with full-text search and filters,
        a persistent cart, wishlist, checkout with card (Stripe) or cash on delivery, order tracking, verified
        reviews, and an admin dashboard for fulfilment and inventory.
      </p>
      <h2>Product data</h2>
      <p>
        The catalogue of 138,882 products is drawn from the{' '}
        <a href="https://www.kaggle.com/datasets/asaniczka/amazon-products-dataset-2023-1-4m-products" target="_blank" rel="noreferrer">
          Amazon Products Dataset 2023 (1.4M products)
        </a>{' '}
        on Kaggle. Titles, prices, list prices, star ratings, rating counts, best-seller flags and monthly sales
        come from the dataset, and product images are served from Amazon's image CDN. Dataset prices are in US dollars;
        they are converted to Indian rupees at a fixed rate when the catalogue is loaded and rounded to retail price points. The most popular products
        in each of 244 categories were selected.
      </p>
      <p>Stock levels are not part of the dataset, so each product starts with a generated stock quantity that the store then tracks through real orders.</p>
      <h2>Technology</h2>
      <ul>
        <li>React 19 + React Router single-page app built with Vite</li>
        <li>Node.js + Express 5 REST API, SQLite with FTS5 full-text search</li>
        <li>JWT sessions in httpOnly cookies, bcrypt password hashing, zod validation, rate limiting, Helmet security headers</li>
        <li>Stripe Checkout for card payments with webhooks and automatic refunds on cancellation</li>
      </ul>
    </div>
  );
}

export function NotFoundPage() {
  useDocumentTitle('Page not found');
  return (
    <div className="container">
      <EmptyState icon={Compass} title="We couldn't find that page" action={<Link to="/" className="btn btn-primary">Go to the home page</Link>}>
        The link may be broken or the page may have moved.
      </EmptyState>
    </div>
  );
}
