const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });

export const formatPrice = (pence) => gbp.format((Number(pence) || 0) / 100);

export const formatDate = (value) =>
  new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

// The admin form takes pounds ("12.99") but the API wants pence (1299). Returns null if the input is nonsense.
export function poundsToPence(input) {
  const text = String(input ?? '').trim().replace(/^£/, '');
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  return Math.round(Number(text) * 100);
}

export const penceToPounds = (pence) => (Number(pence) / 100).toFixed(2);

export const pluralise = (count, word, plural = `${word}s`) => `${count} ${count === 1 ? word : plural}`;
