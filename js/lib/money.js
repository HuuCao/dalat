const MINUS = '−';

const groupThousands = (value) => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

// Totals and chips: thousands of dong, one decimal at most.
export function formatShort(amount) {
  if (amount === 0) return '0';
  const sign = amount < 0 ? MINUS : '';
  const tenths = Math.round(Math.abs(amount) / 100);
  const whole = Math.floor(tenths / 10);
  const fraction = tenths % 10;
  return `${sign}${groupThousands(whole)}${fraction ? `,${fraction}` : ''}k`;
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

export function formatBalance(amount) {
  return amount > 0 ? `+${formatShort(amount)}` : formatShort(amount);
}
