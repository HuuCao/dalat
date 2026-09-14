import {
  isDate, isTime, isTimezone, toMinutes, toDate,
  dateText, dateRangeText, derivePeriod, fillTemplate,
} from '../lib/time.js';

const MAPS_SEARCH_URL = 'https://www.google.com/maps/search/?api=1&query=';

export function buildTrip(raw) {
  validateTrip(raw);

  const days = [...raw.days]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((day, index) => buildDay(day, index + 1, raw.timezone));
  const items = days.flatMap((day) => day.items);
  const dayCount = days.length;
  const nightCount = Math.max(dayCount - 1, 0);
  const vars = {
    days: dayCount,
    nights: nightCount,
    dates: dateRangeText(days[0].date, days[days.length - 1].date),
  };
  const { hero } = raw;
  const footer = raw.footer ?? {};

  return {
    timezone: raw.timezone,
    hero: {
      eyebrow: hero.eyebrow ?? '',
      title: hero.title,
      subtitle: fillTemplate(hero.subtitle ?? '', vars),
      chips: hero.chips ?? [],
      image: hero.image ? buildImageSet(hero.image) : null,
      thumbs: (hero.thumbs ?? []).map(buildImageSet),
    },
    footer: {
      title: fillTemplate(footer.title ?? '', vars),
      note: footer.note ?? '',
    },
    dayCount,
    nightCount,
    placeCount: items.filter((item) => !item.empty).length,
    start: items[0].start,
    end: items[items.length - 1].end,
    items,
    days,
  };
}

export function countText(placeCount, emptyCount) {
  const parts = [];
  if (placeCount > 0) parts.push(`${placeCount} điểm`);
  if (emptyCount > 0) parts.push(`${emptyCount} khung trống`);
  return parts.join(' · ') || 'Chưa có lịch';
}

function buildDay(day, index, timezone) {
  const id = `day-${index}`;
  const items = [...day.items]
    .sort((a, b) => toMinutes(a.start) - toMinutes(b.start))
    .map((item, order) => buildItem(item, { id: `${id}-item-${order + 1}`, dayId: id, order, date: day.date, timezone }));
  const placeCount = items.filter((item) => !item.empty).length;
  const emptyCount = items.length - placeCount;

  return {
    index,
    id,
    date: day.date,
    label: `Day ${index}`,
    icon: day.icon ?? '',
    dateText: dateText(day.date),
    rangeText: items.length > 0 ? `${items[0].startText} → ${items[items.length - 1].endText}` : '',
    note: day.note ?? '',
    placeCount,
    emptyCount,
    countText: countText(placeCount, emptyCount),
    items,
  };
}

function buildItem(item, { id, dayId, order, date, timezone }) {
  const icon = item.icon ?? '';
  return {
    id,
    dayId,
    order,
    start: toDate(date, item.start, timezone),
    end: toDate(date, item.end, timezone),
    startText: item.start,
    endText: item.end,
    period: derivePeriod(item.start, item.end),
    icon,
    title: item.title,
    ...splitTitle(item.title),
    heading: icon ? `${icon} ${item.title}` : item.title,
    tag: item.tag ?? '',
    // "Street food" → "street-food": picks the category colour in CSS.
    tagKey: (item.tag ?? '').trim().toLowerCase().replace(/\s+/g, '-'),
    mapUrl: item.map ? MAPS_SEARCH_URL + encodeURIComponent(item.map) : null,
    empty: item.empty === true,
  };
}

// "Đồi chè Cầu Đất — săn mây, ăn sáng" → name + detail, so a card can set the
// place apart from what happens there.
function splitTitle(title) {
  const [name, ...rest] = title.split(' — ');
  return { name, detail: rest.join(' — ') };
}

function buildImageSet(image) {
  const widths = [...image.widths].sort((a, b) => a - b);
  const url = (width) => image.src.replaceAll('{w}', String(width));
  return {
    src: url(widths[widths.length - 1]),
    srcset: widths.map((width) => `${url(width)} ${width}w`).join(', '),
  };
}

function fail(path, message) {
  throw new Error(`${path}: ${message}`);
}

function validateTrip(raw) {
  if (!raw || typeof raw !== 'object') fail('trip', 'phải là object');
  if (!isTimezone(raw.timezone)) fail('timezone', 'phải có dạng +07:00');
  if (typeof raw.hero?.title !== 'string' || !raw.hero.title.trim()) fail('hero.title', 'bắt buộc');
  if (raw.hero.image != null) validateImage(raw.hero.image, 'hero.image');
  (raw.hero.thumbs ?? []).forEach((thumb, i) => validateImage(thumb, `hero.thumbs[${i}]`));
  if (!Array.isArray(raw.days) || raw.days.length === 0) fail('days', 'phải là mảng có ít nhất 1 ngày');
  raw.days.forEach((day, i) => validateDay(day, `days[${i}]`));
  if (!raw.days.some((day) => day.items.length > 0)) fail('days', 'cần ít nhất 1 khung giờ');
}

function validateImage(image, path) {
  if (!image || typeof image !== 'object') fail(path, 'phải là { src, widths }');
  if (typeof image.src !== 'string' || !image.src.includes('{w}')) fail(`${path}.src`, 'phải chứa {w}');
  const widthsOk = Array.isArray(image.widths) && image.widths.length > 0
    && image.widths.every((width) => Number.isInteger(width) && width > 0);
  if (!widthsOk) fail(`${path}.widths`, 'phải là mảng số nguyên dương');
}

function validateDay(day, path) {
  if (!day || typeof day !== 'object') fail(path, 'phải là object');
  if (!isDate(day.date)) fail(`${path}.date`, 'phải có dạng YYYY-MM-DD');
  if (!Array.isArray(day.items)) fail(`${path}.items`, 'phải là mảng');
  day.items.forEach((item, i) => validateItem(item, `${path}.items[${i}]`));
}

function validateItem(item, path) {
  if (!item || typeof item !== 'object') fail(path, 'phải là object');
  if (typeof item.title !== 'string' || !item.title.trim()) fail(`${path}.title`, 'bắt buộc');
  if (!isTime(item.start)) fail(`${path}.start`, 'phải có dạng HH:MM');
  if (!isTime(item.end)) fail(`${path}.end`, 'phải có dạng HH:MM');
  if (toMinutes(item.end) <= toMinutes(item.start)) fail(`${path}.end`, 'phải sau start');
}
