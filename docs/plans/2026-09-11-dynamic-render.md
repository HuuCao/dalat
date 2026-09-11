# Dynamic Render Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hand-written single-file `index.html` with a data-driven page rendered from `data/trip.json`, with scroll-driven animation (2 layers) and a mobile-first layout.

**Architecture:** Plain ES modules, no build step. Pure logic (`js/lib`, `js/model`) is unit-tested with `node --test`; DOM code (`js/views`, `js/controllers`) is verified in headless Chrome through the DevTools Protocol. CSS is split per component, mobile-first, with animation isolated in `css/motion/`.

**Tech Stack:** HTML, CSS (scroll-driven animations, `@supports`), vanilla JS ES modules, Node 22 built-in test runner, Chrome headless + CDP for verification, GitHub Pages hosting.

**Spec:** `docs/specs/2026-09-11-dynamic-render-design.md`

## Global Constraints

- Zero runtime and dev dependencies. `package.json` only declares `"type": "module"` and scripts.
- Node ≥ 18 for tests (machine has v22.17.0).
- All page content comes from `data/trip.json`; no content strings in HTML besides `<title>` and `<noscript>`.
- Data text is written with `textContent` / text nodes only. `innerHTML` is allowed only for the constant hourglass SVG.
- UI copy is Vietnamese and must match the spec exactly (e.g. `Đếm ngược khởi hành`, `Đang diễn ra`, `7 điểm · 1 khung trống`).
- Fallback animation class is `no-scroll-timeline` on `<html>`, set by an inline script at the end of `<head>`.
- CSS `<link>` order: `tokens → base → hero → tabs → timeline → countdown → motion/keyframes → motion/load → motion/scroll-timeline → motion/reveal-fallback`.
- Animate only `transform`, `opacity`, `filter`, `box-shadow`; every CSS animation sits inside `@media (prefers-reduced-motion: no-preference)`.
- Mobile-first: base styles target phones; desktop overrides live in `@media (min-width: 761px)`. Hover effects live in `@media (hover: hover)`.
- `.progress` is a direct child of `<body>`.
- Numbers in `css/motion/scroll-timeline.css` and `scrollFx()` in `js/lib/motion.js` must match.
- Work on branch `feat/dynamic-render`. Do not push or merge.

---

### Task 1: Tooling, images, docs

**Files:**
- Create: `package.json`
- Create: `assets/img/hero-800.jpg`, `hero-1600.jpg`, `hero-2560.jpg`, `thumb-a-240.jpg`, `thumb-a-480.jpg`, `thumb-b-240.jpg`, `thumb-b-480.jpg`
- Delete: `assets/img/hero.jpg`, `assets/img/thumb-a.jpg`, `assets/img/thumb-b.jpg` (single-size downloads from earlier)
- Add: `docs/specs/2026-09-11-dynamic-render-design.md`, `docs/plans/2026-09-11-dynamic-render.md`

**Interfaces:**
- Produces: `npm test` → `node --test tests/*.test.js`; `npm run dev` → static server. Image files named `{name}-{width}.jpg`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "dalat-trip-plan",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test tests/*.test.js",
    "dev": "npx --yes serve ."
  }
}
```

- [ ] **Step 2: Download image variants and remove the single-size files**

```bash
rm -f assets/img/hero.jpg assets/img/thumb-a.jpg assets/img/thumb-b.jpg
bash -c '
while read -r name photo params; do
  curl -s -o "assets/img/$name" -w "$name %{http_code} %{content_type} %{size_download}B\n" "https://images.unsplash.com/$photo?$params"
done <<EOF
hero-800.jpg photo-1678099006439-dba9e4d3f9f5 w=800&q=85&fm=jpg
hero-1600.jpg photo-1678099006439-dba9e4d3f9f5 w=1600&q=85&fm=jpg
hero-2560.jpg photo-1678099006439-dba9e4d3f9f5 w=2560&q=85&fm=jpg
thumb-a-240.jpg photo-1699425413886-a6490b7bd009 w=240&h=180&fit=crop&q=90&fm=jpg
thumb-a-480.jpg photo-1699425413886-a6490b7bd009 w=480&h=360&fit=crop&q=90&fm=jpg
thumb-b-240.jpg photo-1741524427564-0173c980c432 w=240&h=180&fit=crop&q=90&fm=jpg
thumb-b-480.jpg photo-1741524427564-0173c980c432 w=480&h=360&fit=crop&q=90&fm=jpg
EOF
'
file assets/img/*
```

Expected: 7 lines `200 image/jpeg`, `file` reports JPEG with widths 800/1600/2560/240/480/240/480.

- [ ] **Step 3: Commit**

```bash
git add package.json assets/img docs
git commit -m "chore: add tooling, responsive images, spec and plan"
```

---

### Task 2: Time helpers

**Files:**
- Create: `js/lib/time.js`
- Test: `tests/time.test.js`

**Interfaces:**
- Produces:
  - `isTime(value): boolean` — `HH:MM`, 00:00–23:59
  - `isDate(value): boolean` — real `YYYY-MM-DD`
  - `isTimezone(value): boolean` — `+HH:MM` / `-HH:MM`
  - `toMinutes(time: string): number`
  - `toDate(date: string, time: string, timezone: string): Date`
  - `weekdayText(date: string): string` — `CN`, `Th 2` … `Th 7`
  - `dateText(date: string): string` — `Th 6, 16/10`
  - `derivePeriod(start: string, end: string): string` — `Buổi sáng` / `Trưa → chiều`
  - `fillTemplate(text: string, vars: object): string`

- [ ] **Step 1: Write the failing test** — `tests/time.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isTime, isDate, isTimezone, toMinutes, toDate,
  weekdayText, dateText, derivePeriod, fillTemplate,
} from '../js/lib/time.js';

test('isTime accepts HH:MM only', () => {
  assert.equal(isTime('07:00'), true);
  assert.equal(isTime('23:59'), true);
  assert.equal(isTime('7:00'), false);
  assert.equal(isTime('24:00'), false);
  assert.equal(isTime(700), false);
});

test('isDate rejects malformed and impossible dates', () => {
  assert.equal(isDate('2026-10-16'), true);
  assert.equal(isDate('2026-02-30'), false);
  assert.equal(isDate('16/10/2026'), false);
});

test('isTimezone accepts UTC offsets', () => {
  assert.equal(isTimezone('+07:00'), true);
  assert.equal(isTimezone('-03:30'), true);
  assert.equal(isTimezone('GMT+7'), false);
});

test('toMinutes counts from midnight', () => {
  assert.equal(toMinutes('12:45'), 765);
});

test('toDate applies the trip timezone', () => {
  assert.equal(toDate('2026-10-16', '07:00', '+07:00').toISOString(), '2026-10-16T00:00:00.000Z');
});

test('weekdayText and dateText', () => {
  assert.equal(weekdayText('2026-10-16'), 'Th 6');
  assert.equal(weekdayText('2026-10-17'), 'Th 7');
  assert.equal(weekdayText('2026-10-18'), 'CN');
  assert.equal(dateText('2026-10-16'), 'Th 6, 16/10');
  assert.equal(dateText('2026-03-05'), 'Th 5, 05/03');
});

test('derivePeriod labels every current slot', () => {
  const cases = [
    ['07:00', '09:00', 'Buổi sáng'],
    ['09:15', '10:30', 'Buổi sáng'],
    ['11:00', '12:15', 'Buổi trưa'],
    ['12:45', '14:00', 'Trưa → chiều'],
    ['14:15', '16:00', 'Buổi chiều'],
    ['16:30', '17:45', 'Buổi chiều'],
    ['18:00', '19:00', 'Buổi tối'],
    ['19:30', '21:00', 'Buổi tối'],
    ['08:00', '10:00', 'Buổi sáng'],
    ['11:00', '17:00', 'Trưa → chiều'],
    ['18:00', '21:30', 'Buổi tối'],
    ['08:00', '10:30', 'Buổi sáng'],
    ['11:00', '13:00', 'Buổi trưa'],
  ];
  for (const [start, end, expected] of cases) {
    assert.equal(derivePeriod(start, end), expected, `${start}–${end}`);
  }
});

test('fillTemplate replaces known keys and keeps unknown ones', () => {
  assert.equal(fillTemplate('{days} ngày {nights} đêm {x}', { days: 3, nights: 2 }), '3 ngày 2 đêm {x}');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '.../js/lib/time.js'`.

- [ ] **Step 3: Write the implementation** — `js/lib/time.js`

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add js/lib/time.js tests/time.test.js
git commit -m "feat: add trip time helpers"
```

---

### Task 3: Trip data and model

**Files:**
- Create: `data/trip.json`
- Create: `js/model/trip.js`
- Test: `tests/trip.test.js`

**Interfaces:**
- Consumes: everything from `js/lib/time.js` (Task 2).
- Produces:
  - `buildTrip(raw: object): Trip` — throws `Error("<path>: <message>")`
  - `countText(placeCount: number, emptyCount: number): string`
  - `Trip { timezone, hero: { eyebrow, title, subtitle, chips: string[], image: ImageSet|null, thumbs: ImageSet[] }, footer: { title, note }, dayCount, nightCount, placeCount, start: Date, end: Date, items: Item[], days: Day[] }`
  - `ImageSet { src: string, srcset: string }`
  - `Day { index, id: 'day-N', date, label: 'Day N', icon, dateText, rangeText, note, placeCount, emptyCount, countText, items: Item[] }`
  - `Item { id: 'day-N-item-M', dayId, order (0-based), start: Date, end: Date, startText, endText, period, icon, title, heading, tag, mapUrl: string|null, empty: boolean }`

- [ ] **Step 1: Create `data/trip.json`**

```json
{
  "timezone": "+07:00",
  "hero": {
    "eyebrow": "✦ Travel plan · Đà Lạt",
    "title": "Đà Lạt",
    "subtitle": "Đà Lạt {days} ngày {nights} đêm — Let's go",
    "chips": ["🌿 Nature", "☕ Chill", "📸 Check-in"],
    "image": { "src": "assets/img/hero-{w}.jpg", "widths": [800, 1600, 2560] },
    "thumbs": [
      { "src": "assets/img/thumb-a-{w}.jpg", "widths": [240, 480] },
      { "src": "assets/img/thumb-b-{w}.jpg", "widths": [240, 480] }
    ]
  },
  "days": [
    {
      "date": "2026-10-16",
      "icon": "🌿",
      "note": "Sáng → Trưa → Chiều → Tối",
      "items": [
        { "start": "07:00", "end": "09:00", "icon": "🍃", "title": "Đồi chè Cầu Đất", "tag": "Nature", "map": "Đồi chè Cầu Đất Đà Lạt" },
        { "start": "09:15", "end": "10:30", "icon": "🌸", "title": "Cánh đồng hoa / Hidden spot", "tag": "Check-in", "map": "cánh đồng hoa gần đồi chè Cầu Đất Đà Lạt" },
        { "start": "11:00", "end": "12:15", "icon": "🍗", "title": "Gà nướng + cơm lam", "tag": "Lunch", "map": "gà nướng cơm lam gần đồi chè Cầu Đất Đà Lạt" },
        { "start": "12:45", "end": "14:00", "icon": "🐈", "title": "Trại Mèo Mướp", "tag": "Cute spot", "map": "Trại Mèo Mướp Đà Lạt" },
        { "start": "14:15", "end": "16:00", "icon": "☕", "title": "Phong Miên quán — forest slow café", "tag": "Coffee", "map": "Phong Miên quán forest slow café Đà Lạt" },
        { "start": "16:30", "end": "17:45", "icon": "🌫️", "title": "Dốc Sương Nguyệt Ánh", "tag": "Sunset", "map": "Dốc Sương Nguyệt Ánh Đà Lạt" },
        { "start": "18:00", "end": "19:00", "icon": "📡", "title": "Tháp Vinaphone Đà Lạt", "tag": "Check-in", "map": "Tháp Vinaphone Đà Lạt" },
        { "start": "19:30", "end": "21:00", "icon": "🍜", "title": "Ăn tối — Chưa chọn", "empty": true }
      ]
    },
    {
      "date": "2026-10-17",
      "icon": "☁️",
      "note": "Lịch trình cần hoàn thiện",
      "items": [
        { "start": "08:00", "end": "10:00", "icon": "🌊", "title": "Floating Town", "tag": "Check-in", "map": "Floating Town Đà Lạt" },
        { "start": "11:00", "end": "17:00", "icon": "📍", "title": "Chưa lên lịch", "empty": true },
        { "start": "18:00", "end": "21:30", "icon": "🌙", "title": "Chưa lên lịch", "empty": true }
      ]
    },
    {
      "date": "2026-10-18",
      "icon": "🌤️",
      "note": "Ngày cuối",
      "items": [
        { "start": "08:00", "end": "10:30", "icon": "☕", "title": "Chưa lên lịch", "empty": true },
        { "start": "11:00", "end": "13:00", "icon": "🚗", "title": "Go Home", "tag": "End trip" }
      ]
    }
  ],
  "footer": {
    "title": "Đà Lạt Trip Plan · {days} Days · ✦",
    "note": "Công ty TNHH Du lịch & Sự kiện Lần Này 4 Đứa (10/2026)"
  }
}
```

- [ ] **Step 2: Write the failing test** — `tests/trip.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildTrip, countText } from '../js/model/trip.js';

const raw = JSON.parse(readFileSync(new URL('../data/trip.json', import.meta.url), 'utf8'));
const trip = buildTrip(raw);

const minimalTrip = (days, hero = { title: 'Test' }) => ({ timezone: '+07:00', hero, days });
const oneItem = (item) => minimalTrip([{ date: '2026-10-16', items: [item] }]);
const validItem = { start: '08:00', end: '09:00', title: 'X' };

test('trip totals come from the data', () => {
  assert.equal(trip.dayCount, 3);
  assert.equal(trip.nightCount, 2);
  assert.equal(trip.placeCount, 9);
  assert.equal(trip.items.length, 13);
  assert.equal(trip.start.toISOString(), '2026-10-16T00:00:00.000Z');
  assert.equal(trip.end.toISOString(), '2026-10-18T06:00:00.000Z');
});

test('templates are filled', () => {
  assert.equal(trip.hero.subtitle, "Đà Lạt 3 ngày 2 đêm — Let's go");
  assert.equal(trip.footer.title, 'Đà Lạt Trip Plan · 3 Days · ✦');
});

test('images become srcsets', () => {
  assert.deepEqual(trip.hero.image, {
    src: 'assets/img/hero-2560.jpg',
    srcset: 'assets/img/hero-800.jpg 800w, assets/img/hero-1600.jpg 1600w, assets/img/hero-2560.jpg 2560w',
  });
  assert.equal(trip.hero.thumbs[1].srcset, 'assets/img/thumb-b-240.jpg 240w, assets/img/thumb-b-480.jpg 480w');
  assert.equal(buildTrip(oneItem(validItem)).hero.image, null);
});

test('each day derives its labels and counts', () => {
  const summary = trip.days.map(({ id, label, dateText, rangeText, countText: count }) => ({ id, label, dateText, rangeText, count }));
  assert.deepEqual(summary, [
    { id: 'day-1', label: 'Day 1', dateText: 'Th 6, 16/10', rangeText: '07:00 → 21:00', count: '7 điểm · 1 khung trống' },
    { id: 'day-2', label: 'Day 2', dateText: 'Th 7, 17/10', rangeText: '08:00 → 21:30', count: '1 điểm · 2 khung trống' },
    { id: 'day-3', label: 'Day 3', dateText: 'CN, 18/10', rangeText: '08:00 → 13:00', count: '1 điểm · 1 khung trống' },
  ]);
});

test('items carry ids, order, heading and map url', () => {
  const [first] = trip.days[0].items;
  assert.equal(first.id, 'day-1-item-1');
  assert.equal(first.dayId, 'day-1');
  assert.equal(first.order, 0);
  assert.equal(first.heading, '🍃 Đồi chè Cầu Đất');
  assert.equal(first.period, 'Buổi sáng');
  assert.equal(first.mapUrl, `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Đồi chè Cầu Đất Đà Lạt')}`);
  assert.doesNotMatch(first.mapUrl, /\s/);

  const [emptySlot, goHome] = trip.days[2].items;
  assert.equal(emptySlot.empty, true);
  assert.equal(goHome.title, 'Go Home');
  assert.equal(goHome.tag, 'End trip');
  assert.equal(goHome.mapUrl, null);
  assert.equal(goHome.empty, false);
});

test('days and items are sorted', () => {
  const built = buildTrip(minimalTrip([
    { date: '2026-10-17', items: [{ start: '09:00', end: '10:00', title: 'B' }] },
    { date: '2026-10-16', items: [
      { start: '12:00', end: '13:00', title: 'A2' },
      { start: '08:00', end: '09:00', title: 'A1' },
    ] },
  ]));
  assert.deepEqual(built.items.map((item) => item.title), ['A1', 'A2', 'B']);
  assert.equal(built.days[0].date, '2026-10-16');
  assert.equal(built.days[0].items[1].order, 1);
});

test('countText drops zero parts', () => {
  assert.equal(countText(1, 0), '1 điểm');
  assert.equal(countText(0, 2), '2 khung trống');
  assert.equal(countText(0, 0), 'Chưa có lịch');
});

test('invalid data fails with the exact path', () => {
  assert.throws(() => buildTrip(oneItem({ start: '08:00', end: '09:00' })), /days\[0\]\.items\[0\]\.title: bắt buộc/);
  assert.throws(() => buildTrip(oneItem({ start: '09:00', end: '09:00', title: 'X' })), /days\[0\]\.items\[0\]\.end: phải sau start/);
  assert.throws(() => buildTrip(oneItem({ start: '8:00', end: '09:00', title: 'X' })), /days\[0\]\.items\[0\]\.start: phải có dạng HH:MM/);
  assert.throws(() => buildTrip({ ...oneItem(validItem), timezone: 'GMT+7' }), /timezone: phải có dạng \+07:00/);
  assert.throws(() => buildTrip(minimalTrip([])), /days: phải là mảng có ít nhất 1 ngày/);
  assert.throws(
    () => buildTrip(minimalTrip([{ date: '2026-10-16', items: [validItem] }], { title: 'T', image: { src: 'hero.jpg', widths: [800] } })),
    /hero\.image\.src: phải chứa \{w\}/,
  );
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '.../js/model/trip.js'`.

- [ ] **Step 4: Write the implementation** — `js/model/trip.js`

```js
import {
  isDate, isTime, isTimezone, toMinutes, toDate,
  dateText, derivePeriod, fillTemplate,
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
  const vars = { days: dayCount, nights: nightCount };
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
    heading: icon ? `${icon} ${item.title}` : item.title,
    tag: item.tag ?? '',
    mapUrl: item.map ? MAPS_SEARCH_URL + encodeURIComponent(item.map) : null,
    empty: item.empty === true,
  };
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test`
Expected: PASS, all time + trip tests.

- [ ] **Step 6: Commit**

```bash
git add data/trip.json js/model/trip.js tests/trip.test.js
git commit -m "feat: build trip model from trip.json"
```

---

### Task 4: Trip status

**Files:**
- Create: `js/model/status.js`
- Test: `tests/status.test.js`

**Interfaces:**
- Consumes: `Trip`, `Item` from Task 3.
- Produces:
  - `getStatus(trip: Trip, now: number): Status`
  - `Status { phase: 'soon'|'live'|'done', current: Item|null, next: Item|null, pastPlaces: number, pastIds: Set<string>, remainingMs: number }`
  - `describeStatus(trip: Trip, status: Status): { label: string, tiles: {unit, value}[]|null, headline: string|null, note: string }`
  - `countdownTiles(ms: number): { unit: string, value: string }[]`

- [ ] **Step 1: Write the failing test** — `tests/status.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildTrip } from '../js/model/trip.js';
import { getStatus, describeStatus, countdownTiles } from '../js/model/status.js';

const trip = buildTrip(JSON.parse(readFileSync(new URL('../data/trip.json', import.meta.url), 'utf8')));
const statusAt = (iso) => getStatus(trip, Date.parse(iso));
const describeAt = (iso) => describeStatus(trip, statusAt(iso));

test('before the trip counts down', () => {
  const status = statusAt('2026-10-16T06:00:00+07:00');
  assert.equal(status.phase, 'soon');
  assert.equal(status.remainingMs, 3_600_000);
  assert.equal(status.current, null);
  assert.equal(status.next.id, 'day-1-item-1');
  assert.deepEqual(describeStatus(trip, status), {
    label: 'Đếm ngược khởi hành',
    tiles: [{ unit: 'giờ', value: '01' }, { unit: 'phút', value: '00' }, { unit: 'giây', value: '00' }],
    headline: null,
    note: 'Đà Lạt đang chờ · bắt đầu 07:00 · Th 6, 16/10',
  });
});

test('inside a slot shows that slot', () => {
  const status = statusAt('2026-10-16T08:00:00+07:00');
  assert.equal(status.phase, 'live');
  assert.equal(status.current.id, 'day-1-item-1');
  assert.equal(status.next.id, 'day-1-item-2');
  assert.deepEqual(describeStatus(trip, status), {
    label: 'Đang diễn ra', tiles: null, headline: '🍃 Đồi chè Cầu Đất', note: 'Đến 09:00 · đã qua 0/9 điểm',
  });
});

test('start is inclusive, end is exclusive', () => {
  const atEnd = statusAt('2026-10-16T09:00:00+07:00');
  assert.equal(atEnd.current, null);
  assert.ok(atEnd.pastIds.has('day-1-item-1'));
  assert.deepEqual(describeStatus(trip, atEnd), {
    label: 'Đang di chuyển', tiles: null, headline: '🌸 Cánh đồng hoa / Hidden spot', note: 'Tiếp theo lúc 09:15 · đã qua 1/9 điểm',
  });
  assert.equal(statusAt('2026-10-16T09:15:00+07:00').current.id, 'day-1-item-2');
});

test('empty slots are shown but not counted as places', () => {
  assert.deepEqual(describeAt('2026-10-16T20:00:00+07:00'), {
    label: 'Đang diễn ra', tiles: null, headline: '🍜 Ăn tối — Chưa chọn', note: 'Đến 21:00 · đã qua 7/9 điểm',
  });
  const overnight = statusAt('2026-10-16T23:00:00+07:00');
  assert.equal(overnight.pastIds.size, 8);
  assert.equal(overnight.pastPlaces, 7);
  assert.equal(overnight.next.id, 'day-2-item-1');
});

test('after the trip says goodbye', () => {
  const status = statusAt('2026-10-18T13:00:00+07:00');
  assert.equal(status.phase, 'done');
  assert.equal(status.pastIds.size, 13);
  assert.deepEqual(describeStatus(trip, status), {
    label: 'Hành trình đã khép lại', tiles: null, headline: 'Hẹn gặp lại Đà Lạt ✦', note: 'Đã đi qua 9 điểm trong 3 ngày',
  });
});

test('countdownTiles keeps at least two units and never truncates', () => {
  const tiles = (ms) => countdownTiles(ms).map((tile) => `${tile.value} ${tile.unit}`).join(' ');
  assert.equal(tiles(59_000), '00 phút 59 giây');
  assert.equal(tiles(2 * 86_400_000 + 3 * 3_600_000 + 4 * 60_000 + 5_000), '02 ngày 03 giờ 04 phút 05 giây');
  assert.equal(tiles(100 * 86_400_000), '100 ngày 00 giờ 00 phút 00 giây');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '.../js/model/status.js'`.

- [ ] **Step 3: Write the implementation** — `js/model/status.js`

```js
export function getStatus(trip, now) {
  let current = null;
  let next = null;
  let pastPlaces = 0;
  const pastIds = new Set();

  for (const item of trip.items) {
    if (now >= item.end.getTime()) {
      pastIds.add(item.id);
      if (!item.empty) pastPlaces += 1;
    } else if (now >= item.start.getTime()) {
      current ??= item;
    } else {
      next ??= item;
    }
  }

  let phase = 'live';
  if (now < trip.start.getTime()) phase = 'soon';
  else if (now >= trip.end.getTime()) phase = 'done';

  return { phase, current, next, pastPlaces, pastIds, remainingMs: Math.max(trip.start.getTime() - now, 0) };
}

export function countdownTiles(ms) {
  const total = Math.floor(ms / 1000);
  const parts = [
    { unit: 'ngày', value: Math.floor(total / 86_400) },
    { unit: 'giờ', value: Math.floor(total / 3600) % 24 },
    { unit: 'phút', value: Math.floor(total / 60) % 60 },
    { unit: 'giây', value: total % 60 },
  ];
  // Drop leading zero units so the row never reads "00 ngày 00 giờ".
  while (parts.length > 2 && parts[0].value === 0) parts.shift();
  return parts.map(({ unit, value }) => ({ unit, value: String(value).padStart(2, '0') }));
}

export function describeStatus(trip, status) {
  const place = trip.hero.title;
  const progress = `${status.pastPlaces}/${trip.placeCount} điểm`;

  if (status.phase === 'soon') {
    const [first] = trip.items;
    const firstDay = trip.days.find((day) => day.id === first.dayId);
    return {
      label: 'Đếm ngược khởi hành',
      tiles: countdownTiles(status.remainingMs),
      headline: null,
      note: `${place} đang chờ · bắt đầu ${first.startText} · ${firstDay.dateText}`,
    };
  }

  if (status.phase === 'done') {
    return {
      label: 'Hành trình đã khép lại',
      tiles: null,
      headline: `Hẹn gặp lại ${place} ✦`,
      note: `Đã đi qua ${trip.placeCount} điểm trong ${trip.dayCount} ngày`,
    };
  }

  if (status.current) {
    return {
      label: 'Đang diễn ra',
      tiles: null,
      headline: status.current.heading,
      note: `Đến ${status.current.endText} · đã qua ${progress}`,
    };
  }

  return {
    label: 'Đang di chuyển',
    tiles: null,
    headline: status.next ? status.next.heading : 'Nghỉ giữa chặng',
    note: status.next ? `Tiếp theo lúc ${status.next.startText} · đã qua ${progress}` : `Đã qua ${progress}`,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/model/status.js tests/status.test.js
git commit -m "feat: derive trip status and countdown copy"
```

---

### Task 5: Motion math and clock

**Files:**
- Create: `js/lib/motion.js`, `js/lib/clock.js`
- Test: `tests/motion.test.js`, `tests/clock.test.js`

**Interfaces:**
- Produces:
  - `FALLBACK_CLASS = 'no-scroll-timeline'`
  - `hasScrollTimeline(): boolean` (browser only)
  - `prefersReducedMotion(): boolean` (browser only)
  - `heroParallax(progress: number): { scale: number, translate: number }`
  - `scrollFx(y, viewportHeight, scrollHeight): { bar, bg, inner, thumbs }` — each value is a style object for `Object.assign(el.style, …)`
  - `createClock(search: string, now = Date.now): () => number`

- [ ] **Step 1: Write the failing tests**

`tests/motion.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scrollFx, heroParallax } from '../js/lib/motion.js';

const fx = (y) => scrollFx(y, 800, 3000);

test('top of page is the resting state', () => {
  assert.deepEqual(fx(0), {
    bar: { transform: 'scaleX(0)' },
    bg: { transform: 'scale(1.3) translateY(-5%)' },
    inner: { opacity: '1', transform: 'translateY(0px) scale(1)' },
    thumbs: { opacity: '1', transform: 'translate3d(0px, 0px, 0) rotate(0deg)' },
  });
});

test('ranges match the CSS scroll timeline', () => {
  assert.deepEqual(fx(40).inner, { opacity: '1', transform: 'translateY(0px) scale(1)' });
  assert.deepEqual(fx(200).inner, { opacity: '0.5', transform: 'translateY(-24px) scale(0.96)' });
  assert.deepEqual(fx(360).inner, { opacity: '0', transform: 'translateY(-48px) scale(0.92)' });
  assert.deepEqual(fx(300).thumbs, { opacity: '0', transform: 'translate3d(60px, -20px, 0) rotate(7deg)' });
  assert.equal(fx(480).bg.transform, 'scale(1.12) translateY(5%)');
  assert.equal(fx(1100).bar.transform, 'scaleX(0.5)');
});

test('values clamp past the end of each range', () => {
  assert.deepEqual(fx(5000).bg, fx(480).bg);
  assert.deepEqual(fx(5000).inner, fx(360).inner);
  assert.equal(fx(5000).bar.transform, 'scaleX(1)');
});

test('a page shorter than the viewport does not divide by zero', () => {
  assert.equal(scrollFx(0, 800, 600).bar.transform, 'scaleX(0)');
});

test('hero parallax never uncovers an edge', () => {
  for (let step = 0; step <= 100; step += 1) {
    const { scale, translate } = heroParallax(step / 100);
    const shift = scale * Math.abs(translate);
    const overflow = ((scale - 1) / 2) * 100;
    assert.ok(shift <= overflow + 1e-9, `progress ${step / 100}: shift ${shift}% > overflow ${overflow}%`);
  }
});
```

`tests/clock.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClock } from '../js/lib/clock.js';

test('without ?now the real clock is used', () => {
  assert.equal(createClock('', () => 42)(), 42);
});

test('?now pins the start and keeps running', () => {
  let real = 1_000;
  const clock = createClock('?now=2026-10-16T12:00:00%2B07:00', () => real);
  real = 3_500;
  assert.equal(clock(), Date.parse('2026-10-16T05:00:00Z') + 2_500);
});

test('a raw + in the offset still parses', () => {
  assert.equal(createClock('?now=2026-10-16T12:00:00+07:00', () => 0)(), Date.parse('2026-10-16T05:00:00Z'));
});

test('an invalid ?now falls back to the real clock', () => {
  assert.equal(createClock('?now=tomorrow', () => 7)(), 7);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot find `js/lib/motion.js` and `js/lib/clock.js`.

- [ ] **Step 3: Write the implementations**

`js/lib/motion.js`:

```js
export const FALLBACK_CLASS = 'no-scroll-timeline';

// The inline script in <head> adds FALLBACK_CLASS when CSS scroll-driven
// animation is unsupported.
export function hasScrollTimeline() {
  return !document.documentElement.classList.contains(FALLBACK_CLASS);
}

export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const clamp01 = (value) => Math.min(1, Math.max(0, value));
// 4 decimals keeps style strings short; `+ 0` turns -0 into 0.
const round = (value) => Math.round(value * 1e4) / 1e4 + 0;

// Mirrors @keyframes hero-parallax. The image never uncovers an edge while
// scale × |translateY| ≤ (scale − 1) / 2.
export function heroParallax(progress) {
  return { scale: round(1.3 - 0.18 * progress), translate: round(-5 + 10 * progress) };
}

// Fallback for css/motion/scroll-timeline.css: same ranges, same numbers.
// Change both together.
export function scrollFx(y, viewportHeight, scrollHeight) {
  const page = clamp01(y / Math.max(1, scrollHeight - viewportHeight));
  const drift = clamp01(y / 480);
  const lift = clamp01((y - 40) / 320);
  const fling = clamp01(y / 300);
  const { scale, translate } = heroParallax(drift);

  return {
    bar: { transform: `scaleX(${round(page)})` },
    bg: { transform: `scale(${scale}) translateY(${translate}%)` },
    inner: {
      opacity: String(round(1 - lift)),
      transform: `translateY(${round(-48 * lift)}px) scale(${round(1 - 0.08 * lift)})`,
    },
    thumbs: {
      opacity: String(round(1 - fling)),
      transform: `translate3d(${round(60 * fling)}px, ${round(-20 * fling)}px, 0) rotate(${round(7 * fling)}deg)`,
    },
  };
}
```

`js/lib/clock.js`:

```js
// `?now=2026-10-16T12:00:00%2B07:00` pins the page to that moment and lets it
// run from there, so the live and finished states can be checked early.
export function createClock(search, now = Date.now) {
  const param = new URLSearchParams(search).get('now');
  // URLSearchParams decodes a raw "+" in the offset to a space.
  const pinned = param ? Date.parse(param.replace(' ', '+')) : Number.NaN;
  if (Number.isNaN(pinned)) return now;

  const openedAt = now();
  return () => pinned + (now() - openedAt);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, all suites.

- [ ] **Step 5: Commit**

```bash
git add js/lib/motion.js js/lib/clock.js tests/motion.test.js tests/clock.test.js
git commit -m "feat: add scroll fallback math and pinnable clock"
```

---

### Task 6: Component CSS (mobile-first)

**Files:**
- Create: `css/tokens.css`, `css/base.css`, `css/hero.css`, `css/tabs.css`, `css/timeline.css`, `css/countdown.css`

**Interfaces:**
- Consumes: markup classes produced by Task 8 views: `.hero .hero-bg(img) .hero-overlay .hero-inner .eyebrow h1>span .subtitle .chips .chip .hero-thumbs .thumb(img)`, `.tabbar .tabs .tab[aria-selected]`, `.panel .day .day-head .day-title .day-date .day-count .timeline .item .dot .time .clock .period .card .empty .card-footer .tag .map-btn .now-tag .is-now .is-past`, `.countdown .cd-glow .hourglass .hg-* .cd-body .cd-label .pulse .cd-label-text .cd-note .cd-clock .cd-unit(.sec) .cd-headline`, `.footer .progress .load-error .noscript`.
- Produces: tokens `--accent-rgb`, `--ease-out`, `--ease-spring` used by Task 7.

Verification for CSS happens in Task 10 (browser); this task ends with a syntax sanity check.

- [ ] **Step 1: `css/tokens.css`**

```css
:root {
  --bg: #f2f5f3;
  --card: #ffffff;
  --primary: #2d4a3e;
  --accent: #52796f;
  --accent-rgb: 82, 121, 111;
  --accent-soft: #e8f0ec;
  --text: #23291f;
  --text-sub: #6b7a70;
  --line: #e3eae5;
  --radius: 16px;
  --shadow-sm: 0 1px 2px rgba(20, 40, 30, .05);
  --shadow-md: 0 6px 20px rgba(20, 40, 30, .07);
  --ease-out: cubic-bezier(.22, .9, .3, 1);
  --ease-spring: cubic-bezier(.34, 1.56, .64, 1);
}
```

- [ ] **Step 2: `css/base.css`**

```css
* { box-sizing: border-box; }

[hidden] { display: none !important; }

html { scroll-behavior: smooth; }

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
}

.wrap { width: calc(100% - 24px); margin: 0 auto; }

main { padding-bottom: 48px; }

.footer {
  text-align: center;
  color: #8c9690;
  font-size: 12px;
  margin-top: 22px;
}

/* Reading progress. Must stay a direct child of <body>: an ancestor with
   perspective, transform or filter would stop it being fixed. */
.progress {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 30;
  height: 3px;
  background: var(--accent);
  transform: scaleX(0);
  transform-origin: 0 50%;
  pointer-events: none;
}

.load-error {
  margin-top: 32px;
  padding: 16px 18px;
  border: 1px solid #e6c9c3;
  border-radius: 12px;
  background: #fbf1ef;
  color: #7a3b2e;
}

.load-error p { margin: 6px 0 0; font-size: 13px; }

.noscript {
  max-width: 520px;
  margin: 48px auto;
  padding: 0 16px;
  text-align: center;
  color: var(--text-sub);
}

@media (min-width: 761px) {
  .wrap { width: min(940px, calc(100% - 32px)); }
}
```

- [ ] **Step 3: `css/hero.css`**

```css
.hero {
  position: relative;
  min-height: 230px;
  display: flex;
  align-items: flex-end;
  padding: 26px 0 22px;
  overflow: hidden;
  background: #354f52;
  color: #fff;
}

.hero-bg {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scale(1.04);
}

.hero-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(170deg, rgba(16, 30, 25, .25) 0%, rgba(16, 30, 25, .82) 100%);
}

.hero-inner { position: relative; z-index: 2; }

.eyebrow {
  letter-spacing: .16em;
  text-transform: uppercase;
  font-size: 10.5px;
  font-weight: 700;
  color: #b9cdc0;
}

h1 {
  font-size: clamp(32px, 5.4vw, 52px);
  margin: 8px 0 6px;
  line-height: 1.04;
  font-weight: 700;
  letter-spacing: -.02em;
}

h1 span { font-size: .52em; font-weight: 400; opacity: .8; }

.subtitle { font-size: 14.5px; opacity: .88; max-width: 520px; }

.chips { display: flex; gap: 7px; flex-wrap: wrap; margin-top: 14px; }

.chip {
  padding: 5px 12px;
  border-radius: 99px;
  background: rgba(255, 255, 255, .14);
  border: 1px solid rgba(255, 255, 255, .22);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  font-size: 12px;
  font-weight: 500;
}

/* Hidden on phones. The thumbnails are lazy images, so phones never
   download them either. */
.hero-thumbs {
  position: absolute;
  right: max(16px, calc((100% - 940px) / 2));
  bottom: 26px;
  z-index: 2;
  display: none;
  gap: 10px;
}

.thumb {
  display: block;
  width: 92px;
  height: 68px;
  border-radius: 10px;
  object-fit: cover;
  border: 2px solid rgba(255, 255, 255, .85);
  box-shadow: 0 8px 20px rgba(0, 0, 0, .28);
}

@media (min-width: 761px) {
  .hero { min-height: 300px; padding: 32px 0 26px; }
  .hero-thumbs { display: flex; }
}
```

- [ ] **Step 4: `css/tabs.css`**

```css
.tabbar {
  position: sticky;
  top: 0;
  z-index: 20;
  margin-top: 18px;
  padding: 10px 0;
  background: rgba(242, 245, 243, .88);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--line);
}

/* One column per tab. Past what fits, the row scrolls sideways instead of
   squeezing the labels. */
.tabs {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(64px, 1fr);
  gap: 6px;
  padding: 4px;
  overflow-x: auto;
  scrollbar-width: none;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 13px;
  box-shadow: var(--shadow-sm);
}

.tabs::-webkit-scrollbar { display: none; }

.tab {
  min-width: 0;
  min-height: 44px;
  padding: 8px 4px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--text-sub);
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  text-align: center;
  cursor: pointer;
  transition: background .18s ease, color .18s ease;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  -webkit-user-select: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

@media (hover: hover) {
  .tab:hover { background: var(--accent-soft); color: var(--primary); }
}

.tab[aria-selected="true"] { background: var(--primary); color: #fff; }

.tab:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }

@media (min-width: 761px) {
  .tab { font-size: 13.5px; padding: 9px 8px; }
}
```

- [ ] **Step 5: `css/timeline.css`**

```css
/* ---------- DAY ---------- */
.day {
  /* Entries swing in from up to 46px off to the side; without clipping that
     briefly widens the page and flashes a horizontal scrollbar on phones. */
  overflow: hidden;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 16px;
  margin-top: 18px;
  box-shadow: var(--shadow-md);
}

.day-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 18px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--line);
}

.day-title { margin: 0; font-size: 18px; color: var(--primary); letter-spacing: -.01em; }
.day-date { color: var(--text-sub); font-size: 12.5px; margin-top: 2px; }
.day-count { font-size: 12px; color: var(--accent); font-weight: 600; }

/* ---------- TIMELINE ---------- */
.timeline { position: relative; padding-left: 18px; }

.timeline::before {
  content: "";
  position: absolute;
  left: 5px;
  top: 8px;
  bottom: 8px;
  width: 2px;
  background: linear-gradient(180deg, var(--accent) 0%, var(--line) 100%);
  opacity: .28;
}

.item { position: relative; margin-bottom: 16px; }
.item:last-child { margin-bottom: 0; }

.dot {
  position: absolute;
  left: -18px;
  top: 8px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--accent);
  border: 2.5px solid #fff;
  box-shadow: 0 0 0 1px rgba(var(--accent-rgb), .45);
}

.time {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.time .clock {
  padding: 2px 8px;
  border-radius: 6px;
  background: var(--accent-soft);
  color: var(--primary);
  font-size: 11.5px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: .01em;
}

.time .period {
  font-size: 10.5px;
  font-weight: 700;
  color: var(--text-sub);
  text-transform: uppercase;
  letter-spacing: .07em;
}

/* ---------- CARD ---------- */
/* Always two rows - title, then meta - so every entry has the same shape.
   The tag and the map link are plain text, not chips: one box per card. */
.card {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 11px 12px;
  transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
}

.card h3 {
  margin: 0;
  font-size: 14.5px;
  font-weight: 600;
  line-height: 1.4;
  letter-spacing: -.005em;
}

.card-footer {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 7px;
}

.tag {
  color: #93a29a;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: .07em;
}

/* The link text stays small; padding plus an equal negative margin stretch
   the tap target to 44px without moving anything. */
.map-btn {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin: -13px 0 -13px auto;
  padding: 13px 0 13px 12px;
  color: var(--accent);
  text-decoration: none;
  font-size: 11.5px;
  font-weight: 600;
  transition: color .18s ease;
}

.empty { border: 1px dashed #cbd5ce; background: #f7faf8; }
.empty h3 { color: #8a978f; font-weight: 550; }

/* Touch screens would keep :hover stuck after a tap. */
@media (hover: hover) {
  .card:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
    border-color: #cfdfd6;
  }

  .empty:hover { transform: none; box-shadow: none; border-color: #b9c8bf; }

  .map-btn:hover { color: var(--primary); text-decoration: underline; }
}

/* ---------- LIVE AND PAST SLOTS ---------- */
.item.is-now .card {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(var(--accent-rgb), .14);
}

.item.is-now .clock { background: var(--accent); color: #fff; }

.item.is-now .dot {
  background: var(--accent);
  box-shadow: 0 0 0 1px var(--accent), 0 0 0 5px rgba(var(--accent-rgb), .2);
}

.now-tag {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: var(--accent);
}

/* Slots that are over fade back so the eye lands on what is left. */
.item.is-past .card:not(.empty) { background: #f3f9f4; border-color: #c9e1d0; }
.item.is-past .card:not(.empty) h3 { color: #74897c; }
.item.is-past .clock { opacity: .55; }
.item.is-past .dot { background: var(--primary); box-shadow: 0 0 0 1px var(--primary); }

@media (min-width: 761px) {
  .day { padding: 20px; border-radius: var(--radius); }
  .day-title { font-size: 20px; }
  .timeline { padding-left: 22px; }
  .dot { left: -21px; }
  .item { margin-bottom: 20px; }
  .card { padding: 12px 14px; }
  .card h3 { font-size: 15px; }
}
```

- [ ] **Step 6: `css/countdown.css`**

```css
/* Trip status: countdown before the trip, the slot in progress during it,
   a farewell after. The copy comes from describeStatus(). */
.countdown {
  position: relative;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 11px;
  overflow: hidden;
  margin-top: 16px;
  padding: 12px 13px;
  border-radius: 15px;
  background:
    radial-gradient(120% 140% at 12% 0%, #31503f 0%, transparent 55%),
    linear-gradient(135deg, #24392f 0%, #16241d 58%, #22362c 100%);
  color: #e9f1eb;
  box-shadow: 0 10px 24px rgba(16, 30, 25, .22);
}

/* Slow light sweep across the panel. */
.cd-glow {
  position: absolute;
  inset: -40% -10%;
  background: linear-gradient(105deg, transparent 38%, rgba(167, 201, 87, .16) 50%, transparent 62%);
  animation: cd-sweep 7s ease-in-out infinite;
  pointer-events: none;
}

@keyframes cd-sweep {
  0%, 100% { transform: translateX(-38%); }
  50% { transform: translateX(38%); }
}

.cd-body {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
}

.cd-label {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: .16em;
  text-transform: uppercase;
  color: #9fb8a8;
}

/* Phones cannot fit label, note and four tiles on one line, and a
   half-wrapped row reads as broken - the tiles get their own row. */
.cd-clock {
  position: relative;
  display: flex;
  flex: 1 0 100%;
  flex-wrap: wrap;
  gap: 6px;
  margin-left: 0;
}

.cd-unit {
  min-width: 39px;
  padding: 4px 5px 3px;
  border-radius: 10px;
  background: rgba(255, 255, 255, .07);
  border: 1px solid rgba(255, 255, 255, .13);
  text-align: center;
}

.cd-unit b {
  display: block;
  font-size: 15.5px;
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -.02em;
  font-variant-numeric: tabular-nums;
  color: #fff;
}

.cd-unit i {
  display: block;
  margin-top: 1px;
  font-style: normal;
  font-size: 8px;
  font-weight: 600;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: #93ab9c;
}

.cd-unit.sec b { color: #a7c957; }

/* During and after the trip the clock row carries a sentence, not tiles. */
.cd-headline {
  font-size: 14px;
  font-weight: 650;
  line-height: 1.3;
  letter-spacing: -.01em;
  color: #fff;
}

.cd-note {
  margin-top: 3px;
  font-size: 11.5px;
  color: #9fb8a8;
}

.countdown .pulse {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #7d9488;
  flex: 0 0 auto;
}

.countdown.live .pulse {
  background: #a7c957;
  animation: ping 1.8s ease-out infinite;
}

@keyframes ping {
  from { box-shadow: 0 0 0 0 rgba(167, 201, 87, .55); }
  to { box-shadow: 0 0 0 9px rgba(167, 201, 87, 0); }
}

/* Hourglass: flips every 3s, sand drains in step with the flip. Only shown
   while the trip is still ahead. */
.hourglass { display: none; }

.countdown.soon .hourglass {
  display: block;
  flex: 0 0 auto;
  width: 30px;
  height: 30px;
  animation: hg-flip 6s cubic-bezier(.65, 0, .35, 1) infinite;
}

.countdown.soon .pulse { display: none; }

.hg-frame {
  fill: none;
  stroke: #cfe0d4;
  stroke-width: 1.3;
  stroke-linecap: round;
  opacity: .85;
}

.hg-sand { fill: #a7c957; }

/* Sand always has to hug the neck while draining and sit on the plate while
   piling up. After the 180deg flip each bulb swaps those roles, so
   transform-origin is animated too - it switches at the flip, where the
   charge is a sliver and the jump is invisible. */
.hg-sand-top { animation: hg-top 6s linear infinite; }
.hg-sand-bot { animation: hg-bot 6s linear infinite; }

.hg-stream {
  fill: #a7c957;
  transform-origin: 12px 11px;
  animation: hg-stream 6s linear infinite;
}

@keyframes hg-flip {
  0%, 45% { transform: rotate(0deg); }
  50%, 95% { transform: rotate(180deg); }
  100% { transform: rotate(360deg); }
}

/* Upper bulb drains toward the neck, then - upside down - refills from its
   plate. */
@keyframes hg-top {
  0% { transform-origin: 12px 11.6px; transform: scaleY(1); }
  43% { transform-origin: 12px 11.6px; transform: scaleY(.05); }
  50% { transform-origin: 12px 4px; transform: scaleY(.05); }
  93%, 100% { transform-origin: 12px 4px; transform: scaleY(1); }
}

/* Lower bulb fills from its plate, then - upside down - drains toward the
   neck. */
@keyframes hg-bot {
  0% { transform-origin: 12px 20px; transform: scaleY(.06); }
  43% { transform-origin: 12px 20px; transform: scaleY(1); }
  50% { transform-origin: 12px 12.4px; transform: scaleY(1); }
  93%, 100% { transform-origin: 12px 12.4px; transform: scaleY(.05); }
}

@keyframes hg-stream {
  0%, 42% { opacity: .9; transform: scaleY(1); }
  44%, 49% { opacity: 0; transform: scaleY(.2); }
  51%, 92% { opacity: .9; transform: scaleY(1); }
  94%, 100% { opacity: 0; transform: scaleY(.2); }
}

@media (prefers-reduced-motion: reduce) {
  .cd-glow,
  .countdown.soon .hourglass,
  .hg-sand-top,
  .hg-sand-bot,
  .hg-stream,
  .countdown.live .pulse {
    animation: none;
  }
}

@media (min-width: 761px) {
  .countdown { gap: 10px 14px; padding: 13px 16px; }
  .cd-clock { flex: 0 0 auto; margin-left: auto; }
  .countdown.soon .hourglass { width: 34px; height: 34px; }
  .cd-unit { min-width: 44px; padding: 5px 7px 4px; }
  .cd-unit b { font-size: 17px; }
  .cd-unit i { font-size: 8.5px; letter-spacing: .12em; }
  .cd-headline { font-size: 15px; }
}
```

- [ ] **Step 7: Sanity check — braces balance in every file**

```bash
for f in css/*.css; do node -e 'const s=require("fs").readFileSync(process.argv[1],"utf8").replace(/\/\*[\s\S]*?\*\//g,"");const o=(s.match(/{/g)||[]).length,c=(s.match(/}/g)||[]).length;console.log(process.argv[1],o===c?"ok":`MISMATCH ${o}/${c}`)' "$f"; done
```

Expected: every file `ok`.

- [ ] **Step 8: Commit**

```bash
git add css/tokens.css css/base.css css/hero.css css/tabs.css css/timeline.css css/countdown.css
git commit -m "feat: split component styles, mobile-first"
```

---

### Task 7: Motion CSS

**Files:**
- Create: `css/motion/keyframes.css`, `css/motion/load.css`, `css/motion/scroll-timeline.css`, `css/motion/reveal-fallback.css`

**Interfaces:**
- Consumes: `--accent-rgb`, `--ease-out`, `--ease-spring` (Task 6); classes `.reveal`, `.in` added by `startReveal` (Task 9); `--i` set by `renderDay` (Task 8).

- [ ] **Step 1: `css/motion/keyframes.css`**

```css
/* ---------- SCROLL (layer A) ---------- */

/* Odd and even entries swing in from opposite sides, with 3D depth. */
@keyframes swing-left {
  from { opacity: 0; transform: translate3d(-46px, 34px, -90px) rotateY(14deg) rotateZ(-2deg); }
  to { opacity: 1; transform: none; }
}

@keyframes swing-right {
  from { opacity: 0; transform: translate3d(46px, 34px, -90px) rotateY(-14deg) rotateZ(2deg); }
  to { opacity: 1; transform: none; }
}

@keyframes head-in {
  from { opacity: 0; transform: translateY(26px) scale(.94); }
  to { opacity: 1; transform: none; }
}

/* Overshoots, settles, and throws a ring of light. `to` has no box-shadow on
   purpose: the last keyframe then lands on the dot's real shadow, so the
   .is-now / .is-past rings still show under fill-mode both. */
@keyframes pop {
  from { opacity: 0; transform: scale(0); box-shadow: 0 0 0 14px rgba(var(--accent-rgb), 0); }
  60% { opacity: 1; transform: scale(1.45); box-shadow: 0 0 0 7px rgba(var(--accent-rgb), .28); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes draw {
  from { transform: scaleY(0); }
  to { transform: scaleY(1); }
}

/* Zoom out and drift down. No edge is uncovered while
   scale × |translateY| ≤ (scale − 1) / 2: start 1.3 × 5% = 6.5% ≤ 15%,
   end 1.12 × 5% = 5.6% ≤ 6%. Mirrored by heroParallax() in js/lib/motion.js. */
@keyframes hero-parallax {
  from { transform: scale(1.3) translateY(-5%); }
  to { transform: scale(1.12) translateY(5%); }
}

/* Opacity above 1 is clamped, so darkening starts lighter instead. */
@keyframes hero-darken {
  from { opacity: .85; }
  to { opacity: 1; }
}

@keyframes hero-lift {
  from { opacity: 1; transform: none; filter: blur(0); }
  to { opacity: 0; transform: translateY(-48px) scale(.92); filter: blur(5px); }
}

@keyframes thumbs-out {
  from { opacity: 1; transform: none; }
  to { opacity: 0; transform: translate3d(60px, -20px, 0) rotate(7deg); }
}

@keyframes bar-settle {
  from { box-shadow: 0 0 0 rgba(0, 0, 0, 0); }
  to { box-shadow: 0 6px 18px rgba(16, 30, 25, .12); }
}

@keyframes progress-grow {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}

/* ---------- LOAD ---------- */
/* `from` only, used with fill-mode backwards: the end state is the
   element's normal style, so nothing can get stuck hidden. */

@keyframes rise { from { opacity: 0; transform: translateY(26px); } }
@keyframes rise-right { from { opacity: 0; transform: translate3d(34px, 20px, 0); } }
@keyframes bg-in { from { opacity: 0; transform: scale(1.22); } }
@keyframes fade { from { opacity: 0; transform: translateY(6px); } }
```

- [ ] **Step 2: `css/motion/load.css`**

```css
/* Entrance when the page opens, in every browser. Rules in
   scroll-timeline.css load later and take over .hero-bg and .hero-thumbs
   where scroll-driven animation is supported. */
@media (prefers-reduced-motion: no-preference) {
  .hero-bg { animation: bg-in 1.1s var(--ease-out) backwards; }

  .eyebrow,
  h1,
  .subtitle,
  .chips {
    animation: rise .75s var(--ease-out) backwards;
  }

  .eyebrow { animation-delay: .04s; }
  h1 { animation-delay: .09s; }
  .subtitle { animation-delay: .14s; }
  .chips { animation-delay: .19s; }

  .hero-thumbs { animation: rise-right .8s var(--ease-out) .24s backwards; }

  .tabs { animation: rise .6s var(--ease-out) .28s backwards; }

  /* A panel coming out of [hidden] replays this on every tab switch. */
  .panel { animation: fade .22s ease backwards; }
}
```

- [ ] **Step 3: `css/motion/scroll-timeline.css`**

```css
/* Layer A: CSS scroll-driven animation. Every hidden starting state lives
   inside @supports, so a browser without animation-timeline skips the whole
   block and renders the page complete. Numbers are mirrored by scrollFx()
   in js/lib/motion.js. */
@supports (animation-timeline: view()) {
  @media (prefers-reduced-motion: no-preference) {

    /* --- progress of the whole page --- */
    .progress {
      animation: progress-grow linear both;
      animation-timeline: scroll(root block);
    }

    .hero-bg {
      animation: hero-parallax linear both;
      animation-timeline: scroll(root block);
      animation-range: 0 480px;
    }

    .hero-overlay {
      animation: hero-darken linear both;
      animation-timeline: scroll(root block);
      animation-range: 0 420px;
    }

    .hero-inner {
      animation: hero-lift linear both;
      animation-timeline: scroll(root block);
      animation-range: 40px 360px;
    }

    .hero-thumbs {
      animation: thumbs-out linear both;
      animation-timeline: scroll(root block);
      animation-range: 0 300px;
    }

    .tabbar {
      animation: bar-settle linear both;
      animation-timeline: scroll(root block);
      animation-range: 120px 220px;
    }

    /* --- position of each element in the viewport --- */
    main { perspective: 1100px; }
    .timeline { perspective: 900px; }

    /* Never animate .day itself: it is taller than the screen, so view()
       would leave it half-faded on load. */
    .day-head {
      animation: head-in linear both;
      animation-timeline: view();
      animation-range: entry 10% cover 20%;
    }

    .item:nth-child(odd) {
      animation: swing-left linear both;
      animation-timeline: view();
      animation-range: entry 5% cover 24%;
    }

    .item:nth-child(even) {
      animation: swing-right linear both;
      animation-timeline: view();
      animation-range: entry 5% cover 24%;
    }

    .dot {
      animation: pop linear both;
      animation-timeline: view();
      animation-range: entry 15% cover 32%;
    }

    .timeline::before {
      transform-origin: top center;
      animation: draw linear both;
      animation-timeline: view();
      animation-range: entry 25% cover 65%;
    }
  }
}
```

- [ ] **Step 4: `css/motion/reveal-fallback.css`**

```css
/* Layer B: browsers without scroll-driven animation. The inline script in
   <head> adds .no-scroll-timeline and startReveal() adds .reveal / .in, so
   without both nothing is ever hidden. Wrapped in no-preference instead of
   a reduce override: an override would force the rail to opacity 1 and lose
   to the :nth-child offsets. */
@media (prefers-reduced-motion: no-preference) {
  .no-scroll-timeline .reveal {
    opacity: 0;
    transform: translateY(30px);
    transition:
      opacity .65s var(--ease-out),
      transform .65s var(--ease-out);
  }

  .no-scroll-timeline .item.reveal:nth-child(odd) { transform: translate3d(-38px, 22px, 0); }
  .no-scroll-timeline .item.reveal:nth-child(even) { transform: translate3d(38px, 22px, 0); }

  /* 40ms stagger by position in the day, capped at .2s. */
  .no-scroll-timeline .item.reveal { transition-delay: calc(min(var(--i, 0), 5) * 40ms); }

  /* Must beat the (0,4,0) :nth-child rules above, or odd and even entries
     stay 38px off forever. */
  .no-scroll-timeline .reveal.in,
  .no-scroll-timeline .item.reveal.in:nth-child(odd),
  .no-scroll-timeline .item.reveal.in:nth-child(even) {
    opacity: 1;
    transform: none;
  }

  /* The dot pops a beat after its entry. */
  .no-scroll-timeline .item.reveal .dot {
    transform: scale(0);
    transition: transform .5s var(--ease-spring) .12s;
  }

  .no-scroll-timeline .item.reveal.in .dot { transform: none; }

  /* The rail draws once the day title above it is in - a sibling selector,
     so no extra element needs observing. */
  .no-scroll-timeline .timeline::before {
    transform: scaleY(0);
    transform-origin: top center;
    transition: transform 1.3s var(--ease-out) .1s;
  }

  .no-scroll-timeline .day-head.reveal.in + .timeline::before { transform: scaleY(1); }
}
```

- [ ] **Step 5: Sanity check — braces balance**

```bash
for f in css/motion/*.css; do node -e 'const s=require("fs").readFileSync(process.argv[1],"utf8").replace(/\/\*[\s\S]*?\*\//g,"");const o=(s.match(/{/g)||[]).length,c=(s.match(/}/g)||[]).length;console.log(process.argv[1],o===c?"ok":`MISMATCH ${o}/${c}`)' "$f"; done
```

Expected: every file `ok`.

- [ ] **Step 6: Commit**

```bash
git add css/motion
git commit -m "feat: add scroll-driven animation with IntersectionObserver fallback styles"
```

---

### Task 8: DOM helper and views

**Files:**
- Create: `js/lib/dom.js`, `js/views/hero.js`, `js/views/tabs.js`, `js/views/day.js`, `js/views/countdown.js`, `js/views/footer.js`, `js/views/error.js`

**Interfaces:**
- Consumes: `Trip`, `Day`, `Item`, `ImageSet` (Task 3); description shape from `describeStatus` (Task 4).
- Produces:
  - `h(tag: string, props?: object, ...children): HTMLElement` — props: `class`, `text`, `style` (object, `setProperty`), `dataset` (object), other keys → attributes (`true` → `""`, `null`/`undefined`/`false` skipped). Children: nodes, strings, nested arrays, `null`/`false` skipped.
  - `renderHero(hero, dayCount): HTMLElement` (`header.hero`)
  - `ALL_TAB = 'all'`; `renderTabs(days): HTMLElement` (`div.tabbar`, buttons with `data-tab`)
  - `renderDay(day): HTMLElement` (`section.panel[data-day]`)
  - `createCountdown(): { element: HTMLElement, update(description, phase): void }`
  - `renderFooter(footer): HTMLElement`
  - `renderError(message): HTMLElement`

DOM modules cannot run under `node --test`; they are exercised in Task 10.

- [ ] **Step 1: `js/lib/dom.js`**

```js
// Small element factory. Text always goes in as text nodes or textContent,
// never as HTML.
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);

  for (const [key, value] of Object.entries(props ?? {})) {
    if (value == null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'text') el.textContent = value;
    else if (key === 'style') {
      for (const [property, styleValue] of Object.entries(value)) el.style.setProperty(property, styleValue);
    } else if (key === 'dataset') Object.assign(el.dataset, value);
    else el.setAttribute(key, value === true ? '' : String(value));
  }

  el.append(...children.flat(Infinity).filter((child) => child != null && child !== false));
  return el;
}
```

- [ ] **Step 2: `js/views/hero.js`**

```js
import { h } from '../lib/dom.js';

export function renderHero(hero, dayCount) {
  return h('header', { class: 'hero' },
    hero.image
      ? renderImage('hero-bg', hero.image, { sizes: '130vw', fetchpriority: 'high' })
      : h('div', { class: 'hero-bg' }),
    h('div', { class: 'hero-overlay' }),
    h('div', { class: 'hero-inner wrap' },
      h('div', { class: 'eyebrow', text: hero.eyebrow }),
      h('h1', {}, hero.title, ' ', h('span', { text: `${dayCount} Days` })),
      h('div', { class: 'subtitle', text: hero.subtitle }),
      h('div', { class: 'chips' }, hero.chips.map((chip) => h('span', { class: 'chip', text: chip })))),
    hero.thumbs.length > 0
      ? h('div', { class: 'hero-thumbs' },
        hero.thumbs.map((thumb) => renderImage('thumb', thumb, { sizes: '92px', loading: 'lazy' })))
      : null);
}

// Attribute order matters: loading, sizes and srcset go before src, or the
// browser may start fetching the largest file first. `130vw` on the hero
// covers the 1.3× parallax zoom.
function renderImage(className, image, { sizes, loading, fetchpriority }) {
  return h('img', {
    class: className,
    alt: '',
    decoding: 'async',
    loading,
    fetchpriority,
    sizes,
    srcset: image.srcset,
    src: image.src,
  });
}
```

- [ ] **Step 3: `js/views/tabs.js`**

```js
import { h } from '../lib/dom.js';

export const ALL_TAB = 'all';

export function renderTabs(days) {
  const panelId = (day) => `panel-${day.id}`;
  const tab = (id, label, controls) => h('button', {
    class: 'tab',
    type: 'button',
    role: 'tab',
    id: `tab-${id}`,
    'aria-controls': controls,
    dataset: { tab: id },
  }, label);

  return h('div', { class: 'tabbar' },
    h('div', { class: 'wrap' },
      h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Chọn ngày' },
        tab(ALL_TAB, 'Tất cả', days.map(panelId).join(' ')),
        days.map((day) => tab(day.id, day.label, panelId(day))))));
}
```

- [ ] **Step 4: `js/views/day.js`**

```js
import { h } from '../lib/dom.js';

const join = (separator, ...parts) => parts.filter(Boolean).join(separator);

export function renderDay(day) {
  return h('section', {
    class: 'panel',
    id: `panel-${day.id}`,
    role: 'tabpanel',
    'aria-labelledby': `tab-${day.id}`,
    dataset: { day: day.id },
  },
  h('article', { class: 'day' },
    h('div', { class: 'day-head' },
      h('div', {},
        h('h2', { class: 'day-title', text: join(' ', day.icon, day.label) }),
        h('div', { class: 'day-date', text: join(' · ', day.dateText, day.rangeText, day.note) })),
      h('div', { class: 'day-count', text: day.countText })),
    // Animation CSS relies on this shape: .day-head right before .timeline,
    // and every .item a direct child of .timeline.
    h('div', { class: 'timeline' }, day.items.map(renderItem))));
}

function renderItem(item) {
  return h('div', { class: 'item', dataset: { id: item.id }, style: { '--i': String(item.order) } },
    h('span', { class: 'dot' }),
    h('div', { class: 'time' },
      h('span', { class: 'clock', text: `${item.startText} – ${item.endText}` }),
      h('span', { class: 'period', text: item.period })),
    item.empty ? renderEmptyCard(item) : renderCard(item));
}

function renderCard(item) {
  const hasFooter = Boolean(item.tag || item.mapUrl);
  return h('div', { class: 'card' },
    h('h3', { text: item.heading }),
    hasFooter
      ? h('div', { class: 'card-footer' },
        item.tag ? h('span', { class: 'tag', text: item.tag }) : null,
        item.mapUrl
          ? h('a', { class: 'map-btn', href: item.mapUrl, target: '_blank', rel: 'noopener noreferrer' }, '📍 Maps')
          : null)
      : null);
}

function renderEmptyCard(item) {
  return h('div', { class: 'card empty' }, h('h3', { text: item.heading }));
}
```

- [ ] **Step 5: `js/views/countdown.js`**

```js
import { h } from '../lib/dom.js';

// Constant artwork, not data, so building it from a string is safe.
const HOURGLASS_SVG = `<svg class="hourglass" viewBox="0 0 24 24" aria-hidden="true">
  <defs>
    <clipPath id="hgTop"><path d="M6.6 4h10.8L12 11.6z" /></clipPath>
    <clipPath id="hgBot"><path d="M12 12.4 17.4 20H6.6z" /></clipPath>
  </defs>
  <rect class="hg-sand hg-sand-top" clip-path="url(#hgTop)" x="6.6" y="4" width="10.8" height="7.6" />
  <rect class="hg-sand hg-sand-bot" clip-path="url(#hgBot)" x="6.6" y="12.4" width="10.8" height="7.6" />
  <rect class="hg-stream" x="11.65" y="11" width=".7" height="3" />
  <path class="hg-frame" d="M5.4 3h13.2M5.4 21h13.2M6.8 3.4v3.3c0 1 .4 1.9 1.1 2.6L12 12l-4.1 2.7c-.7.7-1.1 1.6-1.1 2.6v3.3M17.2 3.4v3.3c0 1-.4 1.9-1.1 2.6L12 12l4.1 2.7c.7.7 1.1 1.6 1.1 2.6v3.3" />
</svg>`;

function renderHourglass() {
  const template = document.createElement('template');
  template.innerHTML = HOURGLASS_SVG;
  return template.content.firstElementChild;
}

export function createCountdown() {
  const label = h('span', { class: 'cd-label-text' });
  const note = h('div', { class: 'cd-note' });
  const clock = h('div', { class: 'cd-clock' });

  const element = h('section', { class: 'countdown', 'aria-label': 'Trạng thái chuyến đi' },
    h('div', { class: 'cd-glow', 'aria-hidden': 'true' }),
    renderHourglass(),
    h('div', { class: 'cd-body' },
      h('div', { class: 'cd-label' }, h('span', { class: 'pulse' }), label),
      note),
    clock);

  function update(description, phase) {
    label.textContent = description.label;
    note.textContent = description.note;
    clock.replaceChildren(...(description.tiles
      ? description.tiles.map(renderTile)
      : [h('div', { class: 'cd-headline', text: description.headline })]));
    element.classList.toggle('soon', phase === 'soon');
    element.classList.toggle('live', phase === 'live');
  }

  return { element, update };
}

function renderTile(tile, index, tiles) {
  const isLast = index === tiles.length - 1;
  return h('span', { class: isLast ? 'cd-unit sec' : 'cd-unit' },
    h('b', { text: tile.value }),
    h('i', { text: tile.unit }));
}
```

- [ ] **Step 6: `js/views/footer.js` and `js/views/error.js`**

`js/views/footer.js`:

```js
import { h } from '../lib/dom.js';

export function renderFooter(footer) {
  return h('footer', { class: 'footer' },
    footer.title,
    footer.note ? [h('br'), h('small', { text: footer.note })] : null);
}
```

`js/views/error.js`:

```js
import { h } from '../lib/dom.js';

export function renderError(message) {
  return h('div', { class: 'load-error', role: 'alert' },
    h('strong', { text: 'Không tải được lịch trình' }),
    h('p', { text: message }));
}
```

- [ ] **Step 7: Syntax check — every module parses**

```bash
for f in js/lib/dom.js js/views/*.js; do node --check "$f" && echo "ok $f"; done
```

Expected: `ok` for each file (Node parses ES module syntax thanks to `"type": "module"`).

- [ ] **Step 8: Commit**

```bash
git add js/lib/dom.js js/views
git commit -m "feat: render hero, tabs, days, countdown from the model"
```

---

### Task 9: Controllers, entry point, page shell, README

**Files:**
- Create: `js/controllers/tabs.js`, `js/controllers/status.js`, `js/controllers/reveal.js`, `js/controllers/scroll-fx.js`, `js/main.js`, `README.md`
- Replace: `index.html`

**Interfaces:**
- Consumes: all of Tasks 3–8.
- Produces:
  - `createTabs(tablist: HTMLElement, panels: HTMLElement[]): { select(id: string, options?: { focus?: boolean, scroll?: boolean }): void }`
  - `startStatus({ trip, root, countdown, tabs, clock }): void`
  - `startReveal(root: HTMLElement): void`
  - `startScrollFx({ bar, bg, inner, thumbs }): void`

- [ ] **Step 1: `js/controllers/tabs.js`**

```js
import { ALL_TAB } from '../views/tabs.js';

const ARROW_STEPS = { ArrowLeft: -1, ArrowRight: 1 };

export function createTabs(tablist, panels) {
  const tabs = [...tablist.querySelectorAll('[role="tab"]')];

  function select(id, { focus = false, scroll = false } = {}) {
    const active = tabs.find((tab) => tab.dataset.tab === id) ?? tabs[0];

    for (const tab of tabs) {
      const selected = tab === active;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    }
    for (const panel of panels) {
      panel.hidden = active.dataset.tab !== ALL_TAB && panel.dataset.day !== active.dataset.tab;
    }

    if (focus) active.focus();
    // Only for user input: on phones with many days the row scrolls sideways.
    if (scroll) active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  tablist.addEventListener('click', (event) => {
    const tab = event.target.closest('[role="tab"]');
    if (tab) select(tab.dataset.tab, { scroll: true });
  });

  tablist.addEventListener('keydown', (event) => {
    const index = tabs.indexOf(event.target);
    if (index === -1) return;

    let target;
    if (event.key in ARROW_STEPS) target = (index + ARROW_STEPS[event.key] + tabs.length) % tabs.length;
    else if (event.key === 'Home') target = 0;
    else if (event.key === 'End') target = tabs.length - 1;
    else return;

    event.preventDefault();
    select(tabs[target].dataset.tab, { focus: true, scroll: true });
  });

  select(ALL_TAB);
  return { select };
}
```

- [ ] **Step 2: `js/controllers/status.js`**

```js
import { h } from '../lib/dom.js';
import { getStatus, describeStatus } from '../model/status.js';

const FAST_TICK_MS = 1000; // the seconds tile is on screen
const SLOW_TICK_MS = 15_000;
const SCROLL_DELAY_MS = 400; // let the opened panel lay out first

export function startStatus({ trip, root, countdown, tabs, clock }) {
  const elements = new Map([...root.querySelectorAll('.item[data-id]')].map((el) => [el.dataset.id, el]));
  let firstTick = true;

  function tick() {
    const status = getStatus(trip, clock());

    for (const [id, el] of elements) {
      const live = status.current?.id === id;
      el.classList.toggle('is-now', live);
      el.classList.toggle('is-past', status.pastIds.has(id));
      toggleNowTag(el, live);
    }
    countdown.update(describeStatus(trip, status), status.phase);

    if (firstTick) {
      firstTick = false;
      jumpToLive(status);
    }
    setTimeout(tick, status.phase === 'soon' ? FAST_TICK_MS : SLOW_TICK_MS);
  }

  // During the trip, open the day in progress and bring the slot into view.
  function jumpToLive(status) {
    const focus = status.phase === 'live' ? (status.current ?? status.next) : null;
    if (!focus) return;
    tabs.select(focus.dayId);
    setTimeout(() => {
      elements.get(focus.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, SCROLL_DELAY_MS);
  }

  tick();
}

function toggleNowTag(el, live) {
  const tag = el.querySelector('.now-tag');
  if (live && !tag) el.querySelector('.time').append(h('span', { class: 'now-tag', text: 'Đang diễn ra' }));
  else if (!live && tag) tag.remove();
}
```

- [ ] **Step 3: `js/controllers/reveal.js`**

```js
import { hasScrollTimeline } from '../lib/motion.js';

const TARGETS = '.day-head, .item';

// Layer B reveal. Call in the same task as rendering: marking elements
// .reveal after a paint would flash them visible, then hide them.
export function startReveal(root) {
  if (hasScrollTimeline()) return;

  const targets = [...root.querySelectorAll(TARGETS)];
  for (const el of targets) el.classList.add('reveal');

  if (!('IntersectionObserver' in window)) {
    for (const el of targets) el.classList.add('in');
    return;
  }

  // Panels hidden by a tab never intersect, so their entries reveal when
  // that tab is opened.
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('in');
      observer.unobserve(entry.target); // one-way: never hide again
    }
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });

  for (const el of targets) observer.observe(el);
}
```

- [ ] **Step 4: `js/controllers/scroll-fx.js`**

```js
import { hasScrollTimeline, prefersReducedMotion, scrollFx } from '../lib/motion.js';

// Layer B parallax and progress bar. Inline styles ignore
// @media (prefers-reduced-motion), so the check has to happen here.
export function startScrollFx(targets) {
  if (hasScrollTimeline() || prefersReducedMotion()) return;

  const root = document.documentElement;
  let queued = false;

  function frame() {
    queued = false;
    const styles = scrollFx(window.scrollY, window.innerHeight, root.scrollHeight);
    for (const [name, style] of Object.entries(styles)) {
      if (targets[name]) Object.assign(targets[name].style, style);
    }
  }

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(frame);
  }

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  frame();
}
```

- [ ] **Step 5: `js/main.js`**

```js
import { buildTrip } from './model/trip.js';
import { createClock } from './lib/clock.js';
import { h } from './lib/dom.js';
import { renderHero } from './views/hero.js';
import { renderTabs } from './views/tabs.js';
import { renderDay } from './views/day.js';
import { createCountdown } from './views/countdown.js';
import { renderFooter } from './views/footer.js';
import { renderError } from './views/error.js';
import { createTabs } from './controllers/tabs.js';
import { startStatus } from './controllers/status.js';
import { startReveal } from './controllers/reveal.js';
import { startScrollFx } from './controllers/scroll-fx.js';

const DATA_URL = 'data/trip.json';

async function loadTrip() {
  const response = await fetch(DATA_URL);
  if (!response.ok) throw new Error(`${DATA_URL}: HTTP ${response.status}`);
  return buildTrip(await response.json());
}

function mount(app, trip) {
  const hero = renderHero(trip.hero, trip.dayCount);
  const tabbar = renderTabs(trip.days);
  const countdown = createCountdown();
  const panels = trip.days.map(renderDay);
  const main = h('main', { class: 'wrap' }, countdown.element, panels, renderFooter(trip.footer));

  app.replaceChildren(hero, tabbar, main);
  return { hero, tabbar, countdown, panels, main };
}

async function start() {
  const app = document.getElementById('app');

  try {
    const trip = await loadTrip();
    const view = mount(app, trip);

    // Same task as mount(), before the next paint (see startReveal).
    startReveal(view.main);
    startScrollFx({
      bar: document.querySelector('.progress'),
      bg: view.hero.querySelector('.hero-bg'),
      inner: view.hero.querySelector('.hero-inner'),
      thumbs: view.hero.querySelector('.hero-thumbs'),
    });

    const tabs = createTabs(view.tabbar.querySelector('[role="tablist"]'), view.panels);
    startStatus({ trip, root: view.main, countdown: view.countdown, tabs, clock: createClock(window.location.search) });
  } catch (error) {
    console.error(error);
    app.replaceChildren(h('main', { class: 'wrap' }, renderError(error.message)));
  }
}

start();
```

- [ ] **Step 6: Replace `index.html`**

```html
<!DOCTYPE html>
<html lang="vi">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="theme-color" content="#2d4a3e">
  <title>Đà Lạt Trip Plan</title>
  <link rel="stylesheet" href="css/tokens.css">
  <link rel="stylesheet" href="css/base.css">
  <link rel="stylesheet" href="css/hero.css">
  <link rel="stylesheet" href="css/tabs.css">
  <link rel="stylesheet" href="css/timeline.css">
  <link rel="stylesheet" href="css/countdown.css">
  <link rel="stylesheet" href="css/motion/keyframes.css">
  <link rel="stylesheet" href="css/motion/load.css">
  <link rel="stylesheet" href="css/motion/scroll-timeline.css">
  <link rel="stylesheet" href="css/motion/reveal-fallback.css">
  <script type="module" src="js/main.js"></script>
  <!-- Picks the animation layer before the first paint; keep it last in <head>. -->
  <script>
    if (!(window.CSS && CSS.supports && CSS.supports('animation-timeline', 'view()'))) {
      document.documentElement.classList.add('no-scroll-timeline');
    }
  </script>
</head>

<body>
  <div class="progress" aria-hidden="true"></div>
  <div id="app"></div>
  <noscript>
    <p class="noscript">Trang cần JavaScript. Hãy mở link https://huucao.github.io/dalat/ bằng trình duyệt.</p>
  </noscript>
</body>

</html>
```

- [ ] **Step 7: `README.md`**

````markdown
# Đà Lạt Trip Plan

Lịch trình chuyến Đà Lạt: https://huucao.github.io/dalat/

## Chạy local

Trang dùng ES modules và `fetch`, nên phải chạy qua HTTP server (double-click file sẽ không chạy):

```bash
npm run dev              # npx serve .
# hoặc
python3 -m http.server
```

Xem trước một thời điểm bất kỳ: thêm `?now=2026-10-16T12:00:00%2B07:00` vào URL.

## Test

```bash
npm test
```

Cần Node ≥ 18, không phải cài package nào.

## Sửa lịch trình

Chỉ sửa `data/trip.json`. Thêm ngày = thêm một object vào `days`; thêm điểm = thêm một object vào `items`. Tab, số điểm, khung trống, thứ/ngày, buổi và đếm ngược tự tính lại.

| Trường | Bắt buộc | Ghi chú |
|---|---|---|
| `timezone` | có | `+07:00` |
| `hero.title` | có | |
| `hero.subtitle`, `footer.title` | không | Dùng được `{days}`, `{nights}` |
| `hero.image`, `hero.thumbs[]` | không | `{ "src": "assets/img/hero-{w}.jpg", "widths": [800, 1600, 2560] }` — mỗi width là một file có sẵn |
| `days[].date` | có | `YYYY-MM-DD` |
| `days[].icon`, `days[].note` | không | |
| `items[].start`, `items[].end` | có | `HH:MM`, `end` sau `start` |
| `items[].title` | có | |
| `items[].icon`, `items[].tag` | không | |
| `items[].map` | không | Từ khóa tìm trên Google Maps |
| `items[].empty` | không | `true` = khung trống, không tính là điểm |

Dữ liệu sai sẽ hiện thông báo lỗi kèm vị trí, ví dụ `days[1].items[0].end: phải sau start`.

## Cấu trúc

```
data/trip.json      nội dung
js/lib/             tiện ích thuần (giờ, animation fallback, đồng hồ, tạo DOM)
js/model/           dữ liệu → model, trạng thái chuyến đi (thuần, có test)
js/views/           model → DOM
js/controllers/     tabs, đồng hồ, animation fallback
css/                theo component, mobile-first
css/motion/         keyframes, animation lúc tải, lớp A, lớp B
tests/              node --test
```

## Animation

Hai lớp, chọn bằng script cuối `<head>`:

- **A** — CSS scroll-driven (`animation-timeline`), Chrome 115+, Safari 26+.
- **B** — IntersectionObserver + `requestAnimationFrame`, cho trình duyệt còn lại (`html.no-scroll-timeline`).

Chi tiết và các lỗi đã gặp: [docs/specs/2026-09-11-dynamic-render-design.md](docs/specs/2026-09-11-dynamic-render-design.md), mục 10.

## Nguồn ảnh

Ảnh theo [Unsplash License](https://unsplash.com/license):

- Hero — Pete Walls: https://unsplash.com/photos/Fl3bY0hWXv4
- Thumb A — Pete Walls: https://unsplash.com/photos/RTSpODtSxTw
- Thumb B — Điệp Zader: https://unsplash.com/photos/i29Z07meKds
````

- [ ] **Step 8: Syntax check and unit tests**

```bash
for f in js/controllers/*.js js/main.js; do node --check "$f" && echo "ok $f"; done
npm test
```

Expected: `ok` for each file; all tests PASS.

- [ ] **Step 9: Smoke test in a browser**

```bash
python3 -m http.server 4173 --bind 127.0.0.1   # run in background
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4173/data/trip.json
```

Expected: `200`. Full browser checks follow in Task 10.

- [ ] **Step 10: Commit**

```bash
git add js/controllers js/main.js index.html README.md
git commit -m "feat: wire controllers and replace index.html with data-driven shell"
```

---

### Task 10: Browser verification

**Files:**
- Create (scratchpad only, not committed): `<scratchpad>/verify/verify.mjs`
- Modify: whichever file a failed check points at

**Interfaces:**
- Consumes: local server from Task 9 at `http://127.0.0.1:4173/`; Chrome at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`.

- [ ] **Step 1: Write `verify.mjs`**

```js
// node verify.mjs <baseUrl> <outDir>
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const [BASE = 'http://127.0.0.1:4173/', OUT = './out'] = process.argv.slice(2);
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9333;
mkdirSync(OUT, { recursive: true });

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${OUT}/profile`,
  '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', 'about:blank',
], { stdio: 'ignore' });

const IPHONE = { width: 390, height: 844, dpr: 3, mobile: true };
const DESKTOP = { width: 1440, height: 900, dpr: 2, mobile: false };
const failures = [];

function check(name, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail === undefined ? '' : `  → ${JSON.stringify(detail)}`}`);
  if (!ok) failures.push(name);
}

async function waitForChrome() {
  for (let i = 0; i < 50; i += 1) {
    try { return await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); } catch { await sleep(200); }
  }
  throw new Error('Chrome did not start');
}

async function openPage({ width, height, dpr, mobile }, { query = '', reducedMotion = false, forceFallback = false, rewriteTrip = null } = {}) {
  const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });

  let nextId = 0;
  const pending = new Map();
  const requests = [];
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    nextId += 1;
    pending.set(nextId, { resolve, reject });
    ws.send(JSON.stringify({ id: nextId, method, params }));
  });

  ws.onmessage = async (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message)); else resolve(msg.result);
    } else if (msg.method === 'Network.requestWillBeSent') {
      requests.push(msg.params.request.url);
    } else if (msg.method === 'Fetch.requestPaused') {
      const original = await (await fetch(msg.params.request.url)).text();
      const body = Buffer.from(rewriteTrip(original)).toString('base64');
      send('Fetch.fulfillRequest', {
        requestId: msg.params.requestId,
        responseCode: 200,
        responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
        body,
      });
    }
  };

  await send('Network.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dpr, mobile });
  await send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: reducedMotion ? 'reduce' : 'no-preference' }],
  });
  if (forceFallback) await send('Page.addScriptToEvaluateOnNewDocument', { source: 'CSS.supports = () => false;' });
  if (rewriteTrip) await send('Fetch.enable', { patterns: [{ urlPattern: '*trip.json*' }] });

  await send('Page.navigate', { url: BASE + query });
  await sleep(2500);

  const evaluate = async (expression) => {
    const { result, exceptionDetails } = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
    return result.value;
  };
  const scrollTo = async (y) => { await evaluate(`window.scrollTo({ top: ${y}, behavior: 'instant' })`); await sleep(700); };
  const screenshot = async (file) => {
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(`${OUT}/${file}`, Buffer.from(data, 'base64'));
  };
  const close = async () => { ws.close(); await fetch(`http://127.0.0.1:${PORT}/json/close/${target.id}`); };

  return { evaluate, scrollTo, screenshot, requests, close };
}

const NO_OVERFLOW = 'document.documentElement.scrollWidth === document.documentElement.clientWidth';
const HERO_COVERED = `(() => {
  const hero = document.querySelector('.hero').getBoundingClientRect();
  const bg = document.querySelector('.hero-bg').getBoundingClientRect();
  return bg.top <= hero.top + 0.5 && bg.bottom >= hero.bottom - 0.5 && bg.left <= hero.left + 0.5 && bg.right >= hero.right - 0.5;
})()`;

await waitForChrome();

// 1. iPhone, layer A, before the trip
{
  const page = await openPage(IPHONE);
  check('iphone: layer A (no fallback class)', !(await page.evaluate(`document.documentElement.classList.contains('no-scroll-timeline')`)));
  const heroSrc = await page.evaluate(`document.querySelector('.hero-bg').currentSrc`);
  check('iphone: hero picks 1600', heroSrc.endsWith('hero-1600.jpg'), heroSrc);
  check('iphone: no thumbnail requests', !page.requests.some((url) => url.includes('thumb-')), page.requests.filter((url) => url.includes('thumb-')));
  check('iphone: 4 tabs', (await page.evaluate(`document.querySelectorAll('[role=tab]').length`)) === 4);
  const tabHeight = await page.evaluate(`document.querySelector('.tab').getBoundingClientRect().height`);
  check('iphone: tab ≥ 44px', tabHeight >= 44, tabHeight);
  check('iphone: 13 items', (await page.evaluate(`document.querySelectorAll('.item').length`)) === 13);
  const counts = await page.evaluate(`[...document.querySelectorAll('.day-count')].map((el) => el.textContent)`);
  check('iphone: day counts', JSON.stringify(counts) === JSON.stringify(['7 điểm · 1 khung trống', '1 điểm · 2 khung trống', '1 điểm · 1 khung trống']), counts);
  const label = await page.evaluate(`document.querySelector('.cd-label-text').textContent`);
  check('iphone: countdown label', label === 'Đếm ngược khởi hành', label);
  check('iphone: no horizontal overflow at load', await page.evaluate(NO_OVERFLOW));
  await page.screenshot('iphone-top.png');
  await page.scrollTo(300);
  await page.screenshot('iphone-300.png');
  await page.scrollTo(700);
  check('iphone A: hero edges covered after 480px', await page.evaluate(HERO_COVERED));
  const progress = await page.evaluate(`getComputedStyle(document.querySelector('.progress')).transform`);
  check('iphone A: progress bar moved', progress !== 'none' && progress !== 'matrix(0, 0, 0, 1, 0, 0)', progress);
  await page.scrollTo(1400);
  await page.screenshot('iphone-1400.png');
  await page.scrollTo(100_000);
  check('iphone: no horizontal overflow at bottom', await page.evaluate(NO_OVERFLOW));
  await page.close();
}

// 2. Other phone widths
for (const width of [360, 430]) {
  const page = await openPage({ ...IPHONE, width });
  check(`${width}px: no horizontal overflow at load`, await page.evaluate(NO_OVERFLOW));
  await page.scrollTo(100_000);
  check(`${width}px: no horizontal overflow at bottom`, await page.evaluate(NO_OVERFLOW));
  await page.close();
}

// 3. Desktop
{
  const page = await openPage(DESKTOP);
  const heroSrc = await page.evaluate(`document.querySelector('.hero-bg').currentSrc`);
  check('desktop: hero picks 2560', heroSrc.endsWith('hero-2560.jpg'), heroSrc);
  const thumbs = await page.evaluate(`[...document.querySelectorAll('.thumb')].map((img) => img.complete && img.naturalWidth)`);
  check('desktop: thumbnails loaded', thumbs.length === 2 && thumbs.every(Boolean), thumbs);
  check('desktop: no horizontal overflow', await page.evaluate(NO_OVERFLOW));
  await page.screenshot('desktop-top.png');
  await page.scrollTo(900);
  await page.screenshot('desktop-900.png');
  await page.close();
}

// 4. Live state
{
  const page = await openPage(IPHONE, { query: '?now=2026-10-16T12:00:00%2B07:00' });
  await sleep(800);
  const state = await page.evaluate(`({
    selected: document.querySelector('[aria-selected=true]').dataset.tab,
    visiblePanels: [...document.querySelectorAll('.panel')].filter((p) => !p.hidden).map((p) => p.dataset.day),
    now: [...document.querySelectorAll('.item.is-now')].map((el) => el.dataset.id),
    past: document.querySelectorAll('.item.is-past').length,
    tag: document.querySelector('.item.is-now .now-tag')?.textContent,
    label: document.querySelector('.cd-label-text').textContent,
    headline: document.querySelector('.cd-headline')?.textContent,
    note: document.querySelector('.cd-note').textContent,
  })`);
  check('live: day 1 tab selected', state.selected === 'day-1', state.selected);
  check('live: only day 1 visible', JSON.stringify(state.visiblePanels) === '["day-1"]', state.visiblePanels);
  check('live: slot 3 is now', JSON.stringify(state.now) === '["day-1-item-3"]', state.now);
  check('live: 2 past slots', state.past === 2, state.past);
  check('live: now tag', state.tag === 'Đang diễn ra', state.tag);
  check('live: countdown copy', state.label === 'Đang diễn ra' && state.headline === '🍗 Gà nướng + cơm lam' && state.note === 'Đến 12:15 · đã qua 2/9 điểm', state);
  await sleep(1500);
  const ring = await page.evaluate(`getComputedStyle(document.querySelector('.item.is-now .dot')).boxShadow`);
  check('live A: is-now dot keeps its two-ring shadow after pop', (ring.match(/rgb/g) ?? []).length >= 2, ring);
  await page.screenshot('iphone-live.png');
  await page.close();
}

// 5. Done state
{
  const page = await openPage(IPHONE, { query: '?now=2026-10-19T00:00:00%2B07:00' });
  const state = await page.evaluate(`({
    label: document.querySelector('.cd-label-text').textContent,
    headline: document.querySelector('.cd-headline')?.textContent,
    past: document.querySelectorAll('.item.is-past').length,
  })`);
  check('done: copy and all slots past', state.label === 'Hành trình đã khép lại' && state.headline === 'Hẹn gặp lại Đà Lạt ✦' && state.past === 13, state);
  await page.close();
}

// 6. Layer B (forced)
{
  const page = await openPage(IPHONE, { forceFallback: true });
  check('B: fallback class set', await page.evaluate(`document.documentElement.classList.contains('no-scroll-timeline')`));
  check('B: targets marked .reveal', (await page.evaluate(`document.querySelectorAll('.reveal').length`)) === 16);
  const rail = await page.evaluate(`getComputedStyle(document.querySelector('.timeline'), '::before').opacity`);
  check('B: rail keeps opacity .28', rail === '0.28', rail);
  for (let y = 0; y <= 6000; y += 400) await page.scrollTo(y);
  await sleep(1200);
  const visible = await page.evaluate(`[...document.querySelectorAll('.item.reveal')].filter((el) => !el.closest('[hidden]')).map((el) => ({
    in: el.classList.contains('in'),
    transform: getComputedStyle(el).transform,
    opacity: getComputedStyle(el).opacity,
  }))`);
  check('B: every item revealed after scrolling', visible.every((item) => item.in), visible.filter((item) => !item.in).length);
  check('B: revealed items settle (no 38px offset)', visible.every((item) => item.transform === 'none' && item.opacity === '1'), visible.filter((item) => item.transform !== 'none'));
  const bgTransform = await page.evaluate(`document.querySelector('.hero-bg').style.transform`);
  check('B: parallax applied inline', bgTransform.startsWith('scale('), bgTransform);
  check('B: hero edges covered', await page.evaluate(HERO_COVERED));
  await page.screenshot('iphone-B-scrolled.png');
  await page.close();
}

// 7. Layer B, tab switch reveals the newly shown day
{
  const page = await openPage(IPHONE, { forceFallback: true });
  await page.evaluate(`document.querySelector('[data-tab="day-3"]').click()`);
  await sleep(1500);
  const day3 = await page.evaluate(`[...document.querySelectorAll('#panel-day-3 .reveal')].map((el) => el.classList.contains('in'))`);
  check('B: switching to day 3 reveals its entries', day3.length === 3 && day3.every(Boolean), day3);
  await page.close();
}

// 8. Reduced motion, both layers
for (const forceFallback of [false, true]) {
  const layer = forceFallback ? 'B' : 'A';
  const page = await openPage(IPHONE, { reducedMotion: true, forceFallback });
  const state = await page.evaluate(`({
    rail: getComputedStyle(document.querySelector('.timeline'), '::before').opacity,
    hidden: [...document.querySelectorAll('.item, .day-head')].filter((el) => getComputedStyle(el).opacity !== '1').length,
    inlineParallax: document.querySelector('.hero-bg').style.transform,
    animations: document.getAnimations().filter((a) => !a.effect?.target?.closest?.('.countdown')).length,
  })`);
  check(`reduced ${layer}: nothing hidden`, state.hidden === 0, state.hidden);
  check(`reduced ${layer}: rail opacity .28`, state.rail === '0.28', state.rail);
  check(`reduced ${layer}: no inline parallax`, state.inlineParallax === '', state.inlineParallax);
  check(`reduced ${layer}: no page animations`, state.animations === 0, state.animations);
  await page.close();
}

// 9. Broken trip.json
{
  const page = await openPage(IPHONE, { rewriteTrip: () => '{ broken' });
  const text = await page.evaluate(`document.querySelector('.load-error')?.textContent ?? ''`);
  check('error: message shown', text.startsWith('Không tải được lịch trình'), text);
  await page.close();
}

// 10. A fourth day appears from data alone
{
  const addDay = (json) => {
    const trip = JSON.parse(json);
    trip.days.push({ date: '2026-10-19', icon: '🧳', items: [{ start: '09:00', end: '10:00', title: 'Thêm ngày', tag: 'Test' }] });
    return JSON.stringify(trip);
  };
  const page = await openPage(IPHONE, { rewriteTrip: addDay });
  const state = await page.evaluate(`({
    tabs: [...document.querySelectorAll('[role=tab]')].map((t) => t.textContent),
    panels: document.querySelectorAll('.panel').length,
    subtitle: document.querySelector('.subtitle').textContent,
  })`);
  check('day 4: tab and panel added', state.tabs.at(-1) === 'Day 4' && state.panels === 4, state);
  check('day 4: templates recount', state.subtitle === "Đà Lạt 4 ngày 3 đêm — Let's go", state.subtitle);
  check('day 4: no overflow with 5 tabs', await page.evaluate(NO_OVERFLOW));
  await page.close();
}

chrome.kill();
console.log(failures.length ? `\n${failures.length} FAILED: ${failures.join(', ')}` : '\nALL PASS');
process.exit(failures.length ? 1 : 0);
```

- [ ] **Step 2: Run it**

```bash
node <scratchpad>/verify/verify.mjs http://127.0.0.1:4173/ <scratchpad>/verify/out
```

Expected: every line `PASS`, final `ALL PASS`.

- [ ] **Step 3: Look at the screenshots**

Open `iphone-top.png`, `iphone-300.png`, `iphone-1400.png`, `iphone-live.png`, `iphone-B-scrolled.png`, `desktop-top.png`, `desktop-900.png`. Compare against the live site https://huucao.github.io/dalat/ (same viewports). Expected: same layout and colours; new photos; countdown, tabs, cards match.

- [ ] **Step 4: Fix any failure, re-run Step 2, commit each fix**

For each `FAIL`, fix the file it points at (a view, a CSS file, or a controller), rerun `npm test` and `verify.mjs`, then:

```bash
git add <changed files>
git commit -m "fix: <what the failed check caught>"
```

- [ ] **Step 5: Final state**

```bash
npm test
git status -sb
git log --oneline main..HEAD
```

Expected: tests PASS, clean tree, one commit per task plus any fixes. Do not push or merge — hand back to the user.
