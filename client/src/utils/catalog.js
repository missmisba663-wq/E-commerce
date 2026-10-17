export const CATEGORY_META = {
  plants: { label: 'Plants', emoji: '🌿' },
  pots: { label: 'Pots & planters', emoji: '🪴' },
  tools: { label: 'Tools', emoji: '✂️' },
  care: { label: 'Plant care', emoji: '💧' },
};

export const categoryLabel = (name) => CATEGORY_META[name]?.label || name;

export const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'name', label: 'Name A-Z' },
];

// These mirror server/src/services/orderStatus.js. The server is the one that actually enforces them.
export const NEXT_STATUSES = {
  paid: ['packed', 'cancelled'],
  packed: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

export const STATUS_LABELS = {
  paid: 'Paid',
  packed: 'Packed',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export const LOW_STOCK = 5;
