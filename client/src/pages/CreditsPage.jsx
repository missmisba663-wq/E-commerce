import { useEffect, useState } from 'react';
import Loading from '../components/Loading';

// The photos are Creative Commons and public-domain images from Wikimedia Commons. Their licences ask for credit, so here it is.
export default function CreditsPage() {
  const [credits, setCredits] = useState(null);

  useEffect(() => {
    fetch('/images/credits.json')
      .then((res) => res.json())
      .then(setCredits)
      .catch(() => setCredits([]));
  }, []);

  return (
    <div className="credits-page">
      <h1>Photo credits</h1>
      <p className="muted">
        Every photo in the shop was taken by a photographer who generously shared it on Wikimedia Commons. Thank you.
      </p>
      {!credits ? (
        <Loading />
      ) : (
        <ul className="plain-list">
          {credits.map((c) => (
            <li key={c.file}>
              <span>
                <strong>{c.subject}</strong>
                <br />
                <span className="muted">
                  {c.author}, {c.license}
                </span>
              </span>
              <a href={c.source} target="_blank" rel="noreferrer">
                View original
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
