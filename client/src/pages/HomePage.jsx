import { Link } from 'react-router';
import { ArrowRight, BadgePercent, Truck } from 'lucide-react';
import CampaignCarousel from '../components/CampaignCarousel.jsx';
import DeptIcon from '../components/DeptIcon.jsx';
import { ProductRail } from '../components/ProductCard.jsx';
import { ErrorState, ProductImage, Spinner } from '../components/ui.jsx';
import { useFreeShippingThreshold, useShop } from '../context/ShopContext.jsx';
import { useApi, useDocumentTitle } from '../hooks/useApi.js';
import { formatNumber, productPath } from '../lib/format.js';

export default function HomePage() {
  useDocumentTitle(null);
  const { data, error, loading, reload } = useApi('/catalog/home');
  const { departments } = useShop();
  const freeOver = useFreeShippingThreshold();

  if (loading && !data) return <Spinner block label="Loading the store…" />;
  if (error && !data) return <div className="container"><ErrorState error={error} onRetry={reload} /></div>;

  // One deal per department keeps the hero collage varied.
  const heroPicks = data.deals.filter((p, i, all) => all.findIndex((x) => x.department.slug === p.department.slug) === i).slice(0, 4);
  const total = departments.reduce((n, d) => n + d.productCount, 0);

  return (
    <div className="home">
      <section className="hero">
        <div className="container hero-inner">
          <div className="hero-copy">
            <span className="eyebrow"><BadgePercent size={16} /> Deals refreshed daily</span>
            <h1>Everything you need,<br />delivered to your door.</h1>
            <p>
              Shop {total ? formatNumber(total) : '138,000+'} products across fashion, electronics, toys, home, beauty and more,
              with free delivery on orders over {freeOver}.
            </p>
            <div className="hero-ctas">
              <Link to="/deals" className="btn btn-primary btn-lg">Shop today's deals <ArrowRight size={18} /></Link>
              <Link to="/departments" className="btn btn-ghost-light btn-lg">Browse departments</Link>
            </div>
            <p className="hero-perk"><Truck size={18} /> Fast delivery · Cash on delivery available</p>
          </div>
          <div className="hero-collage" aria-hidden="true">
            {heroPicks.map((p) => (
              <Link key={p.id} to={productPath(p)} className="hero-tile" tabIndex={-1}>
                <ProductImage src={p.imageLarge} alt="" eager />
                <span className="hero-tile-tag">-{p.discountPercent}%</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <div className="container">
        <CampaignCarousel campaigns={data.campaigns || []} />

        <section className="dept-tiles">
          {departments.map((d) => (
            <Link key={d.slug} to={`/c/${d.slug}`} className="dept-tile">
              <span className="dept-tile-icon"><DeptIcon name={d.icon} size={24} /></span>
              <span className="dept-tile-name">{d.name}</span>
              <span className="dept-tile-count">{formatNumber(d.productCount)} items</span>
            </Link>
          ))}
        </section>

        <ProductRail title="Today's top deals" products={data.deals} link="/deals" />
        <ProductRail title="Best sellers" products={data.bestsellers} link="/search?bestseller=1" />
        {data.departments.slice(0, 3).map((d) => (
          <ProductRail key={d.slug} title={`Popular in ${d.name}`} products={d.products} link={`/c/${d.slug}`} linkLabel={`Shop ${d.name}`} />
        ))}
        <ProductRail title="Top rated by thousands of shoppers" products={data.topRated} link="/search?minRating=4.5&sort=rating" />
        {data.departments.slice(3).map((d) => (
          <ProductRail key={d.slug} title={`Popular in ${d.name}`} products={d.products} link={`/c/${d.slug}`} linkLabel={`Shop ${d.name}`} />
        ))}
      </div>
    </div>
  );
}
