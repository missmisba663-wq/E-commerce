import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="empty-state">
      <h1>This page has wilted</h1>
      <p>
        We couldn't find what you were looking for. <Link to="/">Back to the shop</Link>
      </p>
    </div>
  );
}
