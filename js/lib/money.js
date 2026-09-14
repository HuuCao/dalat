const MINUS = '−';
const MILLION = 1_000_000;

const groupThousands = (value) => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

// Totals and chips. Under a million: thousands of dong, one decimal at most
// ("33,3k"). From a million: millions and whole thousands ("11tr760", "12tr").
export function formatShort(amount) {
  if (amount === 0) return '0';
  const sign = amount < 0 ? MINUS : '';
  const hundreds = Math.round(Math.abs(amount) / 100);
  if (hundreds * 100 < MILLION) {
    const whole = Math.floor(hundreds / 10);
    const fraction = hundreds % 10;
    return `${sign}${groupThousands(whole)}${fraction ? `,${fraction}` : ''}k`;
  }
  const thousands = Math.round(Math.abs(amount) / 1000);
  const rest = thousands % 1000;
  return `${sign}${groupThousands(Math.floor(thousands / 1000))}tr${rest ? String(rest).padStart(3, '0') : ''}`;
}

// Single entries: every dong.
export function formatFull(amount) {
  const sign = amount < 0 ? MINUS : '';
  return `${sign}${groupThousands(Math.abs(amount))}đ`;
}

export function formatDiff(actual, budget) {
  const diff = actual - budget;
  if (diff > 0) return { text: `▲ ${formatShort(diff)}`, tone: 'over' };
  if (diff < 0) return { text: `▼ ${formatShort(-diff)}`, tone: 'under' };
  return { text: '✓', tone: 'under' };
}