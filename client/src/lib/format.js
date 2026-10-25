// Amounts arrive in paise. Whole-rupee prices drop the decimals, as Indian stores show them (₹1,099).
const rupees = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const rupeesExact = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 });
const rupeesCompact = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', notation: 'compact', maximumFractionDigits: 1 });
const compact = new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 });

export const formatMoney = (paise) => ((paise || 0) % 100 === 0 ? rupees : rupeesExact).format((paise || 0) / 100);
export const formatMoneyCompact = (paise) => rupeesCompact.format((paise || 0) / 100);
export const formatCompact = (n) => compact.format(n || 0);
export const formatNumber = (n) => (n || 0).toLocaleString('en-IN');

// SQLite datetimes are UTC without a zone marker.
const parse = (s) => new Date(s.includes('T') ? s : `${s.replace(' ', 'T')}Z`);

export const formatDate = (s) => parse(s).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
export const formatDateTime = (s) =>
  parse(s).toLocaleString('en-IN', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

export const productPath = (p) => `/p/${p.id}/${p.slug || ''}`;

export function plural(n, word, pluralWord = `${word}s`) {
  return `${formatNumber(n)} ${n === 1 ? word : pluralWord}`;
}
