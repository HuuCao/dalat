import {
  isDate, isTime, isTimezone, toMinutes, toDate,
  dateText, dateRangeText, derivePeriod, fillTemplate, shortDateText,
} from '../lib/time.js';
import { keyOf } from '../lib/text.js';

const MAPS_SEARCH_URL = 'https://www.google.com/maps/search/?api=1&query=';
const DOCS_URL = 'https://docs.google.com/';
const FORMS_URL = 'https://docs.google.com/forms/';
const SHARED_GROUP = 'Chung';

// Reserved words of the expense form: the fund as a payer, and the bucket for
// spending outside the plan that every day and the shared group get.
export const FUND_PAYER = 'Quỹ';
export const EXTRA_TITLE = 'Phát sinh';

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
    fund: raw.fund != null ? buildFund(raw.fund, days) : null,
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
  const label = `Day ${index}`;
  const items = [...day.items]
    .sort((a, b) => toMinutes(a.start) - toMinutes(b.start))
    .map((item, order) => buildItem(item, { id: `${id}-item-${order + 1}`, dayId: id, dayLabel: label, order, date: day.date, timezone }));
  const placeCount = items.filter((item) => !item.empty).length;
  const emptyCount = items.length - placeCount;

  return {
    index,
    id,
    date: day.date,
    label,
    // Shown on the page. `label` stays "Day N": expense form answers use it.
    title: `Ngày ${index}`,
    shortDate: shortDateText(day.date),
    icon: day.icon ?? '',
    dateText: dateText(day.date),
    rangeText: items.length > 0 ? `${items[0].startText} → ${items[items.length - 1].endText}` : '',
    note: day.note ?? '',
    placeCount,
    emptyCount,
    countText: countText(placeCount, emptyCount),
    extraLabel: `${label} · ${EXTRA_TITLE}`,
    items,
  };
}

function buildItem(item, { id, dayId, dayLabel, order, date, timezone }) {
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
    budget: item.budget ?? null,
    formLabel: `${dayLabel} · ${item.title}`,
  };
}

// Labels follow the order people meet them in the form's dropdown: shared
// costs first, then each day's slots, each group closed by its extra bucket.
function buildFund(fund, days) {
  const shared = (fund.shared ?? []).map((cost, index) => ({
    id: `shared-${index + 1}`,
    icon: cost.icon ?? '',
    title: cost.title,
    note: cost.note ?? '',
    budget: cost.budget ?? null,
    formLabel: `${SHARED_GROUP} · ${cost.title}`,
  }));
  const sharedExtra = {
    id: 'shared-extra',
    icon: '⚡',
    title: `${EXTRA_TITLE} chung`,
    note: '',
    budget: null,
    formLabel: `${SHARED_GROUP} · ${EXTRA_TITLE}`,
  };

  return {
    members: fund.members.map((name) => name.trim()),
    csv: fund.csv ? { expenses: fund.csv.expenses, contributions: fund.csv.contributions } : null,
    form: fund.form ? { url: fund.form.url, placeField: fund.form.placeField ?? null } : null,
    sheet: fund.sheet ?? null,
    shared,
    sharedExtra,
    labels: [
      ...shared.map((cost) => cost.formLabel),
      sharedExtra.formLabel,
      ...days.flatMap((day) => [...day.items.map((item) => item.formLabel), day.extraLabel]),
    ],
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

const isBudget = (value) => Number.isInteger(value) && value >= 0;
const isLink = (value, prefix) => typeof value === 'string' && value.startsWith(prefix);

function validateTrip(raw) {
  if (!raw || typeof raw !== 'object') fail('trip', 'phải là object');
  if (!isTimezone(raw.timezone)) fail('timezone', 'phải có dạng +07:00');
  if (typeof raw.hero?.title !== 'string' || !raw.hero.title.trim()) fail('hero.title', 'bắt buộc');
  if (raw.hero.image != null) validateImage(raw.hero.image, 'hero.image');
  (raw.hero.thumbs ?? []).forEach((thumb, i) => validateImage(thumb, `hero.thumbs[${i}]`));
  if (!Array.isArray(raw.days) || raw.days.length === 0) fail('days', 'phải là mảng có ít nhất 1 ngày');
  raw.days.forEach((day, i) => validateDay(day, `days[${i}]`));
  if (!raw.days.some((day) => day.items.length > 0)) fail('days', 'cần ít nhất 1 khung giờ');
  if (raw.fund != null) {
    validateFund(raw.fund);
    raw.days.forEach((day, i) => validateFormTitles(day, `days[${i}]`));
  }
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
  if (item.budget !== undefined && !isBudget(item.budget)) fail(`${path}.budget`, 'phải là số nguyên ≥ 0');
}

// A form answer names its place by label, so two slots of one day must not
// share a title, and none may take the extra bucket's name.
function validateFormTitles(day, path) {
  const seen = new Set();
  day.items.forEach((item, i) => {
    const key = keyOf(item.title);
    if (key === keyOf(EXTRA_TITLE)) fail(`${path}.items[${i}].title`, `"${EXTRA_TITLE}" là tên dành riêng`);
    if (seen.has(key)) fail(`${path}.items[${i}].title`, `trùng tên "${item.title}" trong cùng ngày`);
    seen.add(key);
  });
}

function validateFund(fund) {
  if (typeof fund !== 'object') fail('fund', 'phải là object');
  if (!Array.isArray(fund.members) || fund.members.length === 0) fail('fund.members', 'phải có ít nhất 1 người');

  const names = new Set();
  fund.members.forEach((name, i) => {
    const path = `fund.members[${i}]`;
    if (typeof name !== 'string' || !name.trim()) fail(path, 'bắt buộc');
    if (keyOf(name) === keyOf(FUND_PAYER)) fail(path, `"${FUND_PAYER}" là tên dành riêng`);
    if (names.has(keyOf(name))) fail(path, `trùng tên "${name.trim()}"`);
    names.add(keyOf(name));
  });

  if (fund.csv != null) {
    for (const key of ['expenses', 'contributions']) {
      if (!isLink(fund.csv[key], DOCS_URL)) fail(`fund.csv.${key}`, `phải là link ${DOCS_URL}`);
    }
  }
  if (fund.form != null) {
    if (!isLink(fund.form.url, FORMS_URL)) fail('fund.form.url', `phải là link ${FORMS_URL}`);
    if (fund.form.placeField != null && !/^entry\.\d+$/.test(fund.form.placeField)) {
      fail('fund.form.placeField', 'phải có dạng entry.123456');
    }
  }
  if (fund.sheet != null && !isLink(fund.sheet, DOCS_URL)) fail('fund.sheet', `phải là link ${DOCS_URL}`);

  if (fund.shared != null && !Array.isArray(fund.shared)) fail('fund.shared', 'phải là mảng');
  const titles = new Set();
  (fund.shared ?? []).forEach((cost, i) => {
    const path = `fund.shared[${i}]`;
    if (typeof cost?.title !== 'string' || !cost.title.trim()) fail(`${path}.title`, 'bắt buộc');
    if (keyOf(cost.title) === keyOf(EXTRA_TITLE)) fail(`${path}.title`, `"${EXTRA_TITLE}" là tên dành riêng`);
    if (titles.has(keyOf(cost.title))) fail(`${path}.title`, `trùng tên "${cost.title.trim()}"`);
    titles.add(keyOf(cost.title));
    if (cost.budget !== undefined && !isBudget(cost.budget)) fail(`${path}.budget`, 'phải là số nguyên ≥ 0');
  });
}
