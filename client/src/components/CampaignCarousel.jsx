import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatMoney } from '../lib/format.js';
import { ProductImage } from './ui.jsx';

const INTERVAL_MS = 6000;

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** Rotating campaign banners built from the store's own product photos. */
export default function CampaignCarousel({ campaigns }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = campaigns.length;

  useEffect(() => {
    if (paused || count < 2 || prefersReducedMotion()) return;
    const t = setTimeout(() => setIndex((i) => (i + 1) % count), INTERVAL_MS);
    return () => clearTimeout(t);
  }, [index, paused, count]);

  if (!count) return null;
  const go = (i) => setIndex((i + count) % count);

  return (
    <section
      className="campaigns"
      aria-roledescription="carousel"
      aria-label="Featured campaigns"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="campaign-track" style={{ transform: `translateX(-${index * 100}%)` }}>
        {campaigns.map((c, i) => (
          <article
            key={c.id}
            className={`campaign theme-${c.theme}`}
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${count}: ${c.eyebrow}`}
            aria-hidden={i !== index}
          >
            <div className="campaign-copy">
              <span className="campaign-eyebrow">{c.eyebrow}</span>
              <h2>{c.title}</h2>
              <p className="campaign-offer">
                {c.offerPercent ? <>Up to <b>{c.offerPercent}% off</b></> : <>Starting at <b>{formatMoney(c.fromPriceCents)}</b></>}
              </p>
              <Link to={c.link} className="btn campaign-cta" tabIndex={i === index ? 0 : -1}>
                Shop now <ArrowRight size={18} />
              </Link>
            </div>
            <div className="campaign-products">
              {c.products.map((p) => (
                <Link key={p.id} to={`/p/${p.id}/${p.slug}`} className="campaign-product" tabIndex={i === index ? 0 : -1} title={p.title}>
                  <ProductImage src={p.imageLarge} alt={p.title} eager={i === 0} />
                  <span className="campaign-price">{formatMoney(p.priceCents)}</span>
                </Link>
              ))}
            </div>
          </article>
        ))}
      </div>
      {count > 1 && (
        <>
          <button className="campaign-nav prev" onClick={() => go(index - 1)} aria-label="Previous banner"><ChevronLeft size={22} /></button>
          <button className="campaign-nav next" onClick={() => go(index + 1)} aria-label="Next banner"><ChevronRight size={22} /></button>
          <div className="campaign-dots" role="tablist" aria-label="Choose banner">
            {campaigns.map((c, i) => (
              <button
                key={c.id}
                role="tab"
                aria-selected={i === index}
                aria-label={c.eyebrow}
                className={i === index ? 'active' : ''}
                onClick={() => go(i)}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
