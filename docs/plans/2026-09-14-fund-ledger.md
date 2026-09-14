# Fund Ledger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show planned vs actual spend for every slot, day and shared cost of the Đà Lạt trip, fed by a Google Form → Sheet the 4 members fill in, and settle the shared fund per member.

**Architecture:** Budgets live in `data/trip.json`; actual spend and contributions come from two published Google Sheet CSVs. Pure logic (`js/lib/csv.js`, `js/lib/text.js`, `js/lib/money.js`, `js/model/trip.js`, `js/model/fund.js`) is unit-tested with `node --test`. The schedule renders first with placeholders; `js/controllers/fund.js` loads the CSVs, builds the ledger and hands it to `js/views/fund.js`, which fills card chips, day totals, the status row and the `💰 Quỹ` tab. DOM behaviour is verified in headless Chrome through the DevTools Protocol with Google URLs intercepted.

**Tech Stack:** HTML, CSS, vanilla JS ES modules, Node 22 built-in test runner, Chrome headless + CDP, Google Forms / Sheets (published CSV), GitHub Pages.

**Spec:** `docs/specs/2026-09-14-fund-ledger-design.md` — read §11 first: it overrides earlier sections (optional `csv`, status link picks the slot just finished, separate status card, `lib/text.js`, `Quỹ` reserved, spike moved to the last task).

## Global Constraints

- Zero runtime and dev dependencies. `package.json` only gains the `form-options` script.
- Node ≥ 18 for tests (machine has v22.17.0). Tests: `npm test` → `node --test tests/*.test.js`.
- Data text reaches the DOM only through `h()` / `textContent`. No `innerHTML` for anything from JSON or CSV.
- UI copy is Vietnamese and must match the strings in this plan exactly.
- Money is whole VND integers. Short form `1.660k` / `33,3k` / `0`; full form `260.000đ`; negative sign is U+2212 `−`.
- Names, labels and CSV headers are compared only through `keyOf()` from `js/lib/text.js` (NFC, collapsed spaces, trimmed, `toLocaleLowerCase('vi')`).
- Link prefixes: CSV and sheet `https://docs.google.com/`; form `https://docs.google.com/forms/`. Every external link: `target="_blank" rel="noopener noreferrer"`.
- The fund panel must never contain `.item` or `.day-head` (reveal and status controllers select those). Nothing goes between `.day-head` and `.timeline`; every `.item` stays a direct child of `.timeline`.
- No new animations. The fund panel only gets the existing `.panel` fade.
- Tap targets ≥ 44px. Hover styles only inside `@media (hover: hover)`. Desktop overrides only inside `@media (min-width: 761px)`.
- A `trip.json` without `fund` renders exactly as before (4 tabs, no money UI, no requests to Google).
- Work on branch `feat/update-data-trip`. One commit per task (plus fix commits). Do not push or merge.

## File Map

| File | Status | Responsibility |
|---|---|---|
| `js/lib/csv.js` | create | `parseCsv(text)`, `assertCsv(text)` |
| `js/lib/text.js` | create | `keyOf(value)` |
| `js/lib/money.js` | create | `formatShort`, `formatFull`, `formatDiff`, `formatBalance` |
| `js/model/trip.js` | modify | `budget`, `fund` validation, `formLabel`, `extraLabel`, `trip.fund` |
| `js/model/fund.js` | create | `readTable`, `parseAmount`, `splitShares`, `buildLedger`, `describeBucket`, `describeEntry`, `describeDay`, `progressOf`, `formUrl`, `placeLabelAt` |
| `js/views/tabs.js` | modify | `FUND_TAB`, optional `💰 Quỹ` tab |
| `js/controllers/tabs.js` | modify | `Tất cả` hides the fund panel |
| `js/views/day.js` | modify | money slot in each card, day money slot, extra slot after `.timeline` |
| `js/views/fund.js` | create | slots, `createFundView({ trip, clock })` → `{ panel, statusRow, update, fail, onRefresh }` |
| `js/controllers/fund.js` | create | `startFund({ trip, view, clock })`: fetch, cache, refresh |
| `js/main.js` | modify | shared clock, mount fund view, start fund controller |
| `css/tokens.css` | modify | `--money-over`, `--money-under`, `--money-muted` |
| `css/fund.css` | create | all fund styles |
| `index.html` | modify | `<link>` to `css/fund.css` after `countdown.css` |
| `scripts/form-options.js` | create | print dropdown labels |
| `package.json` | modify | `"form-options"` script |
| `data/trip.json` | modify | budgets + `fund` (links added in Task 10) |
| `README.md` | modify | feature docs, schema, Google Form/Sheet setup guide |
| `tests/csv.test.js`, `tests/text.test.js`, `tests/money.test.js`, `tests/fund.test.js` | create | unit tests |
| `tests/trip.test.js` | modify | budget / fund / label tests |
| `<scratchpad>/verify/verify-fund.mjs` | create, not committed | browser checks |

---

### Task 1: CSV parser

**Files:**
- Create: `js/lib/csv.js`
- Test: `tests/csv.test.js`

**Interfaces:**
- Produces: `parseCsv(text: string) → string[][]` (every row kept, including blank ones, so row index + 1 = sheet line; a trailing line break adds no row); `assertCsv(text: string) → string` (returns `text`, throws `Error('Sheet chưa publish dạng CSV')` when the body is HTML).

- [ ] **Step 1: Write the failing test**

`tests/csv.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, assertCsv } from '../js/lib/csv.js';

test('plain rows and empty cells', () => {
  assert.deepEqual(parseCsv('a,b\n1,2'), [['a', 'b'], ['1', '2']]);
  assert.deepEqual(parseCsv('a,,c'), [['a', '', 'c']]);
  assert.deepEqual(parseCsv(''), []);
});

test('quoted cells keep commas, quotes and line breaks', () => {
  assert.deepEqual(parseCsv('x,"Hữu, MiMi"'), [['x', 'Hữu, MiMi']]);
  assert.deepEqual(parseCsv('"say ""hi"""'), [['say "hi"']]);
  assert.deepEqual(parseCsv('"a\nb",c\nd,e'), [['a\nb', 'c'], ['d', 'e']]);
});

test('CRLF, BOM and trailing line break', () => {
  assert.deepEqual(parseCsv('a,b\r\n1,2\r\n'), [['a', 'b'], ['1', '2']]);
  assert.deepEqual(parseCsv('\uFEFFa,b\n'), [['a', 'b']]);
});

test('blank rows stay so line numbers match the sheet', () => {
  assert.deepEqual(parseCsv('a\n\nb'), [['a'], [''], ['b']]);
});

test('assertCsv rejects an HTML page', () => {
  assert.equal(assertCsv('a,b'), 'a,b');
  assert.throws(() => assertCsv('\uFEFF  <!DOCTYPE html><html>'), /Sheet chưa publish dạng CSV/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/csv.test.js`
Expected: FAIL — `Cannot find module '.../js/lib/csv.js'`.

- [ ] **Step 3: Implement**

`js/lib/csv.js`:

```js
// Google Sheets "Publish to web" CSV: quoted cells may hold commas, doubled
// quotes and line breaks. Blank rows are kept so row index + 1 is the line
// number people see in the sheet.
export function parseCsv(text) {
  const input = text.replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[i + 1] === '\n') i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

// An unpublished sheet answers with Google's sign-in page instead of CSV.
export function assertCsv(text) {
  if (text.replace(/^\uFEFF/, '').trimStart().startsWith('<')) throw new Error('Sheet chưa publish dạng CSV');
  return text;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/csv.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add js/lib/csv.js tests/csv.test.js
git commit -m "feat: add CSV parser for published sheets"
```

---

### Task 2: Text keys and money formatting

**Files:**
- Create: `js/lib/text.js`, `js/lib/money.js`
- Test: `tests/text.test.js`, `tests/money.test.js`

**Interfaces:**
- Produces:
  - `keyOf(value: unknown) → string`
  - `formatShort(amount: number) → string` — `1660000 → '1.660k'`, `33333 → '33,3k'`, `0 → '0'`, `-200000 → '−200k'`
  - `formatFull(amount: number) → string` — `260000 → '260.000đ'`
  - `formatDiff(actual: number, budget: number) → { text: string, tone: 'over' | 'under' }` — `▲ 60k` / `▼ 20k` / `✓`
  - `formatBalance(amount: number) → string` — `+2.695k` / `−200k` / `0`

- [ ] **Step 1: Write the failing tests**

`tests/text.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keyOf } from '../js/lib/text.js';

test('keyOf ignores case, extra spaces and Unicode form', () => {
  assert.equal(keyOf('  Day 1 ·  Hidden   Land '), 'day 1 · hidden land');
  assert.equal(keyOf('Tra\u0302m'), keyOf('Trâm'));
  assert.equal(keyOf('QUỸ'), keyOf('Quỹ'));
  assert.equal(keyOf(null), '');
  assert.equal(keyOf(undefined), '');
});
```

`tests/money.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatShort, formatFull, formatDiff, formatBalance } from '../js/lib/money.js';

test('formatShort rounds to tenths of a thousand', () => {
  assert.equal(formatShort(0), '0');
  assert.equal(formatShort(260_000), '260k');
  assert.equal(formatShort(1_660_000), '1.660k');
  assert.equal(formatShort(11_360_000), '11.360k');
  assert.equal(formatShort(33_333), '33,3k');
  assert.equal(formatShort(300), '0,3k');
  assert.equal(formatShort(999_960), '1.000k');
  assert.equal(formatShort(-200_000), '−200k');
});

test('formatFull writes every dong', () => {
  assert.equal(formatFull(260_000), '260.000đ');
  assert.equal(formatFull(1_080_000), '1.080.000đ');
  assert.equal(formatFull(0), '0đ');
  assert.equal(formatFull(-5_000), '−5.000đ');
});

test('formatDiff and formatBalance carry the direction', () => {
  assert.deepEqual(formatDiff(260_000, 200_000), { text: '▲ 60k', tone: 'over' });
  assert.deepEqual(formatDiff(180_000, 200_000), { text: '▼ 20k', tone: 'under' });
  assert.deepEqual(formatDiff(440_000, 440_000), { text: '✓', tone: 'under' });
  assert.equal(formatBalance(2_695_000), '+2.695k');
  assert.equal(formatBalance(-200_000), '−200k');
  assert.equal(formatBalance(0), '0');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/text.test.js tests/money.test.js`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`js/lib/text.js`:

```js
// One comparison key for names, place labels and sheet headers. Phone
// keyboards may type "Trâm" decomposed (NFD); people add stray spaces and
// capitals. None of that should split one person or place into two.
export function keyOf(value) {
  return String(value ?? '')
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('vi');
}
```

`js/lib/money.js`:

```js
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/text.test.js tests/money.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add js/lib/text.js js/lib/money.js tests/text.test.js tests/money.test.js
git commit -m "feat: add comparison keys and money formatting"
```

---
### Task 3: Trip model — budgets, fund config, form labels

**Files:**
- Modify: `js/model/trip.js` (whole file below)
- Test: `tests/trip.test.js` (append)

**Interfaces:**
- Consumes: `keyOf` from `js/lib/text.js` (Task 2).
- Produces:
  - `export const FUND_PAYER = 'Quỹ'`, `export const EXTRA_TITLE = 'Phát sinh'`
  - item gains `budget: number | null`, `formLabel: string` (`Day N · {title}`)
  - day gains `extraLabel: string` (`Day N · Phát sinh`)
  - `trip.fund: null | { members: string[], csv: { expenses, contributions } | null, form: { url, placeField: string | null } | null, sheet: string | null, shared: Array<{ id: 'shared-N', icon, title, note, budget: number | null, formLabel }>, sharedExtra: { id: 'shared-extra', icon: '⚡', title: 'Phát sinh chung', note: '', budget: null, formLabel: 'Chung · Phát sinh' }, labels: string[] }`

- [ ] **Step 1: Write the failing tests**

Append to `tests/trip.test.js`:

```js
const validFund = { members: ['Hữu', 'MiMi'] };
const withFund = (fund, trip = oneItem(validItem)) => () => buildTrip({ ...trip, fund });

test('budget is optional and must be a whole number of dong', () => {
  assert.equal(buildTrip(oneItem({ ...validItem, budget: 200000 })).items[0].budget, 200000);
  assert.equal(buildTrip(oneItem({ ...validItem, budget: 0 })).items[0].budget, 0);
  assert.equal(buildTrip(oneItem(validItem)).items[0].budget, null);
  assert.throws(() => buildTrip(oneItem({ ...validItem, budget: -1 })), /days\[0\]\.items\[0\]\.budget: phải là số nguyên ≥ 0/);
  assert.throws(() => buildTrip(oneItem({ ...validItem, budget: 1.5 })), /budget: phải là số nguyên ≥ 0/);
  assert.throws(() => buildTrip(oneItem({ ...validItem, budget: '200000' })), /budget: phải là số nguyên ≥ 0/);
});

test('a trip without fund has no fund', () => {
  assert.equal(buildTrip(oneItem(validItem)).fund, null);
});

test('fund builds members, shared costs and labels in form order', () => {
  const built = buildTrip({
    ...minimalTrip([
      { date: '2026-10-17', items: [{ start: '09:00', end: '10:00', title: 'B' }] },
      { date: '2026-10-16', items: [
        { start: '12:00', end: '13:00', title: 'A2' },
        { start: '08:00', end: '09:00', title: 'A1' },
      ] },
    ]),
    fund: { members: [' Hữu ', 'MiMi'], shared: [{ title: 'Khách sạn', icon: '🏨', budget: 1080000, note: '2 đêm' }, { title: 'Xe máy' }] },
  });
  assert.deepEqual(built.fund.labels, [
    'Chung · Khách sạn', 'Chung · Xe máy', 'Chung · Phát sinh',
    'Day 1 · A1', 'Day 1 · A2', 'Day 1 · Phát sinh',
    'Day 2 · B', 'Day 2 · Phát sinh',
  ]);
  assert.deepEqual(built.fund.members, ['Hữu', 'MiMi']);
  assert.deepEqual(built.fund.shared, [
    { id: 'shared-1', icon: '🏨', title: 'Khách sạn', note: '2 đêm', budget: 1080000, formLabel: 'Chung · Khách sạn' },
    { id: 'shared-2', icon: '', title: 'Xe máy', note: '', budget: null, formLabel: 'Chung · Xe máy' },
  ]);
  assert.deepEqual(built.fund.sharedExtra, { id: 'shared-extra', icon: '⚡', title: 'Phát sinh chung', note: '', budget: null, formLabel: 'Chung · Phát sinh' });
  assert.equal(built.days[0].items[0].formLabel, 'Day 1 · A1');
  assert.equal(built.days[0].extraLabel, 'Day 1 · Phát sinh');
  assert.equal(built.fund.csv, null);
  assert.equal(built.fund.form, null);
  assert.equal(built.fund.sheet, null);

  const linked = buildTrip({
    ...oneItem(validItem),
    fund: {
      ...validFund,
      csv: { expenses: 'https://docs.google.com/a', contributions: 'https://docs.google.com/b' },
      form: { url: 'https://docs.google.com/forms/d/e/x/viewform' },
      sheet: 'https://docs.google.com/spreadsheets/d/x/edit',
    },
  });
  assert.deepEqual(linked.fund.csv, { expenses: 'https://docs.google.com/a', contributions: 'https://docs.google.com/b' });
  assert.deepEqual(linked.fund.form, { url: 'https://docs.google.com/forms/d/e/x/viewform', placeField: null });
  assert.equal(linked.fund.sheet, 'https://docs.google.com/spreadsheets/d/x/edit');
});

test('fund config fails with the exact path', () => {
  assert.throws(withFund({ members: [] }), /fund\.members: phải có ít nhất 1 người/);
  assert.throws(withFund({ members: ['Hữu', ' '] }), /fund\.members\[1\]: bắt buộc/);
  assert.throws(withFund({ members: ['Trâm', 'Tra\u0302m'] }), /fund\.members\[1\]: trùng tên/);
  assert.throws(withFund({ members: ['quỹ'] }), /fund\.members\[0\]: "Quỹ" là tên dành riêng/);
  assert.throws(
    withFund({ ...validFund, csv: { expenses: 'https://evil.example/x.csv', contributions: 'https://docs.google.com/x' } }),
    /fund\.csv\.expenses: phải là link https:\/\/docs\.google\.com\//,
  );
  assert.throws(withFund({ ...validFund, csv: { expenses: 'https://docs.google.com/x' } }), /fund\.csv\.contributions: phải là link/);
  assert.throws(withFund({ ...validFund, form: { url: 'javascript:alert(1)' } }), /fund\.form\.url: phải là link https:\/\/docs\.google\.com\/forms\//);
  assert.throws(
    withFund({ ...validFund, form: { url: 'https://docs.google.com/forms/d/e/x/viewform', placeField: 'abc' } }),
    /fund\.form\.placeField: phải có dạng entry\.123456/,
  );
  assert.throws(withFund({ ...validFund, sheet: 'http://docs.google.com/x' }), /fund\.sheet: phải là link/);
  assert.throws(withFund({ ...validFund, shared: {} }), /fund\.shared: phải là mảng/);
  assert.throws(withFund({ ...validFund, shared: [{ title: 'Phát sinh' }] }), /fund\.shared\[0\]\.title: "Phát sinh" là tên dành riêng/);
  assert.throws(withFund({ ...validFund, shared: [{ title: 'Xe' }, { title: 'xe ' }] }), /fund\.shared\[1\]\.title: trùng tên/);
  assert.throws(withFund({ ...validFund, shared: [{ title: 'Xe', budget: -5 }] }), /fund\.shared\[0\]\.budget: phải là số nguyên ≥ 0/);
});

test('with a fund, slot titles must be unique within a day', () => {
  const day = (items) => minimalTrip([{ date: '2026-10-16', items }]);
  const twoX = day([validItem, { start: '10:00', end: '11:00', title: 'x' }]);
  assert.throws(withFund(validFund, twoX), /days\[0\]\.items\[1\]\.title: trùng tên "x" trong cùng ngày/);
  assert.throws(withFund(validFund, day([{ ...validItem, title: 'Phát sinh' }])), /days\[0\]\.items\[0\]\.title: "Phát sinh" là tên dành riêng/);
  assert.doesNotThrow(() => buildTrip(twoX));
  assert.doesNotThrow(withFund(validFund, minimalTrip([
    { date: '2026-10-16', items: [validItem] },
    { date: '2026-10-17', items: [validItem] },
  ])));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/trip.test.js`
Expected: the 5 new tests FAIL (e.g. `budget` is `undefined`, `fund` is `undefined`, no throw for invalid fund); the existing 8 tests still PASS.

- [ ] **Step 3: Implement**

Replace `js/model/trip.js` with:

```js
import {
  isDate, isTime, isTimezone, toMinutes, toDate,
  dateText, dateRangeText, derivePeriod, fillTemplate,
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — every file, including the 5 new trip tests and the unchanged status tests.

- [ ] **Step 5: Commit**

```bash
git add js/model/trip.js tests/trip.test.js
git commit -m "feat: validate budgets and fund config, derive form labels"
```

---
### Task 4: Trip data — budgets, fund block, form options script

**Files:**
- Modify: `data/trip.json` (whole file below)
- Create: `scripts/form-options.js`
- Modify: `package.json`
- Test: `tests/trip.test.js` (append)

**Interfaces:**
- Consumes: `buildTrip` with `fund` support (Task 3).
- Produces: real data used by `tests/fund.test.js` (Task 5) and the page — item ids used later: `day-1-item-1` Đồi chè Cầu Đất, `day-1-item-2` Hidden Land, `day-1-item-3` Gà nướng + Cơm lam, `day-1-item-4` Trại Mèo Mướp, `day-1-item-5` Phong Miên quán, `day-1-item-6` Dốc Sương Nguyệt Ánh, `day-3-item-4` Go Home; shared ids `shared-1` Vé xe 2 chiều, `shared-2` Khách sạn, `shared-3` Xe máy. `npm run form-options` prints 28 labels. `fund` has no `csv` / `form` / `sheet` yet (Task 10 adds them).

- [ ] **Step 1: Write the failing test**

Append to `tests/trip.test.js`:

```js
test('budgets and fund come from the data', () => {
  const budgetOf = (list) => list.reduce((sum, entry) => sum + (entry.budget ?? 0), 0);
  assert.deepEqual(trip.fund.members, ['Hữu', 'MiMi', 'Khanh', 'Trâm']);
  assert.deepEqual(trip.fund.shared.map(({ id, title, budget }) => ({ id, title, budget })), [
    { id: 'shared-1', title: 'Vé xe 2 chiều', budget: 2_800_000 },
    { id: 'shared-2', title: 'Khách sạn', budget: 1_080_000 },
    { id: 'shared-3', title: 'Xe máy', budget: 400_000 },
  ]);
  assert.deepEqual(trip.days.map((day) => budgetOf(day.items)), [3_120_000, 3_040_000, 920_000]);
  assert.equal(budgetOf(trip.fund.shared) + budgetOf(trip.items), 11_360_000);
  assert.equal(trip.days[0].items[5].budget, 0);
  assert.equal(trip.days[2].items.at(-1).budget, null);
  assert.equal(trip.fund.labels.length, 28);
  assert.deepEqual(trip.fund.labels.slice(0, 5), [
    'Chung · Vé xe 2 chiều', 'Chung · Khách sạn', 'Chung · Xe máy', 'Chung · Phát sinh',
    'Day 1 · Đồi chè Cầu Đất — Săn mây, ăn sáng, cà phê',
  ]);
  assert.equal(trip.fund.labels.at(-1), 'Day 3 · Phát sinh');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/trip.test.js`
Expected: FAIL — `Cannot read properties of null (reading 'members')`.

- [ ] **Step 3: Update the data**

Replace `data/trip.json` with:

```json
{
  "timezone": "+07:00",
  "hero": {
    "eyebrow": "✦ Travel plan · Đà Lạt",
    "title": "Đà Lạt",
    "subtitle": "{dates} · {days} ngày {nights} đêm — Let's go",
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
        { "start": "07:00", "end": "09:00", "icon": "🍃", "title": "Đồi chè Cầu Đất — Săn mây, ăn sáng, cà phê", "tag": "Nature", "map": "Đồi chè Cầu Đất Đà Lạt", "budget": 280000 },
        { "start": "09:15", "end": "10:30", "icon": "☕", "title": "Hidden Land", "tag": "Coffee", "map": "Hidden Land coffee Đà Lạt", "budget": 200000 },
        { "start": "11:00", "end": "12:15", "icon": "🍗", "title": "Gà nướng + Cơm lam", "tag": "Lunch", "map": "gà nướng cơm lam gần đồi chè Cầu Đất Đà Lạt", "budget": 400000 },
        { "start": "12:45", "end": "14:00", "icon": "🐈", "title": "Trại Mèo Mướp", "tag": "Cute spot", "map": "Trại Mèo Mướp Đà Lạt", "budget": 440000 },
        { "start": "14:15", "end": "16:00", "icon": "☕", "title": "Phong Miên quán — Forest slow café", "tag": "Coffee", "map": "Phong Miên quán forest slow café Đà Lạt", "budget": 200000 },
        { "start": "16:30", "end": "17:45", "icon": "🌫️", "title": "Dốc Sương Nguyệt Ánh", "tag": "Sunset", "map": "Dốc Sương Nguyệt Ánh Đà Lạt", "budget": 0 },
        { "start": "18:00", "end": "19:00", "icon": "📡", "title": "Tháp Vinaphone Đà Lạt", "tag": "Check-in", "map": "Tháp Vinaphone Đà Lạt", "budget": 0 },
        { "start": "19:15", "end": "20:30", "icon": "🍢", "title": "Ăn tối — Đồ nướng", "tag": "Dinner", "map": "quán nướng Đà Lạt", "budget": 1200000 },
        { "start": "20:45", "end": "22:00", "icon": "🍡", "title": "Ăn vặt chợ Đà Lạt", "tag": "Street food", "map": "Chợ Đà Lạt", "budget": 400000 }
      ]
    },
    {
      "date": "2026-10-17",
      "icon": "☁️",
      "note": "Cà phê · Lẩu · Chợ Đà Lạt",
      "items": [
        { "start": "07:00", "end": "07:45", "icon": "🥞", "title": "Ăn sáng — Bánh căn", "tag": "Breakfast", "map": "bánh căn Đà Lạt", "budget": 240000 },
        { "start": "08:00", "end": "10:00", "icon": "🌊", "title": "Floating Town", "tag": "Coffee", "map": "Floating Town Đà Lạt", "budget": 440000 },
        { "start": "10:15", "end": "11:15", "icon": "☕", "title": "Cà phê — Tự do", "empty": true, "budget": 280000 },
        { "start": "11:30", "end": "12:30", "icon": "🍚", "title": "Ăn trưa — Tự do", "empty": true, "budget": 400000 },
        { "start": "13:00", "end": "15:00", "icon": "☕", "title": "Cà phê Chênh Vênh", "tag": "Coffee", "map": "Chênh Vênh coffee Đà Lạt", "budget": 400000 },
        { "start": "15:30", "end": "17:30", "icon": "⛰️", "title": "Mountain Chill", "tag": "Coffee", "map": "Mountain Chill coffee Đà Lạt", "budget": 280000 },
        { "start": "18:30", "end": "20:00", "icon": "🍲", "title": "Ăn tối — Lẩu", "tag": "Dinner", "map": "quán lẩu Đà Lạt", "budget": 800000 },
        { "start": "20:15", "end": "21:30", "icon": "🍡", "title": "Ăn vặt chợ Đà Lạt", "tag": "Street food", "map": "Chợ Đà Lạt", "budget": 200000 }
      ]
    },
    {
      "date": "2026-10-18",
      "icon": "🌤️",
      "note": "Ngày cuối",
      "items": [
        { "start": "07:30", "end": "08:30", "icon": "🥖", "title": "Ăn sáng — Tự do", "empty": true, "budget": 240000 },
        { "start": "08:45", "end": "10:30", "icon": "☕", "title": "Cà phê — Tự do", "empty": true, "budget": 280000 },
        { "start": "11:00", "end": "12:00", "icon": "🍚", "title": "Ăn trưa — Tự do", "empty": true, "budget": 400000 },
        { "start": "12:15", "end": "13:00", "icon": "🚗", "title": "Go Home", "tag": "End trip" }
      ]
    }
  ],
  "fund": {
    "members": ["Hữu", "MiMi", "Khanh", "Trâm"],
    "shared": [
      { "title": "Vé xe 2 chiều", "icon": "🚌", "budget": 2800000, "note": "700k/người" },
      { "title": "Khách sạn", "icon": "🏨", "budget": 1080000, "note": "270k/đêm/phòng" },
      { "title": "Xe máy", "icon": "🛵", "budget": 400000, "note": "100k/xe/ngày" }
    ]
  },
  "footer": {
    "title": "Đà Lạt Trip Plan · {days} Days · ✦",
    "note": "Công ty TNHH Du lịch & Sự kiện Gia Đình (10/2026)"
  }
}
```

- [ ] **Step 4: Add the form options script**

`scripts/form-options.js`:

```js
// Prints the "Địa điểm" dropdown choices, one per line. Paste the whole
// output into the first option of the question; Google Forms splits it.
import { readFileSync } from 'node:fs';
import { buildTrip } from '../js/model/trip.js';

const trip = buildTrip(JSON.parse(readFileSync(new URL('../data/trip.json', import.meta.url), 'utf8')));

if (!trip.fund) {
  console.error('data/trip.json chưa có khối "fund".');
  process.exit(1);
}

console.log(trip.fund.labels.join('\n'));
```

In `package.json`, the `scripts` block becomes:

```json
  "scripts": {
    "test": "node --test tests/*.test.js",
    "dev": "npx --yes serve .",
    "form-options": "node scripts/form-options.js"
  }
```

- [ ] **Step 5: Run tests and the script**

Run: `npm test && npm run --silent form-options`
Expected: all tests PASS; the script prints 28 lines, first `Chung · Vé xe 2 chiều`, last `Day 3 · Phát sinh`, with `Day 2 · Cà phê — Tự do` and `Day 3 · Cà phê — Tự do` both present.

- [ ] **Step 6: Commit**

```bash
git add data/trip.json scripts/form-options.js package.json tests/trip.test.js
git commit -m "feat: add trip budgets, fund members and form options script"
```

---
### Task 5: Fund ledger model

**Files:**
- Create: `js/model/fund.js`
- Test: `tests/fund.test.js`

**Interfaces:**
- Consumes: `keyOf` (Task 2); `formatShort`, `formatFull`, `formatDiff` (Task 2); `FUND_PAYER`, `trip.fund`, `item.formLabel`, `item.budget`, `day.extraLabel` (Task 3); real `data/trip.json` (Task 4); `parseCsv` (Task 1) in tests.
- Produces (all exported from `js/model/fund.js`):
  - `readTable(rows: string[][], tableName: string, columns: Record<key, { names: string[], required?: boolean }>) → Array<{ line: number, [key]: string }>` — throws `Error('<tableName>: thiếu cột "<names[0]>"')`
  - `parseAmount(text: string) → number | null`
  - `splitShares(amount: number, count: number) → number[]`
  - `buildLedger(trip, { expenses: string[][] | null, contributions: string[][] | null }, now: number) → Ledger`
  - `Bucket = { id: string, label: string, budget: number | null, actual: number, entries: Entry[] }`
  - `Entry = { line, label, amount, payer: string, splitFor: string[], note, enteredBy, time: string, sortKey: number, settled: boolean }`
  - `Ledger = { totals: { budget, actual, extra, contributed, fundPaid, fundLeft, reserve }, days: Array<{ id, label, budget, actual, extra, extraBucket: Bucket }>, shared: { budget, actual, extra, costs: Bucket[], extraBucket: Bucket }, unmatched: Bucket, byId: Map<string, Bucket>, people: Array<{ name, contributed, advanced, share, balance }>, contributions: Array<{ line, date, member, amount, note }>, entries: Entry[], warnings: string[], excluded: number, done: boolean, settlement: null | Array<{ name, amount, direction: 'refund' | 'topup', text }> }`
  - bucket ids: item ids (`day-1-item-2`), `day-N-extra`, `shared-N`, `shared-extra`
  - `describeBucket(bucket, memberCount) → { icon: '💰' | '🆓', text, diff: string | null, tone: 'muted' | 'over' | 'under' | '' }`
  - `describeEntry(entry, members: string[]) → { amount, payer, detail, meta }`
  - `progressOf(actual, budget) → { ratio: number, over: boolean }`
  - `describeDay({ budget, actual, extra }) → { text, ratio, over }`
  - `formUrl(fund, label: string | null) → string | null`
  - `placeLabelAt(trip, now: number) → string | null`

- [ ] **Step 1: Write the failing test**

`tests/fund.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildTrip } from '../js/model/trip.js';
import { parseCsv } from '../js/lib/csv.js';
import {
  readTable, parseAmount, splitShares, buildLedger,
  describeBucket, describeEntry, describeDay, formUrl, placeLabelAt,
} from '../js/model/fund.js';

const trip = buildTrip(JSON.parse(readFileSync(new URL('../data/trip.json', import.meta.url), 'utf8')));
const MEMBERS = ['Hữu', 'MiMi', 'Khanh', 'Trâm'];

// Scenario from the spec: everyone put in 3.000k, Hữu paid the hotel by card,
// Khanh paid lunch, the fund paid the rest; afternoon of Day 1.
const EXPENSES = [
  'Dấu thời gian,Người nhập,Địa điểm,Số tiền,Ai trả,Chia cho,Ghi chú',
  '01/10/2026 21:00:00,Hữu,Chung · Khách sạn,1080000,Hữu,,Đặt 2 đêm',
  '05/10/2026 10:00:00,MiMi,Chung · Vé xe 2 chiều,2800000,Quỹ,,4 vé',
  '16/10/2026 8:50:00,Khanh,"Day 1 · Đồi chè Cầu Đất — Săn mây, ăn sáng, cà phê",300000,Quỹ,,Vé + ăn sáng',
  '16/10/2026 10:40:00,MiMi,Day 1 · Hidden Land,260000,Quỹ,,4 nước + bánh',
  '16/10/2026 12:20:00,Khanh,Day 1 · Gà nướng + Cơm lam,540000,Khanh,,',
  '16/10/2026 13:10:00,Trâm,Day 1 · Phát sinh,120000,Quỹ,,Áo mưa x4',
  '16/10/2026 14:00:00,Trâm,Day 1 · Trại Mèo Mướp,440000,Quỹ,,Vé kèm nước',
].join('\n');
const CONTRIBUTIONS = [
  'Ngày,Người góp,Số tiền,Ghi chú',
  '10/10,Hữu,3000000,',
  '10/10,MiMi,3000000,',
  '11/10,Khanh,3000000,',
  '11/10,Trâm,3000000,CK',
].join('\n');
const DURING = Date.parse('2026-10-16T15:00:00+07:00');
const AFTER = Date.parse('2026-10-19T00:00:00+07:00');

const ledgerOf = (expenses = EXPENSES, contributions = CONTRIBUTIONS, now = DURING) =>
  buildLedger(trip, { expenses: parseCsv(expenses), contributions: parseCsv(contributions) }, now);
const withRows = (...rows) => ledgerOf([EXPENSES, ...rows].join('\n'));
const balanceSum = (ledger) => ledger.people.reduce((sum, person) => sum + person.balance, 0);

test('readTable finds columns by name, in any order, case or Unicode form', () => {
  const rows = parseCsv('ghi chú, SỐ TIỀN ,Ai trả,Chia cho,Đi\u0323a điểm\nx,5,Quỹ,,Day 1 · Hidden Land\n,,,,\n');
  const columns = {
    place: { names: ['Địa điểm'], required: true },
    amount: { names: ['Số tiền'], required: true },
    note: { names: ['Ghi chú'] },
    enteredBy: { names: ['Người nhập'] },
  };
  assert.deepEqual(readTable(rows, 'ChiTieu', columns), [
    { line: 2, place: 'Day 1 · Hidden Land', amount: '5', note: 'x', enteredBy: '' },
  ]);
  assert.throws(() => readTable(parseCsv('Địa điểm\n'), 'ChiTieu', { amount: { names: ['Số tiền'], required: true } }), /ChiTieu: thiếu cột "Số tiền"/);
  assert.throws(() => readTable([], 'GopQuy', { member: { names: ['Người góp'], required: true } }), /GopQuy: thiếu cột "Người góp"/);
});

test('amounts keep only digits', () => {
  assert.equal(parseAmount('260000'), 260000);
  assert.equal(parseAmount('260.000'), 260000);
  assert.equal(parseAmount('260,000đ'), 260000);
  assert.equal(parseAmount(''), null);
  assert.equal(parseAmount('abc'), null);
  assert.equal(parseAmount('0'), null);
});

test('shares split whole dong and always add up', () => {
  assert.deepEqual(splitShares(100000, 3), [33334, 33333, 33333]);
  assert.deepEqual(splitShares(100001, 4), [25001, 25000, 25000, 25000]);
  assert.equal(splitShares(1_234_567, 7).reduce((a, b) => a + b, 0), 1_234_567);
});

test('the ledger adds up per slot, day, shared costs and trip', () => {
  const ledger = ledgerOf();
  const hidden = ledger.byId.get('day-1-item-2');
  assert.equal(hidden.label, 'Day 1 · Hidden Land');
  assert.equal(hidden.budget, 200000);
  assert.equal(hidden.actual, 260000);
  assert.equal(ledger.byId.get('day-1-item-6').budget, 0);
  assert.equal(ledger.byId.get('day-3-item-4').budget, null);
  assert.equal(ledger.byId.get('shared-2').actual, 1_080_000);
  assert.deepEqual(ledger.days.map(({ id, label, budget, actual, extra }) => ({ id, label, budget, actual, extra })), [
    { id: 'day-1', label: 'Day 1', budget: 3_120_000, actual: 1_660_000, extra: 120_000 },
    { id: 'day-2', label: 'Day 2', budget: 3_040_000, actual: 0, extra: 0 },
    { id: 'day-3', label: 'Day 3', budget: 920_000, actual: 0, extra: 0 },
  ]);
  assert.equal(ledger.days[0].extraBucket.id, 'day-1-extra');
  assert.deepEqual(
    { budget: ledger.shared.budget, actual: ledger.shared.actual, extra: ledger.shared.extra, costs: ledger.shared.costs.map((c) => c.id) },
    { budget: 4_280_000, actual: 3_880_000, extra: 0, costs: ['shared-1', 'shared-2', 'shared-3'] },
  );
  assert.deepEqual(ledger.totals, {
    budget: 11_360_000, actual: 5_540_000, extra: 120_000,
    contributed: 12_000_000, fundPaid: 3_920_000, fundLeft: 8_080_000, reserve: 640_000,
  });
  assert.deepEqual(ledger.warnings, []);
  assert.equal(ledger.excluded, 0);
});

test('entries are newest first and keep who entered them', () => {
  const ledger = ledgerOf();
  assert.deepEqual(ledger.entries.map((entry) => entry.line), [8, 7, 6, 5, 4, 3, 2]);
  assert.deepEqual(ledger.entries[0], {
    line: 8, label: 'Day 1 · Trại Mèo Mướp', amount: 440000, payer: 'Quỹ', splitFor: MEMBERS,
    note: 'Vé kèm nước', enteredBy: 'Trâm', time: '16/10 14:00', sortKey: Date.UTC(2026, 9, 16, 14, 0), settled: true,
  });
  assert.equal(ledger.byId.get('day-1-item-1').entries[0].time, '16/10 08:50');
  assert.deepEqual(ledger.contributions[3], { line: 5, date: '11/10', member: 'Trâm', amount: 3_000_000, note: 'CK' });
});

test('member balance is contributed + advanced − share and all balances add up to the fund left', () => {
  const ledger = ledgerOf();
  assert.deepEqual(ledger.people, [
    { name: 'Hữu', contributed: 3_000_000, advanced: 1_080_000, share: 1_385_000, balance: 2_695_000 },
    { name: 'MiMi', contributed: 3_000_000, advanced: 0, share: 1_385_000, balance: 1_615_000 },
    { name: 'Khanh', contributed: 3_000_000, advanced: 540_000, share: 1_385_000, balance: 2_155_000 },
    { name: 'Trâm', contributed: 3_000_000, advanced: 0, share: 1_385_000, balance: 1_615_000 },
  ]);
  assert.equal(balanceSum(ledger), ledger.totals.fundLeft);
  assert.equal(ledger.done, false);
  assert.equal(ledger.settlement, null);
});

test('once the trip ends the fund is settled, largest first', () => {
  const ledger = ledgerOf(EXPENSES, CONTRIBUTIONS, AFTER);
  assert.equal(ledger.done, true);
  assert.deepEqual(ledger.settlement.map((line) => line.text), [
    '→ Quỹ hoàn Hữu 2.695k',
    '→ Quỹ hoàn Khanh 2.155k',
    '→ Quỹ hoàn MiMi 1.615k',
    '→ Quỹ hoàn Trâm 1.615k',
  ]);
  assert.deepEqual(ledger.settlement[0], { name: 'Hữu', amount: 2_695_000, direction: 'refund', text: '→ Quỹ hoàn Hữu 2.695k' });

  const short = ledgerOf(EXPENSES, 'Người góp,Số tiền\nHữu,1000000', AFTER);
  assert.deepEqual(short.settlement.map((line) => line.text), [
    '→ MiMi nộp thêm vào quỹ 1.385k',
    '→ Trâm nộp thêm vào quỹ 1.385k',
    '→ Khanh nộp thêm vào quỹ 845k',
    '→ Quỹ hoàn Hữu 695k',
  ]);
  assert.equal(short.totals.reserve, -10_360_000);
  assert.equal(balanceSum(short), short.totals.fundLeft);
});

test('messy rows are normalised, flagged, and never lose money', () => {
  const ledger = withRows(
    '16/10/2026 15:00:00,Hữu,day 1 ·  hidden land ,"50.000đ",quỹ,,',
    '16/10/2026 15:05:00,Hữu,Day 1 · Hiden Land,70000,Quỹ,,',
    '16/10/2026 15:10:00,Hữu,Day 1 · Hidden Land,abc,Quỹ,,',
    '16/10/2026 15:15:00,Hữu,Day 1 · Hidden Land,90000,Tram,,',
    '16/10/2026 15:20:00,Hữu,Day 1 · Hidden Land,30000,Quỹ,"Tra\u0302m, Hữu",',
  );
  assert.deepEqual(ledger.warnings, [
    'Dòng 10 · Địa điểm "Day 1 · Hiden Land" không khớp',
    'Dòng 11 · Số tiền "abc" không hợp lệ',
    'Dòng 12 · Ai trả "Tram" không phải thành viên',
  ]);
  const hidden = ledger.byId.get('day-1-item-2');
  assert.equal(hidden.actual, 260000 + 50000 + 90000 + 30000);
  assert.deepEqual(hidden.entries.find((entry) => entry.line === 13).splitFor, ['Hữu', 'Trâm']);
  assert.equal(hidden.entries.find((entry) => entry.line === 12).settled, false);
  assert.equal(ledger.unmatched.actual, 70000);
  assert.equal(ledger.unmatched.entries[0].label, 'Day 1 · Hiden Land');
  assert.equal(ledger.totals.actual, 5_540_000 + 50000 + 70000 + 90000 + 30000);
  assert.equal(ledger.totals.fundPaid, 3_920_000 + 50000 + 70000 + 30000);
  assert.equal(ledger.excluded, 1);
  assert.equal(balanceSum(ledger), ledger.totals.fundLeft);
});

test('an unknown name in "Chia cho" keeps the row out of the settlement', () => {
  const ledger = withRows('16/10/2026 15:00:00,Hữu,Day 1 · Phát sinh,40000,Quỹ,"Hữu, Bob",Nước');
  assert.deepEqual(ledger.warnings, ['Dòng 9 · Chia cho "Bob" không phải thành viên']);
  assert.equal(ledger.excluded, 1);
  assert.equal(ledger.days[0].extra, 160000);
  assert.equal(ledger.totals.fundPaid, 3_920_000);
});

test('contributions with a bad name or amount are skipped with a warning', () => {
  const ledger = ledgerOf(EXPENSES, 'Ngày,Người góp,Số tiền,Ghi chú\n10/10,Bob,100,\n10/10,Hữu,,\n10/10,hữu,"3.000.000",');
  assert.deepEqual(ledger.warnings, [
    'GopQuy dòng 2 · Người góp "Bob" không phải thành viên',
    'GopQuy dòng 3 · Số tiền "" không hợp lệ',
  ]);
  assert.equal(ledger.totals.contributed, 3_000_000);
  assert.deepEqual(ledger.contributions, [{ line: 4, date: '10/10', member: 'Hữu', amount: 3_000_000, note: '' }]);
});

test('a sheet without a required column throws a readable error', () => {
  assert.throws(() => ledgerOf('Địa điểm,Ai trả,Chia cho\nx,Quỹ,'), /ChiTieu: thiếu cột "Số tiền"/);
  assert.throws(() => ledgerOf(EXPENSES, 'Ngày,Số tiền\n1,2'), /GopQuy: thiếu cột "Người góp"/);
});

test('without sheets the ledger holds budgets only', () => {
  const ledger = buildLedger(trip, { expenses: null, contributions: null }, DURING);
  assert.equal(ledger.totals.budget, 11_360_000);
  assert.equal(ledger.totals.actual, 0);
  assert.equal(ledger.totals.reserve, -11_360_000);
  assert.equal(ledger.entries.length, 0);
  assert.equal(ledger.people[0].balance, 0);
});

test('describeBucket covers every chip state', () => {
  const chip = (budget, actual) => describeBucket({ budget, actual }, 4);
  assert.deepEqual(chip(200000, 0), { icon: '💰', text: 'Dự kiến 200k · 50k/người', diff: null, tone: 'muted' });
  assert.deepEqual(chip(200000, 180000), { icon: '💰', text: '180k / 200k', diff: '▼ 20k', tone: 'under' });
  assert.deepEqual(chip(440000, 440000), { icon: '💰', text: '440k / 440k', diff: '✓', tone: 'under' });
  assert.deepEqual(chip(200000, 260000), { icon: '💰', text: '260k / 200k', diff: '▲ 60k', tone: 'over' });
  assert.deepEqual(chip(0, 0), { icon: '🆓', text: 'Miễn phí', diff: null, tone: 'muted' });
  assert.deepEqual(chip(0, 20000), { icon: '💰', text: '20k · ngoài dự kiến', diff: null, tone: 'over' });
  assert.deepEqual(chip(null, 0), { icon: '💰', text: 'Chưa chi', diff: null, tone: 'muted' });
  assert.deepEqual(chip(null, 540000), { icon: '💰', text: '540k', diff: null, tone: '' });
});

test('describeEntry reads like the sketch', () => {
  const ledger = ledgerOf();
  assert.deepEqual(describeEntry(ledger.byId.get('day-1-item-2').entries[0], MEMBERS), {
    amount: '260.000đ', payer: 'Quỹ trả', detail: '4 nước + bánh · chia 4', meta: 'MiMi nhập · 16/10 10:40',
  });
  const partial = { amount: 90000, payer: 'Khanh', splitFor: ['Hữu', 'Khanh'], note: '', enteredBy: '', time: '', settled: true };
  assert.deepEqual(describeEntry(partial, MEMBERS), { amount: '90.000đ', payer: 'Khanh ứng', detail: 'chia Hữu, Khanh', meta: '' });
  assert.equal(describeEntry({ ...partial, payer: 'Tram', settled: false }, MEMBERS).payer, 'Tram trả ⚠️');
});

test('describeDay shows spend, budget, extras and a capped ratio', () => {
  assert.deepEqual(describeDay({ budget: 3_120_000, actual: 1_560_000, extra: 120_000 }), { text: '💰 1.560k / 3.120k · phát sinh 120k', ratio: 0.5, over: false });
  assert.deepEqual(describeDay({ budget: 100, actual: 300, extra: 0 }), { text: '💰 0,3k / 0,1k', ratio: 1, over: true });
  assert.deepEqual(describeDay({ budget: 0, actual: 0, extra: 0 }), { text: '💰 0 / 0', ratio: 0, over: false });
});

test('form links pick the place when the form allows it', () => {
  const fund = { form: { url: 'https://docs.google.com/forms/d/e/abc/viewform', placeField: 'entry.123' } };
  const link = new URL(formUrl(fund, 'Day 1 · Gà nướng + Cơm lam'));
  assert.equal(link.origin + link.pathname, fund.form.url);
  assert.equal(link.searchParams.get('usp'), 'pp_url');
  assert.equal(link.searchParams.get('entry.123'), 'Day 1 · Gà nướng + Cơm lam');
  assert.equal(formUrl(fund, null), fund.form.url);
  assert.equal(formUrl({ form: { url: fund.form.url, placeField: null } }, 'X'), fund.form.url);
  assert.equal(formUrl({ form: null }, 'X'), null);
});

test('placeLabelAt picks the slot in progress, else the one just finished', () => {
  const at = (iso) => placeLabelAt(trip, Date.parse(iso));
  assert.equal(at('2026-10-16T06:00:00+07:00'), null);
  assert.equal(at('2026-10-16T09:30:00+07:00'), 'Day 1 · Hidden Land');
  assert.equal(at('2026-10-16T10:40:00+07:00'), 'Day 1 · Hidden Land');
  assert.equal(at('2026-10-16T15:00:00+07:00'), 'Day 1 · Phong Miên quán — Forest slow café');
  assert.equal(at('2026-10-16T23:00:00+07:00'), 'Day 1 · Ăn vặt chợ Đà Lạt');
  assert.equal(at('2026-10-18T13:00:00+07:00'), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/fund.test.js`
Expected: FAIL — `Cannot find module '.../js/model/fund.js'`.

- [ ] **Step 3: Implement**

`js/model/fund.js`:

```js
import { keyOf } from '../lib/text.js';
import { formatShort, formatFull, formatDiff } from '../lib/money.js';
import { FUND_PAYER } from './trip.js';

const EXPENSE_COLUMNS = {
  time: { names: ['Dấu thời gian', 'Timestamp'] },
  enteredBy: { names: ['Người nhập'] },
  place: { names: ['Địa điểm'], required: true },
  amount: { names: ['Số tiền'], required: true },
  payer: { names: ['Ai trả'], required: true },
  split: { names: ['Chia cho'], required: true },
  note: { names: ['Ghi chú'] },
};

const CONTRIBUTION_COLUMNS = {
  date: { names: ['Ngày'] },
  member: { names: ['Người góp'], required: true },
  amount: { names: ['Số tiền'], required: true },
  note: { names: ['Ghi chú'] },
};

// Google Sheets with the Vietnam locale writes "16/10/2026 8:50:00".
const TIMESTAMP = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/;

const sum = (list, key) => list.reduce((total, entry) => total + (entry[key] ?? 0), 0);
const newestFirst = (a, b) => b.sortKey - a.sortKey || b.line - a.line;
const pad = (value) => value.padStart(2, '0');

// Columns are found by name, so the form's questions can be reordered. Line
// numbers match the sheet (header is line 1); blank rows are skipped.
export function readTable(rows, tableName, columns) {
  const header = (rows[0] ?? []).map(keyOf);
  const positions = Object.entries(columns).map(([key, { names, required }]) => {
    const at = header.findIndex((cell) => names.some((name) => keyOf(name) === cell));
    if (at === -1 && required) throw new Error(`${tableName}: thiếu cột "${names[0]}"`);
    return [key, at];
  });

  return rows.slice(1)
    .map((cells, index) => ({ line: index + 2, cells }))
    .filter(({ cells }) => cells.some((cell) => cell.trim() !== ''))
    .map(({ line, cells }) => Object.fromEntries([
      ['line', line],
      ...positions.map(([key, at]) => [key, at === -1 ? '' : (cells[at] ?? '').trim()]),
    ]));
}

export function parseAmount(text) {
  const digits = String(text ?? '').replace(/\D/g, '');
  const amount = Number(digits);
  return digits && amount > 0 ? amount : null;
}

// Whole dong only: the leftover dong go one each to the first people, so the
// parts always add back up to the amount.
export function splitShares(amount, count) {
  const base = Math.floor(amount / count);
  const rest = amount - base * count;
  return Array.from({ length: count }, (_, index) => base + (index < rest ? 1 : 0));
}

function readTime(text) {
  const match = TIMESTAMP.exec(text);
  if (!match) return { time: text, sortKey: 0 };
  const [, day, month, year, hours, minutes] = match;
  const date = `${pad(day)}/${pad(month)}`;
  return {
    time: hours ? `${date} ${pad(hours)}:${minutes}` : date,
    sortKey: Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hours ?? 0), Number(minutes ?? 0)),
  };
}

export function buildLedger(trip, tables, now) {
  const { fund } = trip;
  const { members } = fund;
  const memberByKey = new Map(members.map((name) => [keyOf(name), name]));
  const people = new Map(members.map((name) => [name, { name, contributed: 0, advanced: 0, share: 0, balance: 0 }]));
  const warnings = [];

  const byId = new Map();
  const byLabel = new Map();
  const addBucket = (id, label, budget) => {
    const bucket = { id, label, budget, actual: 0, entries: [] };
    byId.set(id, bucket);
    byLabel.set(keyOf(label), bucket);
  };
  for (const cost of fund.shared) addBucket(cost.id, cost.formLabel, cost.budget);
  addBucket(fund.sharedExtra.id, fund.sharedExtra.formLabel, null);
  for (const day of trip.days) {
    for (const item of day.items) addBucket(item.id, item.formLabel, item.budget);
    addBucket(`${day.id}-extra`, day.extraLabel, null);
  }
  const unmatched = { id: 'unmatched', label: 'Không khớp địa điểm', budget: null, actual: 0, entries: [] };

  const entries = [];
  let fundPaid = 0;
  let excluded = 0;

  const expenseRows = tables.expenses ? readTable(tables.expenses, 'ChiTieu', EXPENSE_COLUMNS) : [];
  for (const row of expenseRows) {
    const amount = parseAmount(row.amount);
    if (amount === null) {
      warnings.push(`Dòng ${row.line} · Số tiền "${row.amount}" không hợp lệ`);
      continue;
    }

    const bucket = byLabel.get(keyOf(row.place));
    if (!bucket) warnings.push(`Dòng ${row.line} · Địa điểm "${row.place}" không khớp`);

    const payer = keyOf(row.payer) === keyOf(FUND_PAYER) ? FUND_PAYER : memberByKey.get(keyOf(row.payer));
    if (!payer) warnings.push(`Dòng ${row.line} · Ai trả "${row.payer}" không phải thành viên`);

    const named = row.split.split(',').map((name) => name.trim()).filter(Boolean);
    const unknown = named.filter((name) => !memberByKey.has(keyOf(name)));
    for (const name of unknown) warnings.push(`Dòng ${row.line} · Chia cho "${name}" không phải thành viên`);
    const chosen = new Set(named.map((name) => memberByKey.get(keyOf(name))));
    const splitFor = named.length === 0 ? [...members] : members.filter((name) => chosen.has(name));

    const settled = Boolean(payer) && unknown.length === 0;
    const entry = {
      line: row.line,
      label: row.place,
      amount,
      payer: payer ?? row.payer,
      splitFor,
      note: row.note,
      enteredBy: row.enteredBy,
      ...readTime(row.time),
      settled,
    };
    const target = bucket ?? unmatched;
    target.actual += amount;
    target.entries.push(entry);
    entries.push(entry);

    // Money with an unknown payer or sharer still shows in the totals, but
    // cannot be charged to anyone until the sheet is fixed.
    if (!settled) {
      excluded += 1;
      continue;
    }
    if (payer === FUND_PAYER) fundPaid += amount;
    else people.get(payer).advanced += amount;
    splitShares(amount, splitFor.length).forEach((part, index) => {
      people.get(splitFor[index]).share += part;
    });
  }

  const contributions = [];
  const contributionRows = tables.contributions ? readTable(tables.contributions, 'GopQuy', CONTRIBUTION_COLUMNS) : [];
  for (const row of contributionRows) {
    const amount = parseAmount(row.amount);
    if (amount === null) {
      warnings.push(`GopQuy dòng ${row.line} · Số tiền "${row.amount}" không hợp lệ`);
      continue;
    }
    const member = memberByKey.get(keyOf(row.member));
    if (!member) {
      warnings.push(`GopQuy dòng ${row.line} · Người góp "${row.member}" không phải thành viên`);
      continue;
    }
    people.get(member).contributed += amount;
    contributions.push({ line: row.line, date: row.date, member, amount, note: row.note });
  }

  for (const bucket of [...byId.values(), unmatched]) bucket.entries.sort(newestFirst);
  entries.sort(newestFirst);

  const days = trip.days.map((day) => {
    const items = day.items.map((item) => byId.get(item.id));
    const extraBucket = byId.get(`${day.id}-extra`);
    return {
      id: day.id,
      label: day.label,
      budget: sum(items, 'budget'),
      actual: sum(items, 'actual') + extraBucket.actual,
      extra: extraBucket.actual,
      extraBucket,
    };
  });

  const costs = fund.shared.map((cost) => byId.get(cost.id));
  const sharedExtra = byId.get(fund.sharedExtra.id);
  const shared = {
    budget: sum(costs, 'budget'),
    actual: sum(costs, 'actual') + sharedExtra.actual,
    extra: sharedExtra.actual,
    costs,
    extraBucket: sharedExtra,
  };

  const list = [...people.values()];
  for (const person of list) person.balance = person.contributed + person.advanced - person.share;

  const contributed = sum(list, 'contributed');
  const budget = shared.budget + sum(days, 'budget');
  const totals = {
    budget,
    actual: shared.actual + sum(days, 'actual') + unmatched.actual,
    extra: shared.extra + sum(days, 'extra'),
    contributed,
    fundPaid,
    fundLeft: contributed - fundPaid,
    reserve: contributed - budget,
  };

  // Everyone settles with the fund only: one transfer per person.
  const done = now >= trip.end.getTime();
  const settlement = done
    ? list
      .filter((person) => person.balance !== 0)
      .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
      .map(({ name, balance }) => ({
        name,
        amount: Math.abs(balance),
        direction: balance > 0 ? 'refund' : 'topup',
        text: balance > 0
          ? `→ Quỹ hoàn ${name} ${formatShort(balance)}`
          : `→ ${name} nộp thêm vào quỹ ${formatShort(-balance)}`,
      }))
    : null;

  return { totals, days, shared, unmatched, byId, people: list, contributions, entries, warnings, excluded, done, settlement };
}

export function describeBucket({ budget, actual }, memberCount) {
  if (actual === 0) {
    if (budget === null) return { icon: '💰', text: 'Chưa chi', diff: null, tone: 'muted' };
    if (budget === 0) return { icon: '🆓', text: 'Miễn phí', diff: null, tone: 'muted' };
    const each = formatShort(Math.round(budget / memberCount));
    return { icon: '💰', text: `Dự kiến ${formatShort(budget)} · ${each}/người`, diff: null, tone: 'muted' };
  }
  if (budget === null) return { icon: '💰', text: formatShort(actual), diff: null, tone: '' };
  if (budget === 0) return { icon: '💰', text: `${formatShort(actual)} · ngoài dự kiến`, diff: null, tone: 'over' };
  const diff = formatDiff(actual, budget);
  return { icon: '💰', text: `${formatShort(actual)} / ${formatShort(budget)}`, diff: diff.text, tone: diff.tone };
}

export function describeEntry(entry, members) {
  let payer = `${entry.payer} trả ⚠️`;
  if (entry.payer === FUND_PAYER) payer = 'Quỹ trả';
  else if (members.includes(entry.payer)) payer = `${entry.payer} ứng`;

  const split = entry.splitFor.length === members.length
    ? `chia ${members.length}`
    : `chia ${entry.splitFor.join(', ')}`;

  return {
    amount: formatFull(entry.amount),
    payer,
    detail: [entry.note, split].filter(Boolean).join(' · '),
    meta: [entry.enteredBy ? `${entry.enteredBy} nhập` : '', entry.time].filter(Boolean).join(' · '),
  };
}

export function progressOf(actual, budget) {
  const ratio = budget > 0 ? Math.min(actual / budget, 1) : Number(actual > 0);
  return { ratio, over: actual > budget };
}

export function describeDay({ budget, actual, extra }) {
  const extraText = extra > 0 ? ` · phát sinh ${formatShort(extra)}` : '';
  return { text: `💰 ${formatShort(actual)} / ${formatShort(budget)}${extraText}`, ...progressOf(actual, budget) };
}

// A pre-filled Google Form link: the place question already answered.
export function formUrl(fund, label) {
  if (!fund.form) return null;
  if (!label || !fund.form.placeField) return fund.form.url;
  const url = new URL(fund.form.url);
  url.searchParams.set('usp', 'pp_url');
  url.searchParams.set(fund.form.placeField, label);
  return url.toString();
}

// People usually pay on the way out, so between two slots the one that just
// ended is the likelier place for a new expense.
export function placeLabelAt(trip, now) {
  if (now < trip.start.getTime() || now >= trip.end.getTime()) return null;
  const current = trip.items.find((item) => now >= item.start.getTime() && now < item.end.getTime());
  const previous = trip.items.filter((item) => now >= item.end.getTime()).at(-1);
  return (current ?? previous)?.formLabel ?? null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — every file, including 17 tests in `tests/fund.test.js`.

- [ ] **Step 5: Commit**

```bash
git add js/model/fund.js tests/fund.test.js
git commit -m "feat: build the fund ledger from sheet rows"
```

---
### Task 6: Browser verification harness (written before the UI)

**Files:**
- Create (scratchpad only, not committed): `<scratchpad>/verify/verify-fund.mjs`

**Interfaces:**
- Consumes: page served at `http://127.0.0.1:4173/`; Chrome at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`; real `data/trip.json` from Task 4.
- Produces: `node <scratchpad>/verify/verify-fund.mjs <baseUrl> <outDir>` printing `PASS`/`FAIL` lines, screenshots in `<outDir>`, exit code 1 on any failure. Tasks 7 and 8 run it as their "test".
- DOM contract the checks rely on (Tasks 7–8 must produce exactly this):
  - tabs: `[data-tab="fund"]` with text `💰 Quỹ`; panel `#panel-fund` with `data-day="fund"`
  - card chip: `details[data-money="<item id>"]` containing `.money-text`, optional `.money-diff`, class `money is-<tone>`; its body has `a.fund-btn` when a form exists
  - day: `[data-day-money="<day id>"] .day-money-text`; `[data-extra="<day id>"] .extra-title`
  - status: `.fund-status .fund-status-text`, `.fund-status a.fund-btn`
  - fund panel: `.fund-meta-text`, `[data-action="refresh"]`, `.fund-tile b` (4 tiles), `.fund-h` section titles, `.fund-settle tbody tr td:last-child`, `.fund-settlement li`, `details[data-key="entries"]`, `.load-error strong` + `.load-error p`

- [ ] **Step 1: Start a local server (leave it running for Tasks 6–10)**

Run in the background from the repo root:

```bash
python3 -m http.server 4173 --bind 127.0.0.1
```

Check: `curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4173/data/trip.json` → `200`.

- [ ] **Step 2: Write `verify-fund.mjs`**

```js
// node verify-fund.mjs <baseUrl> <outDir>
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const [BASE = 'http://127.0.0.1:4173/', OUT = './out'] = process.argv.slice(2);
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9334;
mkdirSync(OUT, { recursive: true });

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${OUT}/profile`,
  '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', 'about:blank',
], { stdio: 'ignore' });

const IPHONE = { width: 390, height: 844, dpr: 3, mobile: true };
const DESKTOP = { width: 1440, height: 900, dpr: 2, mobile: false };
const DURING = '?now=2026-10-16T15:00:00%2B07:00';
const AFTER = '?now=2026-10-19T00:00:00%2B07:00';

const LINKS = {
  csv: {
    expenses: 'https://docs.google.com/spreadsheets/d/e/TEST/pub?gid=1&single=true&output=csv',
    contributions: 'https://docs.google.com/spreadsheets/d/e/TEST/pub?gid=2&single=true&output=csv',
  },
  form: { url: 'https://docs.google.com/forms/d/e/TEST/viewform', placeField: 'entry.111' },
  sheet: 'https://docs.google.com/spreadsheets/d/TEST/edit',
};

const EXPENSES = [
  'Dấu thời gian,Người nhập,Địa điểm,Số tiền,Ai trả,Chia cho,Ghi chú',
  '01/10/2026 21:00:00,Hữu,Chung · Khách sạn,1080000,Hữu,,Đặt 2 đêm',
  '05/10/2026 10:00:00,MiMi,Chung · Vé xe 2 chiều,2800000,Quỹ,,4 vé',
  '16/10/2026 8:50:00,Khanh,"Day 1 · Đồi chè Cầu Đất — Săn mây, ăn sáng, cà phê",300000,Quỹ,,Vé + ăn sáng',
  '16/10/2026 10:40:00,MiMi,Day 1 · Hidden Land,260000,Quỹ,,4 nước + bánh',
  '16/10/2026 12:20:00,Khanh,Day 1 · Gà nướng + Cơm lam,540000,Khanh,,',
  '16/10/2026 13:10:00,Trâm,Day 1 · Phát sinh,120000,Quỹ,,Áo mưa x4',
  '16/10/2026 14:00:00,Trâm,Day 1 · Trại Mèo Mướp,440000,Quỹ,,Vé kèm nước',
].join('\n');
const CONTRIBUTIONS = 'Ngày,Người góp,Số tiền,Ghi chú\n10/10,Hữu,3000000,\n10/10,MiMi,3000000,\n11/10,Khanh,3000000,\n11/10,Trâm,3000000,CK';

const linked = (json) => {
  const trip = JSON.parse(json);
  Object.assign(trip.fund, LINKS);
  return JSON.stringify(trip);
};
const withoutFund = (json) => {
  const trip = JSON.parse(json);
  delete trip.fund;
  return JSON.stringify(trip);
};
const sheets = (url) => ({ status: 200, type: 'text/csv', body: url.includes('gid=1') ? EXPENSES : CONTRIBUTIONS });
const notFound = () => ({ status: 404, type: 'text/plain', body: 'Not found' });
const signInPage = () => ({ status: 200, type: 'text/html', body: '<!DOCTYPE html><html><body>Sign in</body></html>' });

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

async function openPage({ width, height, dpr, mobile }, { query = '', reducedMotion = false, rewriteTrip = null, sheet = null, clearStorage = false } = {}) {
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
      const { url } = msg.params.request;
      let reply;
      if (url.includes('trip.json')) {
        const original = await (await fetch(url)).text();
        reply = { status: 200, type: 'application/json', body: rewriteTrip(original) };
      } else {
        reply = sheet(url);
      }
      send('Fetch.fulfillRequest', {
        requestId: msg.params.requestId,
        responseCode: reply.status,
        responseHeaders: [
          { name: 'Content-Type', value: `${reply.type}; charset=utf-8` },
          { name: 'Access-Control-Allow-Origin', value: '*' },
        ],
        body: Buffer.from(reply.body).toString('base64'),
      });
    }
  };

  await send('Network.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dpr, mobile });
  await send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: reducedMotion ? 'reduce' : 'no-preference' }],
  });
  if (clearStorage) await send('Page.addScriptToEvaluateOnNewDocument', { source: 'try { localStorage.clear(); } catch {}' });
  const patterns = [];
  if (rewriteTrip) patterns.push({ urlPattern: '*trip.json*' });
  if (sheet) patterns.push({ urlPattern: '*docs.google.com*' });
  if (patterns.length) await send('Fetch.enable', { patterns });

  await send('Page.navigate', { url: BASE + query });
  await sleep(2500);

  const evaluate = async (expression) => {
    const { result, exceptionDetails } = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
    return result.value;
  };
  const click = async (selector, wait = 700) => { await evaluate(`document.querySelector(${JSON.stringify(selector)})?.click()`); await sleep(wait); };
  const text = (selector) => evaluate(`document.querySelector(${JSON.stringify(selector)})?.textContent ?? null`);
  const texts = (selector) => evaluate(`[...document.querySelectorAll(${JSON.stringify(selector)})].map((el) => el.textContent)`);
  const screenshot = async (file) => {
    const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    writeFileSync(`${OUT}/${file}`, Buffer.from(data, 'base64'));
  };
  const close = async () => { ws.close(); await fetch(`http://127.0.0.1:${PORT}/json/close/${target.id}`); };

  return { evaluate, click, text, texts, screenshot, requests, close };
}

const NO_OVERFLOW = 'document.documentElement.scrollWidth === document.documentElement.clientWidth';
const chip = (id) => `(() => {
  const el = document.querySelector('[data-money="${id}"]');
  return el && { text: el.querySelector('.money-text')?.textContent ?? null, diff: el.querySelector('.money-diff')?.textContent ?? null, cls: el.className };
})()`;
const placeOf = (selector) => `(() => {
  const link = document.querySelector(${JSON.stringify(selector)});
  if (!link) return null;
  link.addEventListener('click', (event) => event.preventDefault());
  link.click();
  return new URL(link.href).searchParams.get('entry.111');
})()`;

await waitForChrome();

// 1. Linked, iPhone, afternoon of Day 1
{
  const page = await openPage(IPHONE, { query: DURING, rewriteTrip: linked, sheet: sheets, clearStorage: true });
  const tabs = await page.texts('[role=tab]');
  check('linked: 5 tabs, last is Quỹ', tabs.length === 5 && tabs.at(-1) === '💰 Quỹ', tabs);
  check('linked: reveal targets unchanged (3 heads + 21 items)', (await page.evaluate(`document.querySelectorAll('.reveal').length`)) === 24);

  const hidden = await page.evaluate(chip('day-1-item-2'));
  check('linked: Hidden Land chip', hidden?.text === '💰 260k / 200k' && hidden.diff === '▲ 60k' && hidden.cls.includes('is-over'), hidden);
  const free = await page.evaluate(chip('day-1-item-6'));
  check('linked: free slot chip', free?.text === '🆓 Miễn phí' && free.cls.includes('is-muted'), free);
  const goHome = await page.evaluate(chip('day-3-item-4'));
  check('linked: no-budget slot chip', goHome?.text === '💰 Chưa chi', goHome);
  const cat = await page.evaluate(chip('day-1-item-4'));
  check('linked: on-budget chip', cat?.text === '💰 440k / 440k' && cat.diff === '✓', cat);

  const dayMoney = await page.text('[data-day-money="day-1"] .day-money-text');
  check('linked: day 1 total', dayMoney === '💰 1.660k / 3.120k · phát sinh 120k', dayMoney);
  const extra = await page.text('[data-extra="day-1"] .extra-title');
  check('linked: day 1 extras', extra === '⚡ Phát sinh ngoài plan · 120k', extra);
  const extra2 = await page.text('[data-extra="day-2"] .extra-title');
  check('linked: day 2 no extras', extra2 === '⚡ Phát sinh · 0', extra2);
  const status = await page.text('.fund-status .fund-status-text');
  check('linked: status row', status === '💰 Quỹ còn 8.080k', status);

  const cardPlace = await page.evaluate(placeOf('[data-money="day-1-item-2"] .fund-btn'));
  check('linked: card link pre-fills its place', cardPlace === 'Day 1 · Hidden Land', cardPlace);
  const extraPlace = await page.evaluate(placeOf('[data-extra="day-1"] .fund-btn'));
  check('linked: extras link pre-fills the day bucket', extraPlace === 'Day 1 · Phát sinh', extraPlace);
  const statusPlace = await page.evaluate(placeOf('.fund-status .fund-btn'));
  check('linked: status link pre-fills the slot in progress', statusPlace === 'Day 1 · Phong Miên quán — Forest slow café', statusPlace);

  await page.click('[data-tab="all"]');
  const shown = await page.evaluate(`[...document.querySelectorAll('.panel')].filter((p) => !p.hidden).map((p) => p.dataset.day)`);
  check('linked: "Tất cả" shows days only', JSON.stringify(shown) === '["day-1","day-2","day-3"]', shown);
  await page.screenshot('iphone-days.png');

  await page.evaluate(`{ const el = document.querySelector('[data-money="day-1-item-2"]'); if (el) el.open = true; }`);
  await page.click('[data-tab="fund"]');
  const fundShown = await page.evaluate(`[...document.querySelectorAll('.panel')].filter((p) => !p.hidden).map((p) => p.dataset.day)`);
  check('linked: fund tab shows only the fund panel', JSON.stringify(fundShown) === '["fund"]', fundShown);
  const tiles = await page.texts('.fund-tile b');
  check('linked: overview tiles', JSON.stringify(tiles) === '["12.000k","5.540k","8.080k","640k"]', tiles);
  const headings = await page.texts('.fund-h');
  check('linked: settlement is provisional', headings.includes('Quyết toán · tạm tính'), headings);
  check('linked: no final transfers during the trip', (await page.evaluate(`document.querySelectorAll('.fund-settlement').length`)) === 0);
  const balances = await page.texts('.fund-settle tbody tr td:last-child');
  check('linked: balances', JSON.stringify(balances) === '["+2.695k","+1.615k","+2.155k","+1.615k"]', balances);
  check('linked: no overflow on fund tab', await page.evaluate(NO_OVERFLOW));
  await page.screenshot('iphone-fund.png');

  await page.evaluate(`{ const el = document.querySelector('details[data-key="entries"]'); if (el) el.open = true; }`);
  await page.click('[data-action="refresh"]', 1500);
  const kept = await page.evaluate(`({
    card: document.querySelector('[data-money="day-1-item-2"]')?.open,
    entries: document.querySelector('details[data-key="entries"]')?.open,
    meta: document.querySelector('.fund-meta-text')?.textContent,
  })`);
  check('linked: refresh keeps open details', kept.card === true && kept.entries === true, kept);
  check('linked: meta shows update time', /^Cập nhật \d{2}:\d{2}$/.test(kept.meta ?? ''), kept.meta);
  await page.close();
}

// 2. Narrow phone, fund tab
{
  const page = await openPage({ ...IPHONE, width: 360 }, { query: DURING, rewriteTrip: linked, sheet: sheets });
  await page.click('[data-tab="fund"]');
  check('360px: no overflow on fund tab', await page.evaluate(NO_OVERFLOW));
  await page.screenshot('iphone360-fund.png');
  await page.close();
}

// 3. After the trip: final transfers
{
  const page = await openPage(IPHONE, { query: AFTER, rewriteTrip: linked, sheet: sheets });
  await page.click('[data-tab="fund"]');
  const headings = await page.texts('.fund-h');
  check('after: settlement is final', headings.includes('Quyết toán') && !headings.includes('Quyết toán · tạm tính'), headings);
  const lines = await page.texts('.fund-settlement li');
  check('after: transfers largest first', lines[0] === '→ Quỹ hoàn Hữu 2.695k' && lines.length === 4, lines);
  await page.close();
}

// 4. Sheet unreachable, nothing cached
{
  const page = await openPage(IPHONE, { query: DURING, rewriteTrip: linked, sheet: notFound, clearStorage: true });
  check('404: schedule still renders', (await page.evaluate(`document.querySelectorAll('.item').length`)) === 21);
  const hidden = await page.evaluate(chip('day-1-item-2'));
  check('404: chips show a dash', hidden?.text === '💰 —', hidden);
  check('404: status row says so', (await page.text('.fund-status-text')) === '💰 Không tải được quỹ');
  await page.click('[data-tab="fund"]');
  const error = await page.evaluate(`({ title: document.querySelector('#panel-fund .load-error strong')?.textContent, detail: document.querySelector('#panel-fund .load-error p')?.textContent })`);
  check('404: fund panel error', error.title === 'Không tải được sổ quỹ' && error.detail === 'HTTP 404', error);
  await page.close();
}

// 5. Sheet unreachable after a good load: cached copy
{
  const good = await openPage(IPHONE, { query: DURING, rewriteTrip: linked, sheet: sheets, clearStorage: true });
  await good.close();
  const page = await openPage(IPHONE, { query: DURING, rewriteTrip: linked, sheet: notFound });
  const hidden = await page.evaluate(chip('day-1-item-2'));
  check('cache: chips keep last numbers', hidden?.text === '💰 260k / 200k', hidden);
  await page.click('[data-tab="fund"]');
  const meta = await page.text('.fund-meta-text');
  check('cache: meta says the copy is old', /^Dữ liệu lúc \d{2}:\d{2} · chưa tải được bản mới$/.test(meta ?? ''), meta);
  await page.close();
}

// 6. Sheet not published (HTML answer)
{
  const page = await openPage(IPHONE, { query: DURING, rewriteTrip: linked, sheet: signInPage, clearStorage: true });
  await page.click('[data-tab="fund"]');
  const detail = await page.text('#panel-fund .load-error p');
  check('html: unpublished sheet message', detail === 'Sheet chưa publish dạng CSV', detail);
  await page.close();
}

// 7. Fund without links (data as committed before Task 10)
{
  const page = await openPage(IPHONE, { query: DURING, rewriteTrip: (json) => json });
  const hidden = await page.evaluate(chip('day-1-item-2'));
  check('unlinked: chip shows the budget', hidden?.text === '💰 Dự kiến 200k · 50k/người', hidden);
  check('unlinked: status shows the plan total', (await page.text('.fund-status-text')) === '💰 Dự kiến 11.360k');
  check('unlinked: no form buttons', (await page.evaluate(`document.querySelectorAll('.fund-btn').length`)) === 0);
  await page.click('[data-tab="fund"]');
  check('unlinked: meta', (await page.text('.fund-meta-text')) === 'Chưa kết nối Google Sheet');
  check('unlinked: no requests to Google', !page.requests.some((url) => url.includes('docs.google.com')), page.requests.filter((url) => url.includes('google')));
  await page.close();
}

// 8. No fund at all: page as before
{
  const page = await openPage(IPHONE, { rewriteTrip: withoutFund });
  check('no fund: 4 tabs', (await page.evaluate(`document.querySelectorAll('[role=tab]').length`)) === 4);
  const leftovers = await page.evaluate(`document.querySelectorAll('[data-money], [data-day-money], [data-extra], .fund-status, #panel-fund').length`);
  check('no fund: no money UI', leftovers === 0, leftovers);
  check('no fund: no overflow', await page.evaluate(NO_OVERFLOW));
  await page.close();
}

// 9. Desktop
{
  const page = await openPage(DESKTOP, { query: DURING, rewriteTrip: linked, sheet: sheets });
  check('desktop: no overflow', await page.evaluate(NO_OVERFLOW));
  await page.click('[data-tab="fund"]');
  await page.screenshot('desktop-fund.png');
  await page.close();
}

// 10. Reduced motion: switching to the fund tab starts no animation
{
  const page = await openPage(IPHONE, { query: DURING, rewriteTrip: linked, sheet: sheets, reducedMotion: true });
  await page.click('[data-tab="fund"]');
  const animations = await page.evaluate(`document.getAnimations().filter((a) => !a.effect?.target?.closest?.('.countdown')).length`);
  check('reduced: no page animations', animations === 0, animations);
  await page.close();
}

chrome.kill();
console.log(failures.length ? `\n${failures.length} FAILED: ${failures.join(', ')}` : '\nALL PASS');
process.exit(failures.length ? 1 : 0);
```

- [ ] **Step 3: Run it to see the expected failures**

```bash
node <scratchpad>/verify/verify-fund.mjs http://127.0.0.1:4173/ <scratchpad>/verify/out
```

Expected before Task 7: the `no fund: …` checks and `linked: reveal targets unchanged` PASS; every other check FAILs (no fund tab, no chips). The script must not crash — a thrown error means a harness bug; fix the harness, not the page.

No commit (scratchpad file).

---
### Task 7: Fund UI — tabs, day slots, fund view, styles, wiring

**Files:**
- Modify: `js/views/tabs.js`, `js/controllers/tabs.js`, `js/views/day.js`, `js/main.js`, `css/tokens.css`, `index.html`
- Create: `js/views/fund.js`, `css/fund.css`, `js/controllers/fund.js` (budget-only version; Task 8 replaces it)
- Test: `<scratchpad>/verify/verify-fund.mjs` (Task 6)

**Interfaces:**
- Consumes: `buildLedger`, `describeBucket`, `describeEntry`, `describeDay`, `progressOf`, `formUrl`, `placeLabelAt` (Task 5); `formatShort`, `formatFull`, `formatBalance` (Task 2); `h` from `js/lib/dom.js`; `createClock` from `js/lib/clock.js`.
- Produces:
  - `js/views/tabs.js`: `export const FUND_TAB = 'fund'`; `renderTabs(days, { fund = false } = {})`
  - `js/views/day.js`: `renderDay(day, { fund = false } = {})`
  - `js/views/fund.js`: `moneySlot(id)`, `dayMoneySlot(day)`, `extraSlot(day)`, `createFundView({ trip, clock }) → { panel, statusRow, update(ledger, meta), fail(message), onRefresh(handler) }` where `meta = { state: 'fresh' | 'cached' | 'stale' | 'unlinked', fetchedAt?: number }`
  - `js/controllers/fund.js`: `startFund({ trip, view, clock })`
  - The DOM contract listed in Task 6.

- [ ] **Step 1: Tabs — add the fund tab**

`js/views/tabs.js` becomes:

```js
import { h } from '../lib/dom.js';

export const ALL_TAB = 'all';
export const FUND_TAB = 'fund';

export function renderTabs(days, { fund = false } = {}) {
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
        days.map((day) => tab(day.id, day.label, panelId(day))),
        fund ? tab(FUND_TAB, '💰 Quỹ', `panel-${FUND_TAB}`) : null)));
}
```

In `js/controllers/tabs.js`, change the import and the panel loop inside `select()`:

```js
import { ALL_TAB, FUND_TAB } from '../views/tabs.js';
```

```js
    for (const panel of panels) {
      // "Tất cả" means every day; the fund panel only shows on its own tab.
      panel.hidden = active.dataset.tab === ALL_TAB
        ? panel.dataset.day === FUND_TAB
        : panel.dataset.day !== active.dataset.tab;
    }
```

- [ ] **Step 2: Day view — placeholders**

`js/views/day.js` becomes:

```js
import { h } from '../lib/dom.js';
import { moneySlot, dayMoneySlot, extraSlot } from './fund.js';

const join = (separator, ...parts) => parts.filter(Boolean).join(separator);

// With a fund, each card, the day head and the end of the day get empty slots
// that the fund view fills once the sheets are read.
export function renderDay(day, { fund = false } = {}) {
  return h('section', {
    class: 'panel',
    id: `panel-${day.id}`,
    role: 'tabpanel',
    'aria-labelledby': `tab-${day.id}`,
    dataset: { day: day.id },
  },
  h('article', { class: 'day' },
    h('div', { class: 'day-head' },
      h('div', { class: fund ? 'day-info' : null },
        h('h2', { class: 'day-title', text: join(' ', day.icon, day.label) }),
        h('div', { class: 'day-date', text: join(' · ', day.dateText, day.rangeText, day.note) }),
        fund ? dayMoneySlot(day) : null),
      h('div', { class: 'day-count', text: day.countText })),
    // Animation CSS relies on this shape: .day-head right before .timeline,
    // and every .item a direct child of .timeline.
    h('div', { class: 'timeline' }, day.items.map((item) => renderItem(item, fund))),
    fund ? extraSlot(day) : null));
}

function renderItem(item, fund) {
  return h('div', { class: 'item', dataset: { id: item.id }, style: { '--i': String(item.order) } },
    h('span', { class: 'dot' }),
    h('div', { class: 'time' },
      h('span', { class: 'clock' },
        h('b', { class: 'clock-start', text: item.startText }),
        h('span', { class: 'clock-end', text: `– ${item.endText}` })),
      h('span', { class: 'period', text: item.period })),
    renderCard(item, fund));
}

function renderCard(item, fund) {
  const hasFooter = !item.empty && Boolean(item.tag || item.mapUrl);
  return h('div', { class: item.empty ? 'card empty' : 'card' },
    item.icon ? h('span', { class: 'card-icon', 'aria-hidden': 'true', text: item.icon }) : null,
    h('div', { class: 'card-body' },
      h('h3', { class: 'card-title', text: item.name }),
      item.detail ? h('p', { class: 'card-detail', text: item.detail }) : null,
      hasFooter
        ? h('div', { class: 'card-footer' },
          item.tag ? h('span', { class: 'tag', dataset: { tag: item.tagKey }, text: item.tag }) : null,
          item.mapUrl
            ? h('a', { class: 'map-btn', href: item.mapUrl, target: '_blank', rel: 'noopener noreferrer' }, '📍 Maps')
            : null)
        : null,
      fund ? moneySlot(item.id) : null));
}
```

- [ ] **Step 3: Fund view**

`js/views/fund.js`:

```js
import { h } from '../lib/dom.js';
import { formatShort, formatFull, formatBalance } from '../lib/money.js';
import {
  describeBucket, describeEntry, describeDay, progressOf, formUrl, placeLabelAt,
} from '../model/fund.js';
import { FUND_TAB } from './tabs.js';

const LINK = { target: '_blank', rel: 'noopener noreferrer' };

// ---------- Slots the day view places; filled by createFundView ----------

export function moneySlot(id) {
  return h('details', { class: 'money is-muted', dataset: { money: id } },
    h('summary', { class: 'money-sum' }, h('span', { class: 'money-text', text: '💰 …' })),
    h('div', { class: 'money-body' }, h('p', { class: 'entries-empty', text: 'Đang tải…' })));
}

export function dayMoneySlot(day) {
  return h('div', { class: 'day-money', dataset: { dayMoney: day.id } });
}

export function extraSlot(day) {
  return h('section', { class: 'extra', dataset: { extra: day.id }, hidden: true });
}

// ---------- The view ----------

export function createFundView({ trip, clock }) {
  const { fund } = trip;
  const ctx = { fund, members: fund.members };
  let refresh = () => {};

  const statusText = h('span', { class: 'fund-status-text', text: '💰 Quỹ …' });
  const statusLink = addLink(fund, null, '➕ Nhập chi');
  // Worked out on tap, so the pre-filled place follows the clock.
  statusLink?.addEventListener('click', () => {
    statusLink.href = formUrl(fund, placeLabelAt(trip, clock()));
  });
  const statusRow = h('div', { class: 'fund-status' }, statusText, statusLink);

  const panel = h('section', {
    class: 'panel fund-panel',
    id: `panel-${FUND_TAB}`,
    role: 'tabpanel',
    'aria-labelledby': `tab-${FUND_TAB}`,
    dataset: { day: FUND_TAB },
  });
  panel.addEventListener('click', (event) => {
    if (event.target.closest('[data-action="refresh"]')) refresh();
  });

  const scope = () => panel.closest('main') ?? document;

  function update(ledger, meta) {
    const root = scope();
    for (const el of root.querySelectorAll('.day [data-money]')) {
      fillMoney(el, ledger.byId.get(el.dataset.money), ctx);
    }
    for (const day of ledger.days) {
      fillDay(root.querySelector(`[data-day-money="${day.id}"]`), day);
      fillExtra(root.querySelector(`[data-extra="${day.id}"]`), day.extraBucket, ctx);
    }
    statusText.textContent = meta.state === 'unlinked'
      ? `💰 Dự kiến ${formatShort(ledger.totals.budget)}`
      : `💰 Quỹ còn ${formatShort(ledger.totals.fundLeft)}`;
    renderPanel(ledger, meta);
  }

  function fail(message) {
    for (const el of scope().querySelectorAll('.day [data-money]')) {
      el.className = 'money is-muted';
      el.querySelector('.money-sum').replaceChildren(h('span', { class: 'money-text', text: '💰 —' }));
      el.querySelector('.money-body').replaceChildren(h('p', { class: 'entries-empty', text: 'Không tải được sổ quỹ' }));
    }
    statusText.textContent = '💰 Không tải được quỹ';
    panel.replaceChildren(h('article', { class: 'fund' },
      renderHead('Chưa có dữ liệu', true),
      h('div', { class: 'load-error', role: 'alert' },
        h('strong', { text: 'Không tải được sổ quỹ' }),
        h('p', { text: message }),
        h('button', { class: 'fund-btn', type: 'button', dataset: { action: 'refresh' } }, 'Thử lại'))));
  }

  // The panel is rebuilt on every refresh; <details> people opened stay open.
  function renderPanel(ledger, meta) {
    const detailsKey = (el) => el.dataset.key ?? el.dataset.money;
    const open = new Set([...panel.querySelectorAll('details[open]')].map(detailsKey));
    const { totals } = ledger;

    panel.replaceChildren(h('article', { class: 'fund' },
      renderHead(metaText(meta), meta.state !== 'unlinked'),
      ledger.warnings.length > 0 ? renderWarnings(ledger.warnings) : null,
      renderOverview(totals),
      renderByDay(ledger),
      renderShared(ledger, ctx),
      ledger.unmatched.entries.length > 0
        ? section('Không khớp địa điểm',
          details('unmatched', `⚠️ ${ledger.unmatched.entries.length} khoản · ${formatShort(ledger.unmatched.actual)}`,
            renderEntries(ledger.unmatched.entries, ctx, { withLabel: true })))
        : null,
      renderSettlement(ledger),
      section('Sổ sách',
        details('contributions', `Sổ góp quỹ · ${ledger.contributions.length} khoản · ${formatShort(totals.contributed)}`,
          renderContributions(ledger.contributions)),
        details('entries', `Sổ chi · ${ledger.entries.length} khoản · ${formatShort(totals.actual)}`,
          renderEntries(ledger.entries, ctx, { withLabel: true }))),
      h('div', { class: 'fund-actions' },
        addLink(fund, null, '➕ Nhập chi tiêu'),
        fund.sheet ? h('a', { class: 'fund-btn is-ghost', href: fund.sheet, ...LINK }, '📄 Mở Google Sheet') : null)));

    for (const el of panel.querySelectorAll('details')) {
      if (open.has(detailsKey(el))) el.open = true;
    }
  }

  return {
    panel,
    statusRow,
    update,
    fail,
    onRefresh(handler) {
      refresh = handler;
    },
  };
}

// ---------- Pieces ----------

const clockText = (ms) => new Date(ms).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

function metaText(meta) {
  if (meta.state === 'unlinked') return 'Chưa kết nối Google Sheet';
  if (meta.state === 'cached') return `Dữ liệu lúc ${clockText(meta.fetchedAt)} · đang tải bản mới`;
  if (meta.state === 'stale') return `Dữ liệu lúc ${clockText(meta.fetchedAt)} · chưa tải được bản mới`;
  return `Cập nhật ${clockText(meta.fetchedAt)}`;
}

function addLink(fund, label, text) {
  const href = formUrl(fund, label);
  return href ? h('a', { class: 'fund-btn', href, ...LINK }, text) : null;
}

function section(title, ...children) {
  return h('section', { class: 'fund-section' }, h('h3', { class: 'fund-h', text: title }), children);
}

function details(key, summary, body) {
  return h('details', { class: 'fund-details', dataset: { key } }, h('summary', { text: summary }), body);
}

function progressBar({ ratio, over }) {
  return h('div', { class: over ? 'bar is-over' : 'bar', 'aria-hidden': 'true' },
    h('span', { style: { '--ratio': String(ratio) } }));
}

function renderHead(text, canRefresh) {
  return h('header', { class: 'fund-head' },
    h('h2', { class: 'fund-title', text: '💰 Quỹ chuyến đi' }),
    h('div', { class: 'fund-meta' },
      h('span', { class: 'fund-meta-text', text }),
      canRefresh
        ? h('button', { class: 'fund-refresh', type: 'button', 'aria-label': 'Tải lại', dataset: { action: 'refresh' } }, '↻')
        : null));
}

function fillMoney(el, bucket, ctx, { title = null, note = '' } = {}) {
  const view = describeBucket(bucket, ctx.members.length);
  el.className = view.tone ? `money is-${view.tone}` : 'money';
  el.querySelector('.money-sum').replaceChildren(
    title ? h('span', { class: 'money-title', text: title }) : null,
    h('span', { class: 'money-text', text: title ? view.text : `${view.icon} ${view.text}` }),
    view.diff ? h('span', { class: 'money-diff', text: view.diff }) : null);
  el.querySelector('.money-body').replaceChildren(
    note ? h('p', { class: 'money-note', text: note }) : null,
    renderEntries(bucket.entries, ctx),
    addLink(ctx.fund, bucket.label, '➕ Nhập chi ở đây'));
}

function fillDay(el, day) {
  const view = describeDay(day);
  el.replaceChildren(h('div', { class: 'day-money-text', text: view.text }), progressBar(view));
}

function fillExtra(el, bucket, ctx) {
  el.hidden = false;
  el.replaceChildren(
    h('h3', {
      class: 'extra-title',
      text: bucket.actual > 0 ? `⚡ Phát sinh ngoài plan · ${formatShort(bucket.actual)}` : '⚡ Phát sinh · 0',
    }),
    bucket.entries.length > 0 ? renderEntries(bucket.entries, ctx) : null,
    addLink(ctx.fund, bucket.label, '➕ Nhập phát sinh'));
}

function renderEntries(entries, ctx, { withLabel = false } = {}) {
  if (entries.length === 0) return h('p', { class: 'entries-empty', text: 'Chưa có khoản chi' });
  return h('ul', { class: 'entries' }, entries.map((entry) => {
    const view = describeEntry(entry, ctx.members);
    return h('li', { class: entry.settled ? 'entry' : 'entry is-warn' },
      withLabel ? h('div', { class: 'entry-label', text: entry.label }) : null,
      h('div', { class: 'entry-top' }, h('b', { text: view.amount }), h('span', { text: view.payer })),
      view.detail ? h('div', { class: 'entry-detail', text: view.detail }) : null,
      view.meta ? h('div', { class: 'entry-meta', text: view.meta }) : null);
  }));
}

function renderContributions(contributions) {
  if (contributions.length === 0) return h('p', { class: 'entries-empty', text: 'Chưa có khoản góp' });
  return h('ul', { class: 'entries' }, contributions.map((line) => h('li', { class: 'entry' },
    h('div', { class: 'entry-top' }, h('b', { text: formatFull(line.amount) }), h('span', { text: line.member })),
    line.date || line.note
      ? h('div', { class: 'entry-meta', text: [line.date, line.note].filter(Boolean).join(' · ') })
      : null)));
}

function renderWarnings(warnings) {
  return h('div', { class: 'fund-warn', role: 'status' },
    h('strong', { text: `⚠️ ${warnings.length} dòng cần sửa` }),
    h('ul', {}, warnings.map((text) => h('li', { text }))));
}

function renderOverview(totals) {
  const tile = (label, value) => h('div', { class: 'fund-tile' }, h('span', { text: label }), h('b', { text: value }));
  return h('section', { class: 'fund-section' },
    h('div', { class: 'fund-tiles' },
      tile('Đã góp', formatShort(totals.contributed)),
      tile('Đã chi', formatShort(totals.actual)),
      tile('Quỹ còn', formatShort(totals.fundLeft)),
      totals.reserve >= 0
        ? tile('Dự phòng', formatShort(totals.reserve))
        : tile('Chưa góp đủ', `thiếu ${formatShort(-totals.reserve)}`)),
    h('div', { class: 'fund-progress' },
      h('span', { text: 'Thực chi / dự kiến' }),
      h('span', { text: `${formatShort(totals.actual)} / ${formatShort(totals.budget)}` })),
    progressBar(progressOf(totals.actual, totals.budget)));
}

function table(headings, bodyRows, footRow, className = 'fund-table') {
  return h('div', { class: 'fund-table-wrap' },
    h('table', { class: className },
      h('thead', {}, h('tr', {}, headings.map((text) => h('th', { scope: 'col', text })))),
      h('tbody', {}, bodyRows),
      h('tfoot', {}, footRow)));
}

function renderByDay(ledger) {
  const row = (label, values) => h('tr', {},
    h('th', { scope: 'row', text: label }),
    values.map((value) => h('td', { text: formatShort(value) })));
  const { shared, unmatched, totals } = ledger;
  return section('Theo ngày', table(
    ['', 'Dự kiến', 'Thực chi', 'Phát sinh'],
    [
      row('Chung', [shared.budget, shared.actual, shared.extra]),
      ledger.days.map((day) => row(day.label, [day.budget, day.actual, day.extra])),
      unmatched.actual > 0 ? row('Không khớp', [0, unmatched.actual, 0]) : null,
    ],
    row('Tổng', [totals.budget, totals.actual, totals.extra])));
}

function renderShared(ledger, ctx) {
  const { fund } = ctx;
  const rows = [
    ...fund.shared.map((cost) => ({ id: cost.id, title: `${cost.icon} ${cost.title}`.trim(), note: cost.note })),
    { id: fund.sharedExtra.id, title: `${fund.sharedExtra.icon} ${fund.sharedExtra.title}`, note: '' },
  ];
  return section('Chi phí chung', rows.map(({ id, title, note }) => {
    const el = moneySlot(id);
    fillMoney(el, ledger.byId.get(id), ctx, { title, note });
    return el;
  }));
}

function renderSettlement(ledger) {
  const balanceClass = (balance) => {
    if (balance < 0) return 'is-over';
    return balance > 0 ? 'is-under' : null;
  };
  const rows = ledger.people.map((person) => h('tr', {},
    h('th', { scope: 'row', text: person.name }),
    h('td', { text: formatShort(person.contributed) }),
    h('td', { text: formatShort(person.advanced) }),
    h('td', { text: formatShort(person.share) }),
    h('td', { class: balanceClass(person.balance), text: formatBalance(person.balance) })));
  const foot = h('tr', {}, h('td', { colspan: '5', text: `Quỹ còn ${formatShort(ledger.totals.fundLeft)}` }));

  return section(ledger.done ? 'Quyết toán' : 'Quyết toán · tạm tính',
    ledger.excluded > 0
      ? h('p', { class: 'fund-warn-line', text: `⚠️ Có ${ledger.excluded} dòng cần sửa — số liệu chưa chốt` })
      : null,
    table(['', 'Góp', 'Ứng', 'Chịu', 'Còn lại'], rows, foot, 'fund-table fund-settle'),
    ledger.settlement
      ? h('div', { class: 'fund-settlement' },
        h('h4', { text: 'Chốt quỹ' }),
        ledger.settlement.length > 0
          ? h('ul', {}, ledger.settlement.map((line) => h('li', { text: line.text })))
          : h('p', { text: 'Không ai cần chuyển thêm' }))
      : null);
}
```

- [ ] **Step 4: Styles**

In `css/tokens.css`, add inside `:root` after `--empty-ink`:

```css
  /* Money: over budget, within budget, nothing spent yet. Each ≥ 4.5:1 on
     white. */
  --money-over: #b44d28;
  --money-under: #2f7a55;
  --money-muted: #6b746f;
```

In `index.html`, add after the `countdown.css` link:

```html
  <link rel="stylesheet" href="css/fund.css">
```

`css/fund.css`:

```css
/* ---------- MONEY LINE (cards and shared costs) ---------- */
.money {
  margin-top: 8px;
  padding-top: 4px;
  border-top: 1px dashed var(--line);
  font-size: 12.5px;
}

.money-sum {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  list-style: none;
  cursor: pointer;
  font-weight: 700;
  color: var(--text);
  font-variant-numeric: tabular-nums;
  -webkit-tap-highlight-color: transparent;
}

.money-sum::-webkit-details-marker { display: none; }

.money-sum::after {
  content: "▾";
  margin-left: auto;
  font-size: 11px;
  color: var(--text-sub);
}

.money[open] > .money-sum::after { content: "▴"; }

.money-title { flex: 1 1 auto; min-width: 0; }
.money-title + .money-text { font-weight: 600; }
.money-diff { font-size: 11.5px; }

.money.is-muted .money-text { color: var(--money-muted); font-weight: 600; }
.money.is-over .money-text,
.money.is-over .money-diff { color: var(--money-over); }
.money.is-under .money-diff { color: var(--money-under); }

.money-body { padding: 0 0 4px; }
.money-note { margin: 0 0 6px; font-size: 12px; color: var(--text-sub); }

/* ---------- ENTRIES ---------- */
.entries { list-style: none; margin: 0; padding: 0; }

.entry { padding: 8px 0; border-top: 1px solid var(--line); }
.entry:first-child { border-top: 0; }
.entry.is-warn { margin: 0 -8px; padding: 8px; border-radius: 8px; background: #fbf1ef; }

.entry-top {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-size: 13px;
}

.entry-top b { font-variant-numeric: tabular-nums; }
.entry-top span { color: var(--text-sub); font-weight: 600; text-align: right; }
.entry-label { font-size: 11px; font-weight: 700; color: var(--link); }
.entry-detail { font-size: 12.5px; color: var(--text); }
.entry-meta { font-size: 11.5px; color: var(--text-sub); }
.entries-empty { margin: 4px 0; font-size: 12.5px; color: var(--text-sub); }

/* ---------- BUTTONS ---------- */
.fund-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0 14px;
  border: 0;
  border-radius: 10px;
  background: var(--accent-soft);
  color: var(--primary);
  font: inherit;
  font-size: 12.5px;
  font-weight: 700;
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
}

.money-body > .fund-btn,
.extra > .fund-btn {
  display: flex;
  width: fit-content;
  margin: 6px 0 0 auto;
}

.fund-btn.is-ghost { background: transparent; border: 1px solid var(--line); }

.fund-btn:focus-visible,
.fund-refresh:focus-visible,
.money-sum:focus-visible,
.fund-details > summary:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

@media (hover: hover) {
  .fund-btn:hover { background: #dbe8e0; }
  .fund-btn.is-ghost:hover { background: var(--accent-soft); }
}

/* ---------- DAY ---------- */
.day-info { flex: 1 1 14rem; min-width: 0; }
.day-money { margin-top: 6px; }

.day-money-text {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--primary);
  font-variant-numeric: tabular-nums;
}

.bar {
  height: 5px;
  margin-top: 5px;
  overflow: hidden;
  border-radius: 99px;
  background: var(--accent-soft);
}

.bar span {
  display: block;
  height: 100%;
  background: var(--accent);
  transform: scaleX(var(--ratio, 0));
  transform-origin: left center;
}

.bar.is-over span { background: var(--money-over); }

.extra {
  margin-top: 18px;
  padding-top: 12px;
  border-top: 1px dashed var(--line);
}

.extra-title {
  margin: 0 0 6px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .07em;
  text-transform: uppercase;
  color: var(--money-over);
}

.extra .entries {
  padding: 2px 12px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: #fffaf5;
}

/* ---------- STATUS ROW ---------- */
/* A light card under the dark status panel: the panel repaints itself every
   tick, so the fund line lives outside it. */
.fund-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 8px;
  padding: 4px 4px 4px 14px;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 12px;
  box-shadow: var(--shadow-sm);
}

.fund-status-text {
  min-height: 44px;
  display: flex;
  align-items: center;
  font-size: 13px;
  font-weight: 700;
  color: var(--primary);
  font-variant-numeric: tabular-nums;
}

/* ---------- FUND TAB ---------- */
.fund {
  margin-top: 18px;
  padding: 16px;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 14px;
  box-shadow: var(--shadow-md);
}

.fund-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 4px 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--line);
}

.fund-title { margin: 0; font-size: 18px; color: var(--primary); letter-spacing: -.01em; }
.fund-meta { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--text-sub); }

.fund-refresh {
  min-width: 44px;
  min-height: 44px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--link);
  font: inherit;
  font-size: 18px;
  cursor: pointer;
}

.fund-section { margin-top: 18px; }

.fund-h {
  margin: 0 0 8px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .07em;
  text-transform: uppercase;
  color: var(--text-sub);
}

.fund-warn {
  margin-top: 14px;
  padding: 10px 14px;
  border: 1px solid #e6c9c3;
  border-radius: 12px;
  background: #fbf1ef;
  color: #7a3b2e;
  font-size: 12.5px;
}

.fund-warn ul { margin: 6px 0 0; padding-left: 18px; }
.fund-warn-line { margin: 0 0 8px; font-size: 12.5px; color: #7a3b2e; }

.fund-tiles {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.fund-tile { padding: 10px 12px; border-radius: 12px; background: var(--accent-soft); }
.fund-tile span { display: block; font-size: 11px; font-weight: 600; color: var(--text-sub); }
.fund-tile b { font-size: 18px; color: var(--primary); font-variant-numeric: tabular-nums; }

.fund-progress {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-top: 12px;
  font-size: 12px;
  color: var(--text-sub);
  font-variant-numeric: tabular-nums;
}

.fund-table-wrap { overflow-x: auto; }

.fund-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12.5px;
  font-variant-numeric: tabular-nums;
}

.fund-table th,
.fund-table td { padding: 6px 4px; text-align: right; white-space: nowrap; }
.fund-table th[scope="row"],
.fund-table thead th:first-child { text-align: left; }
.fund-table thead th { font-size: 11px; font-weight: 700; color: var(--text-sub); border-bottom: 1px solid var(--line); }
.fund-table tbody tr + tr { border-top: 1px solid var(--line); }
.fund-table tfoot { border-top: 2px solid var(--line); font-weight: 800; }
.fund-settle tfoot td { color: var(--text-sub); font-weight: 700; }
.fund-table .is-over { color: var(--money-over); font-weight: 700; }
.fund-table .is-under { color: var(--money-under); font-weight: 700; }

.fund-settlement { margin-top: 12px; padding: 10px 14px; border-radius: 12px; background: var(--accent-soft); }
.fund-settlement h4 { margin: 0 0 4px; font-size: 13px; color: var(--primary); }
.fund-settlement ul { margin: 0; padding: 0; list-style: none; font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; }
.fund-settlement p { margin: 0; font-size: 13px; }

.fund-section > .money:first-of-type { margin-top: 0; }

.fund-details { border-top: 1px solid var(--line); }

.fund-details > summary {
  display: flex;
  align-items: center;
  min-height: 44px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 700;
  color: var(--primary);
}

.fund-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; }
.fund .load-error { margin-top: 14px; }
.fund .load-error .fund-btn { margin-top: 10px; }

@media (min-width: 761px) {
  .fund { padding: 20px; border-radius: var(--radius); }
  .fund-title { font-size: 20px; }
  .fund-tiles { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .fund-table { font-size: 13.5px; }
}
```

- [ ] **Step 5: Budget-only controller (Task 8 replaces this file)**

`js/controllers/fund.js`:

```js
import { buildLedger } from '../model/fund.js';

// Budgets only: the data has no sheet links yet.
export function startFund({ trip, view, clock }) {
  view.update(buildLedger(trip, { expenses: null, contributions: null }, clock()), { state: 'unlinked' });
}
```

- [ ] **Step 6: Wire it into `js/main.js`**

`js/main.js` becomes:

```js
import { buildTrip } from './model/trip.js';
import { createClock } from './lib/clock.js';
import { h } from './lib/dom.js';
import { renderHero } from './views/hero.js';
import { renderTabs } from './views/tabs.js';
import { renderDay } from './views/day.js';
import { createCountdown } from './views/countdown.js';
import { createFundView } from './views/fund.js';
import { renderFooter } from './views/footer.js';
import { renderError } from './views/error.js';
import { createTabs } from './controllers/tabs.js';
import { startStatus } from './controllers/status.js';
import { startFund } from './controllers/fund.js';
import { startReveal } from './controllers/reveal.js';
import { startScrollFx } from './controllers/scroll-fx.js';

const DATA_URL = 'data/trip.json';

async function loadTrip() {
  const response = await fetch(DATA_URL);
  if (!response.ok) throw new Error(`${DATA_URL}: HTTP ${response.status}`);
  return buildTrip(await response.json());
}

function mount(app, trip, clock) {
  const hero = renderHero(trip.hero);
  const countdown = createCountdown();
  const fund = trip.fund ? createFundView({ trip, clock }) : null;
  // The status is about the whole trip, so it sits between the hero and the
  // day tabs; the tabs stay right above the content they switch.
  const status = h('div', { class: 'status wrap' }, countdown.element, fund?.statusRow);
  const tabbar = renderTabs(trip.days, { fund: Boolean(fund) });
  const panels = [...trip.days.map((day) => renderDay(day, { fund: Boolean(fund) })), fund?.panel].filter(Boolean);
  const main = h('main', { class: 'wrap' }, panels, renderFooter(trip.footer));

  app.replaceChildren(hero, status, tabbar, main);
  return { hero, tabbar, countdown, panels, main, fund };
}

async function start() {
  const app = document.getElementById('app');

  try {
    const trip = await loadTrip();
    const clock = createClock(window.location.search);
    const view = mount(app, trip, clock);

    // Same task as mount(), before the next paint (see startReveal).
    const reveal = startReveal(view.main);
    startScrollFx({
      bar: document.querySelector('.progress'),
      bg: view.hero.querySelector('.hero-bg'),
      inner: view.hero.querySelector('.hero-inner'),
      thumbs: view.hero.querySelector('.hero-thumbs'),
    });

    const tabs = createTabs(view.tabbar.querySelector('[role="tablist"]'), view.panels, {
      onChange: (shown) => shown.forEach((panel) => reveal.replay(panel)),
    });
    startStatus({ trip, root: view.main, countdown: view.countdown, tabs, clock });
    // The fund never takes the schedule down with it.
    if (view.fund) startFund({ trip, view: view.fund, clock });
  } catch (error) {
    console.error(error);
    app.replaceChildren(h('main', { class: 'wrap' }, renderError(error.message)));
  }
}

start();
```

- [ ] **Step 7: Run unit tests and browser checks**

```bash
npm test
node <scratchpad>/verify/verify-fund.mjs http://127.0.0.1:4173/ <scratchpad>/verify/out
```

Expected: `npm test` PASS. Browser: groups 7 (`unlinked: …`), 8 (`no fund: …`) and `linked: reveal targets unchanged` PASS. Groups that need sheet data (1–6, 9–10) still FAIL, because the budget-only controller never fetches; `linked: 5 tabs, last is Quỹ` and `linked: "Tất cả" shows days only` must already PASS.

Open `iphone-days.png`: chips read `💰 Dự kiến …`, day heads show `💰 0 / 3.120k` with an empty bar, the extras block shows `⚡ Phát sinh · 0`, the status card sits under the dark panel. If a PASS-expected check fails, fix the view or CSS it names and re-run.

- [ ] **Step 8: Commit**

```bash
git add js/views/tabs.js js/controllers/tabs.js js/views/day.js js/views/fund.js js/controllers/fund.js js/main.js css/tokens.css css/fund.css index.html
git commit -m "feat: show budgets per slot, day and fund tab"
```

---
### Task 8: Fund controller — load, refresh, cache, errors

**Files:**
- Modify: `js/controllers/fund.js` (whole file below)
- Test: `<scratchpad>/verify/verify-fund.mjs` (Task 6)

**Interfaces:**
- Consumes: `parseCsv`, `assertCsv` (Task 1); `buildLedger` (Task 5); `view.update(ledger, meta)`, `view.fail(message)`, `view.onRefresh(handler)` (Task 7); `clock()` from `createClock`.
- Produces: `startFund({ trip, view, clock })` — same signature as Task 7. localStorage key `fund-cache:v1` holding `{ fetchedAt: number, expenses: string, contributions: string }`.

- [ ] **Step 1: Confirm the failing checks**

Run: `node <scratchpad>/verify/verify-fund.mjs http://127.0.0.1:4173/ <scratchpad>/verify/out`
Expected: groups 1–6 and 9–10 FAIL (as at the end of Task 7).

- [ ] **Step 2: Implement**

`js/controllers/fund.js` becomes:

```js
import { parseCsv, assertCsv } from '../lib/csv.js';
import { buildLedger } from '../model/fund.js';

const REFRESH_MS = 5 * 60_000;
const STALE_MS = 60_000;
const CACHE_KEY = 'fund-cache:v1';

// Reads both sheets, rebuilds the ledger and hands it to the view. The last
// good copy is kept on the phone, so a weak signal on the pass still shows
// numbers. Nothing thrown here reaches the schedule.
export function startFund({ trip, view, clock }) {
  const { csv } = trip.fund;
  if (!csv) {
    view.update(buildLedger(trip, { expenses: null, contributions: null }, clock()), { state: 'unlinked' });
    return;
  }

  let loading = false;
  let lastAttempt = 0;

  // Throws when a sheet lost a required column, before that copy is cached.
  const show = (copy, state) => {
    const tables = { expenses: parseCsv(copy.expenses), contributions: parseCsv(copy.contributions) };
    view.update(buildLedger(trip, tables, clock()), { state, fetchedAt: copy.fetchedAt });
  };

  async function load() {
    if (loading) return;
    loading = true;
    lastAttempt = Date.now();
    try {
      const [expenses, contributions] = await Promise.all([fetchCsv(csv.expenses), fetchCsv(csv.contributions)]);
      const copy = { fetchedAt: Date.now(), expenses, contributions };
      show(copy, 'fresh');
      writeCache(copy);
    } catch (error) {
      console.error(error);
      const cached = readCache();
      try {
        if (!cached) throw error;
        show(cached, 'stale');
      } catch {
        view.fail(error.message);
      }
    } finally {
      loading = false;
    }
  }

  const cached = readCache();
  if (cached) {
    try {
      show(cached, 'cached');
    } catch {
      // A broken copy is replaced by the load below.
    }
  }

  view.onRefresh(load);
  load();

  setInterval(() => {
    if (document.visibilityState === 'visible') load();
  }, REFRESH_MS);

  // Phones freeze background tabs; catch up when the page is looked at again.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - lastAttempt > STALE_MS) load();
  });
}

async function fetchCsv(url) {
  // Skips the browser cache; Google still caches published CSV for ~5 min.
  const busted = `${url}${url.includes('?') ? '&' : '?'}_=${Date.now()}`;
  const response = await fetch(busted, { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return assertCsv(await response.text());
}

function readCache() {
  try {
    const copy = JSON.parse(window.localStorage.getItem(CACHE_KEY));
    const valid = copy && typeof copy.expenses === 'string' && typeof copy.contributions === 'string'
      && Number.isFinite(copy.fetchedAt);
    return valid ? copy : null;
  } catch {
    return null;
  }
}

function writeCache(copy) {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(copy));
  } catch {
    // Private mode or storage blocked: live data still works.
  }
}
```

- [ ] **Step 3: Run the checks**

```bash
npm test
node <scratchpad>/verify/verify-fund.mjs http://127.0.0.1:4173/ <scratchpad>/verify/out
```

Expected: `npm test` PASS; browser `ALL PASS`.

- [ ] **Step 4: Look at the screenshots**

Open `iphone-days.png`, `iphone-fund.png`, `iphone360-fund.png`, `desktop-fund.png`. Compare with spec §7:
- Hidden Land chip `💰 260k / 200k  ▲ 60k` in the over colour; Trại Mèo `✓` in green; Dốc Sương `🆓 Miễn phí` grey.
- Day 1 head `💰 1.660k / 3.120k · phát sinh 120k` with a half-full bar; extras block lists `120.000đ · Quỹ trả`.
- Status card `💰 Quỹ còn 8.080k  [➕ Nhập chi]`.
- Fund tab order: head, tiles, `Theo ngày`, `Chi phí chung`, `Quyết toán · tạm tính`, `Sổ sách`, buttons; 5-column table readable at 360px.

For anything that looks wrong, fix `css/fund.css` or `js/views/fund.js`, re-run Step 3, and commit the fix separately.

- [ ] **Step 5: Commit**

```bash
git add js/controllers/fund.js
git commit -m "feat: load fund sheets with refresh and offline copy"
```

---
### Task 9: README

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: behaviour from Tasks 1–8; `npm run form-options` (Task 4).
- Produces: the setup guide Task 10 follows.

- [ ] **Step 1: Table of contents**

Under `- [Tính năng](#tính-năng)`, after `  - [Truy cập và an toàn](#9-truy-cập-và-an-toàn)`, add:

```markdown
  - [Quỹ chung & chi phí](#10-quỹ-chung--chi-phí)
```

After `- [Sửa lịch trình](#sửa-lịch-trình)`, add:

```markdown
- [Kết nối Google Form / Sheet](#kết-nối-google-form--sheet)
```

- [ ] **Step 2: Feature section**

After the line ``- Link ngoài mở tab mới với `rel="noopener noreferrer"`.`` (end of section 9), add a blank line and:

```markdown
### 10. Quỹ chung & chi phí

Nhóm đóng quỹ chung; mọi khoản chi được ghi qua Google Form, trang đọc Google Sheet và tự tính.

- **Từng khung giờ:** dòng `💰` so dự kiến với thực chi — `💰 260k / 200k ▲ 60k` (vượt, cam đỏ), `▼ 20k` / `✓` (xanh), `💰 Dự kiến 200k · 50k/người` (chưa chi), `🆓 Miễn phí`. Bấm để xem từng khoản: số tiền, quỹ trả hay ai ứng, chia cho ai, ai nhập, lúc nào — kèm nút `➕ Nhập chi ở đây` mở Form **đã chọn sẵn địa điểm**.
- **Từng ngày:** `💰 1.660k / 3.120k · phát sinh 120k` và thanh tiến độ; cuối ngày có khối `⚡ Phát sinh ngoài plan` với nút `➕ Nhập phát sinh`.
- **Dưới panel trạng thái:** `💰 Quỹ còn 8.080k` và nút `➕ Nhập chi` — chọn sẵn khung đang diễn ra, giữa hai khung thì chọn khung vừa kết thúc.
- **Tab `💰 Quỹ`:** đã góp · đã chi · quỹ còn · dự phòng; bảng theo ngày; chi phí chung (vé xe, khách sạn, xe máy, phát sinh chung); quyết toán từng người; sổ góp quỹ và sổ chi đầy đủ; nút mở Form và Sheet. Tab `Tất cả` không gồm tab này.
- **Quyết toán:** `Còn lại = Đã góp + Đã ứng − Phần phải chịu`; tổng cột Còn lại luôn bằng số quỹ còn. Trong chuyến ghi `tạm tính`; khi chuyến đi kết thúc hiện `Chốt quỹ` — `→ Quỹ hoàn Hữu 2.695k`, `→ Khanh nộp thêm vào quỹ 845k` — mỗi người chỉ một giao dịch với quỹ.
- **Chia lẻ đúng từng đồng:** 100.000đ chia 3 = 33.334 + 33.333 + 33.333.
- **Nhập sai không mất tiền:** sai tên địa điểm → vẫn tính vào tổng, hiện ở mục `Không khớp địa điểm`; sai tên người → vẫn tính vào tổng nhưng chưa quyết toán (`⚠️ Có N dòng cần sửa — số liệu chưa chốt`); sai số tiền → bỏ dòng. Mỗi lỗi báo đúng dòng trong Sheet, vd. `Dòng 9 · Ai trả "Tram" không phải thành viên`.
- **Tự cập nhật:** tải lại mỗi 5 phút khi trang đang mở, ngay khi mở lại trang, hoặc bấm `↻` — mục nào đang mở vẫn giữ nguyên. Google cần khoảng 5 phút sau khi gửi Form mới công bố số mới.
- **Mất sóng:** dùng bản lưu gần nhất trên máy — `Dữ liệu lúc 14:05 · chưa tải được bản mới`. Lỗi phần quỹ không bao giờ làm hỏng lịch trình.
- **Chưa kết nối Sheet:** trang vẫn hiện toàn bộ dự kiến, tab Quỹ ghi `Chưa kết nối Google Sheet`.
```

- [ ] **Step 3: Tests table**

Replace the row

```markdown
| `tests/trip.test.js` | Số ngày/đêm/điểm/khung trống, `srcset`, link Maps, sắp xếp, thông báo lỗi dữ liệu |
```

with

```markdown
| `tests/trip.test.js` | Số ngày/đêm/điểm/khung trống, `srcset`, link Maps, sắp xếp, thông báo lỗi dữ liệu, budget, cấu hình quỹ, nhãn Form |
```

and after the `tests/clock.test.js` row add:

```markdown
| `tests/csv.test.js` | Đọc CSV: nháy kép, dấu phẩy và xuống dòng trong ô, CRLF, BOM, trang HTML thay vì CSV |
| `tests/text.test.js` | So tên không phân biệt hoa thường, khoảng trắng thừa, dạng Unicode |
| `tests/money.test.js` | `1.660k`, `33,3k`, `260.000đ`, ▲ ▼ ✓, số dư |
| `tests/fund.test.js` | Tìm cột theo tên, đọc số tiền, chia lẻ, tổng khung/ngày/chung/chuyến, quyết toán, dòng lỗi, link Form điền sẵn |
```

- [ ] **Step 4: Schema table and setup guide**

After the row ``| `items[].empty` | không | `true` = khung trống, không tính là điểm |`` add:

```markdown
| `items[].budget` | không | Dự kiến, VND, số nguyên ≥ 0. `0` = `Miễn phí` |
| `fund.members[]` | có (khi có `fund`) | Tên thành viên, không trùng, không được là `Quỹ` |
| `fund.shared[]` | không | `{ "title", "icon", "budget", "note" }` — chi phí chung không thuộc ngày nào |
| `fund.csv.expenses`, `fund.csv.contributions` | không | Link CSV publish của tab `ChiTieu` và `GopQuy`. Thiếu thì trang chỉ hiện dự kiến |
| `fund.form.url`, `fund.form.placeField` | không | Link Form (`…/viewform`) và `entry.…` của câu hỏi Địa điểm |
| `fund.sheet` | không | Link mở Google Sheet |

Khi có `fund`, các khung trong cùng một ngày không được trùng `title` và không được đặt tên `Phát sinh` — Form phân biệt địa điểm bằng tên.
```

Then, right before `## Cấu trúc thư mục`, add:

````markdown
## Kết nối Google Form / Sheet

Làm một lần, khoảng 15 phút. **Lưu ý:** link CSV đã publish là công khai — ai có link (kể cả người xem source trang) đọc được tên và số tiền, nhưng không sửa được.

1. **Lấy danh sách địa điểm:** chạy `npm run form-options`, copy toàn bộ kết quả.
2. **Tạo Google Form** "Chi tiêu Đà Lạt". Tên câu hỏi phải giữ **đúng chữ** như bảng:

   | Câu hỏi | Loại | Lựa chọn / xác thực | Bắt buộc |
   |---|---|---|---|
   | Người nhập | Menu thả xuống | Hữu, MiMi, Khanh, Trâm | có |
   | Địa điểm | Menu thả xuống | Paste kết quả bước 1 vào lựa chọn đầu tiên — Form tự tách mỗi dòng | có |
   | Số tiền | Câu trả lời ngắn | Xác thực phản hồi: Số → Lớn hơn → `0` | có |
   | Ai trả | Trắc nghiệm | Quỹ, Hữu, MiMi, Khanh, Trâm | có |
   | Chia cho | Hộp kiểm | Hữu, MiMi, Khanh, Trâm — mô tả: "Bỏ trống = chia đều cả nhóm" | không |
   | Ghi chú | Câu trả lời ngắn | | không |

   Trong Cài đặt → Câu trả lời: tắt thu thập email và giới hạn 1 câu trả lời, để nhập không cần đăng nhập.
3. **Liên kết Sheet:** tab Câu trả lời → Liên kết với Trang tính → tạo bảng tính mới. Đổi tên tab câu trả lời thành `ChiTieu`.
4. **Tạo tab `GopQuy`** trong cùng bảng tính, dòng 1 là `Ngày`, `Người góp`, `Số tiền`, `Ghi chú`. Mỗi lần góp quỹ nhập một dòng.
5. **Đặt khu vực:** Tệp → Cài đặt → Ngôn ngữ và khu vực = **Việt Nam**.
6. **Publish CSV:** Tệp → Chia sẻ → Công bố lên web → chọn tab `ChiTieu`, định dạng **Giá trị được phân tách bằng dấu phẩy (.csv)** → Công bố → copy link. Làm lại cho `GopQuy`. Giữ bật "Tự động công bố lại khi có thay đổi".
7. **Lấy `placeField`:** trong Form, menu ⋮ → Nhận đường liên kết điền sẵn → chọn một Địa điểm bất kỳ → Nhận đường liên kết → Sao chép. Link có đoạn `entry.123456789=…`; lấy phần `entry.123456789`. Phần trước dấu `?` (kết thúc bằng `/viewform`) là link Form.
8. **Chia sẻ bảng tính** quyền chỉnh sửa cho cả nhóm, để ai cũng sửa được dòng nhập sai.
9. **Điền vào `data/trip.json`:**

   ```json
   "fund": {
     "members": ["Hữu", "MiMi", "Khanh", "Trâm"],
     "csv": {
       "expenses": "https://docs.google.com/spreadsheets/d/e/…/pub?gid=…&single=true&output=csv",
       "contributions": "https://docs.google.com/spreadsheets/d/e/…/pub?gid=…&single=true&output=csv"
     },
     "form": { "url": "https://docs.google.com/forms/d/e/…/viewform", "placeField": "entry.123456789" },
     "sheet": "https://docs.google.com/spreadsheets/d/…/edit",
     "shared": [ … giữ nguyên … ]
   }
   ```

10. `npm test`, mở trang local → tab `💰 Quỹ` hiện `Cập nhật HH:MM`. Push lên `main`.

Đổi tên hoặc thêm khung giờ sau này: chạy lại `npm run form-options` và cập nhật lựa chọn của câu hỏi Địa điểm. Dòng cũ không khớp tên mới vẫn được tính và hiện ở mục `Không khớp địa điểm` — sửa tên trong Sheet là hết.

````

- [ ] **Step 5: Folder structure and docs links**

In the `## Cấu trúc thư mục` code block, change these lines:

```
  hero.css · tabs.css · timeline.css · countdown.css · fund.css
```
```
  lib/                  giờ, đồng hồ, animation, tạo DOM, đọc CSV, định dạng tiền, so tên
  model/                dữ liệu → model, trạng thái chuyến đi, sổ quỹ (thuần, có test)
  views/                hero, tabs, ngày, panel trạng thái, quỹ, footer, lỗi
  controllers/          tabs, đồng hồ thời gian thực, reveal, parallax dự phòng, tải sổ quỹ
scripts/form-options.js in danh sách địa điểm cho Google Form
```

(`scripts/form-options.js` goes on its own line right before `tests/`.)

Under `## Tài liệu`, add:

```markdown
- [Thiết kế quỹ chung & chi phí](docs/specs/2026-09-14-fund-ledger-design.md) — dữ liệu, cách tính, giao diện, xử lý lỗi.
- [Kế hoạch triển khai quỹ](docs/plans/2026-09-14-fund-ledger.md).
```

- [ ] **Step 6: Check links and commit**

Run: `grep -n "10-quỹ-chung--chi-phí\|kết-nối-google-form--sheet\|### 10. Quỹ chung\|## Kết nối Google Form" README.md`
Expected: 4 lines (2 TOC links, 2 headings).

```bash
git add README.md
git commit -m "docs: describe the fund ledger and the Google Form setup"
```

---

### Task 10: Connect the real Form and Sheet (needs the user)

**Files:**
- Modify: `data/trip.json` (`fund.csv`, `fund.form`, `fund.sheet`)
- Possibly modify: `js/model/fund.js`, `tests/fund.test.js` (only if the real CSV differs from the fixtures)
- Create (scratchpad, not committed): `<scratchpad>/spike/expenses.csv`, `<scratchpad>/spike/contributions.csv`

**Interfaces:**
- Consumes: README setup guide (Task 9); everything else.
- Produces: live data on the page.

- [ ] **Step 1: Hand the setup to the user and wait**

Send the user the output of `npm run form-options` and point them to README → "Kết nối Google Form / Sheet", steps 2–8. Ask them to also:
- submit **two test answers**: one `Day 1 · Hidden Land`, `260000`, `Quỹ`, Chia cho empty; one `Chung · Phát sinh`, `90000`, `MiMi`, Chia cho `Hữu` + `MiMi`, Ghi chú `test, có dấu phẩy`;
- add one `GopQuy` row: `10/10`, `Hữu`, `3000000`;
- send back: the two CSV links, the form `…/viewform` link, the `entry.…` id, the sheet link.

Do not continue until the user replies.

- [ ] **Step 2: Spike — CORS and headers**

```bash
mkdir -p <scratchpad>/spike
EXP='<expenses CSV link>'
CON='<contributions CSV link>'
curl -sL -D - -o <scratchpad>/spike/expenses.csv -H 'Origin: https://huucao.github.io' "$EXP&_=1" | grep -i -E '^HTTP/|^access-control-allow-origin|^content-type'
curl -sL -D - -o <scratchpad>/spike/contributions.csv -H 'Origin: https://huucao.github.io' "$CON&_=1" | grep -i -E '^HTTP/|^access-control-allow-origin|^content-type'
```

Expected: the last `HTTP/` line is `200`; `access-control-allow-origin: *` is present on that final response; `content-type: text/csv`.
**If `access-control-allow-origin` is missing or the final status is not 200: STOP.** Report the headers to the user — the browser cannot read the sheet, and the approach needs a new decision.

- [ ] **Step 3: Spike — real CSV format**

```bash
cat <scratchpad>/spike/expenses.csv; echo; cat <scratchpad>/spike/contributions.csv
node --input-type=module -e "
import { readFileSync } from 'node:fs';
import { buildTrip } from './js/model/trip.js';
import { parseCsv } from './js/lib/csv.js';
import { buildLedger } from './js/model/fund.js';
const trip = buildTrip(JSON.parse(readFileSync('data/trip.json', 'utf8')));
const read = (file) => parseCsv(readFileSync(file, 'utf8'));
const ledger = buildLedger(trip, {
  expenses: read('<scratchpad>/spike/expenses.csv'),
  contributions: read('<scratchpad>/spike/contributions.csv'),
}, Date.now());
console.log(JSON.stringify({
  warnings: ledger.warnings,
  entries: ledger.entries.map((e) => [e.label, e.amount, e.payer, e.splitFor, e.note, e.time]),
  totals: ledger.totals,
}, null, 2));
"
```

Expected: `warnings: []`; the entries read `["Chung · Phát sinh", 90000, "MiMi", ["Hữu","MiMi"], "test, có dấu phẩy", "DD/MM HH:MM"]` and `["Day 1 · Hidden Land", 260000, "Quỹ", [4 names], "", "DD/MM HH:MM"]`; `totals.contributed` is `3000000`.

If anything differs (header names, timestamp shape so `time` is not `DD/MM HH:MM`, checkbox separator, amount format): copy the real header and rows into a new test in `tests/fund.test.js`, run it to see it fail, fix `EXPENSE_COLUMNS` / `TIMESTAMP` / the `Chia cho` split in `js/model/fund.js`, run `npm test` to PASS, and commit:

```bash
git add js/model/fund.js tests/fund.test.js
git commit -m "fix: read the real Google Sheet CSV format"
```

- [ ] **Step 4: Add the links**

In `data/trip.json`, inside `fund`, after `members` add (real values from the user):

```json
    "csv": {
      "expenses": "<expenses CSV link>",
      "contributions": "<contributions CSV link>"
    },
    "form": { "url": "<form …/viewform link>", "placeField": "<entry.…>" },
    "sheet": "<sheet link>",
```

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Check the live page**

Append this group to `<scratchpad>/verify/verify-fund.mjs` just before `chrome.kill();`:

```js
// 11. Real sheet (REAL=1)
if (process.env.REAL) {
  const page = await openPage(IPHONE, { clearStorage: true });
  await sleep(4000);
  await page.click('[data-tab="fund"]');
  const state = await page.evaluate(`({
    meta: document.querySelector('.fund-meta-text')?.textContent,
    error: document.querySelector('#panel-fund .load-error p')?.textContent ?? null,
    entries: document.querySelector('details[data-key="entries"] summary')?.textContent,
  })`);
  check('real: sheet loads', /^Cập nhật \d{2}:\d{2}$/.test(state.meta ?? '') && state.error === null, state);
  await page.screenshot('real-fund.png');
  await page.close();
}
```

Run: `REAL=1 node <scratchpad>/verify/verify-fund.mjs http://127.0.0.1:4173/ <scratchpad>/verify/out`
Expected: `ALL PASS`, and `real: sheet loads` shows `Sổ chi · 2 khoản · 350k`.

- [ ] **Step 6: Commit and hand back**

```bash
git add data/trip.json
git commit -m "feat: connect the fund to the group's Google Sheet"
npm test
git status -sb
git log --oneline main..HEAD
```

Expected: tests PASS, clean tree. Do not push or merge. Tell the user:
- the page is ready on the branch; pushing to `main` publishes it;
- delete the two test answers and the test `GopQuy` row from the Sheet before the real entries start (their sheet — do not do it for them).
