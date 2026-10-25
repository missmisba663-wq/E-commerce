import { Link } from 'react-router';

/** ShopVerse wordmark with the designer's signature underneath. */
export default function Logo({ className = '' }) {
  return (
    <Link to="/" className={`logo ${className}`} aria-label="ShopVerse by Misbah, home">
      <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="var(--accent)" />
        <path d="M9 11h14l-1.6 9.2a2 2 0 0 1-2 1.8h-6.8a2 2 0 0 1-2-1.8L9 11Zm3.5 0V9.5a3.5 3.5 0 0 1 7 0V11" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="logo-text">
        <span className="logo-name">Shop<b>Verse</b></span>
        <span className="logo-by">by Misbah</span>
      </span>
    </Link>
  );
}
