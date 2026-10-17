import { STATUS_LABELS } from '../utils/catalog';

export default function StatusBadge({ status }) {
  return <span className={`status status-${status}`}>{STATUS_LABELS[status] || status}</span>;
}
