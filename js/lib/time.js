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

// "T6", "CN": weekday for tight spots such as the day tabs.
export function shortWeekdayText(date) {
  return weekdayText(date).replace('Th ', 'T');
}

export function shortDateText(date) {
  const [, month, day] = date.split('-');
  return `${shortWeekdayText(date)} ${day}/${month}`;
}

// "16 – 18/10" within a month, "30/10 – 02/11" across two.
export function dateRangeText(start, end) {
  const [, startMonth, startDay] = start.split('-');
  const [, endMonth, endDay] = end.split('-');
  if (start === end) return `${startDay}/${startMonth}`;
  if (startMonth === endMonth) return `${startDay} – ${endDay}/${endMonth}`;
  return `${startDay}/${startMonth} – ${endDay}/${endMonth}`;
}

function periodAt(minutes) {
  let name = PERIODS[0][1];
  for (const [from, period] of PERIODS) {
    if (minutes >= from) name = period;
  }
  return name;
}

const capitalize = (text) => `${text[0].toUpperCase()}${text.slice(1)}`;

// The end minute is exclusive: 11:00–13:00 is still "Trưa".
export function derivePeriod(start, end) {
  const first = periodAt(toMinutes(start));
  const last = periodAt(toMinutes(end) - 1);
  return first === last ? capitalize(first) : `${capitalize(first)} → ${last}`;
}

export function fillTemplate(text, vars) {
  return text.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? String(vars[key]) : match));
}

// Time left, rounded up so "còn 1 phút" never shows once the minute is gone.
export function durationText(ms) {
  if (ms < 60_000) return '< 1 phút';
  const minutes = Math.ceil(ms / 60_000);
  // A day or more away, minutes are noise: "1 ngày 9 giờ".
  if (minutes >= 24 * 60) {
    const totalHours = Math.ceil(ms / 3_600_000);
    const days = Math.floor(totalHours / 24);
    const hoursLeft = totalHours % 24;
    return hoursLeft === 0 ? `${days} ngày` : `${days} ngày ${hoursLeft} giờ`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} phút`;
  return rest === 0 ? `${hours} giờ` : `${hours} giờ ${rest} phút`;
}

function offsetMinutes(timezone) {
  const sign = timezone.startsWith('-') ? -1 : 1;
  const [hours, minutes] = timezone.slice(1).split(':').map(Number);
  return sign * (hours * 60 + minutes);
}

// The trip's calendar date at an instant, whatever the viewer's timezone.
export function localDateOf(ms, timezone) {
  return new Date(ms + offsetMinutes(timezone) * 60_000).toISOString().slice(0, 10);
}

// Minutes since the trip's midnight at an instant, whatever the viewer's
// timezone.
export function localMinuteOf(ms, timezone) {
  const shifted = new Date(ms + offsetMinutes(timezone) * 60_000);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

// "14:05" in the viewer's own clock: when data was fetched on this phone.
export function clockText(ms) {
  return new Date(ms).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}
