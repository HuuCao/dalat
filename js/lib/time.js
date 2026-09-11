const WEEKDAYS = ['CN', 'Th 2', 'Th 3', 'Th 4', 'Th 5', 'Th 6', 'Th 7'];

// First minute of each part of the day, in trip-local time.
const PERIODS = [
  [0, 'sáng'],
  [11 * 60, 'trưa'],
  [13 * 60, 'chiều'],
  [18 * 60, 'tối'],
];

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIMEZONE_PATTERN = /^[+-]\d{2}:\d{2}$/;

export function isTime(value) {
  return typeof value === 'string' && TIME_PATTERN.test(value);
}

export function isTimezone(value) {
  return typeof value === 'string' && TIMEZONE_PATTERN.test(value);
}

export function isDate(value) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function toMinutes(time) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export function toDate(date, time, timezone) {
  return new Date(`${date}T${time}:00${timezone}`);
}

// Worked out from the calendar date alone, so the viewer's timezone never
// shifts the weekday.
export function weekdayText(date) {
  const [year, month, day] = date.split('-').map(Number);
  return WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}

export function dateText(date) {
  const [, month, day] = date.split('-');
  return `${weekdayText(date)}, ${day}/${month}`;
}

function periodAt(minutes) {
  let name = PERIODS[0][1];
  for (const [from, period] of PERIODS) {
    if (minutes >= from) name = period;
  }
  return name;
}

// The end minute is exclusive: 11:00–13:00 is still "trưa".
export function derivePeriod(start, end) {
  const first = periodAt(toMinutes(start));
  const last = periodAt(toMinutes(end) - 1);
  if (first === last) return `Buổi ${first}`;
  return `${first[0].toUpperCase()}${first.slice(1)} → ${last}`;
}

export function fillTemplate(text, vars) {
  return text.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? String(vars[key]) : match));
}
