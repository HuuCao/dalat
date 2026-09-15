# Sheet Plan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The schedule (days, slots) and shared costs come from three published Google Sheet tabs instead of `data/trip.json`, with a local copy for instant/offline opens, row-level warnings, and an Apps Script that keeps the Form's `Địa điểm` dropdown in step.

**Architecture:** A pure adapter (`readPlan`) turns the three CSV tabs into the exact raw `days` / `fund.shared` shape `buildTrip` already takes; `mergePlan` splices them into the JSON config. A small controller keeps the last good copy in localStorage, renders from it at once, fetches in the background and decides (`decide()`, pure) between nothing / touch / save / reload / toast. The Apps Script mirrors the label rules and is tested in Node through `node:vm`.

**Tech Stack:** Vanilla ES modules, CSS, `node --test`, no build step, no dependencies. Google Apps Script (V8). Headless Chrome via CDP for UI checks.

**Spec:** `docs/specs/2026-09-15-sheet-plan-design.md`

## Global Constraints

- Work on branch `feat/sheet-plan`. Never commit on `main`.
- No build step, no dependency. Tests: `npm test` (Node ≥ 18). Baseline before Task 1: 83 tests pass.
- Data text goes into the DOM only through `h()` / `textContent`, never HTML. External links: `target="_blank" rel="noopener noreferrer"`.
- `Element.replaceChildren()` never receives `null` — filter first.
- Animation DOM contract stays: `.day-head` directly before `.timeline`; every `.item` a direct child of `.timeline`.
- Fixed-position elements live outside `<main>` (an animated ancestor breaks `position: fixed`).
- Motion only inside `@media (prefers-reduced-motion: no-preference)`. Tap targets ≥ 44px. No horizontal page scroll.
- Form labels stay `Day N · <Tên>`, `Day N · Phát sinh`, `Chung · <Tên>`, `Chung · Phát sinh`.
- Sheet tab names: `LichTrinh`, `Ngay`, `ChiChung`. Column names exactly as spec §4.1–4.3.
- Storage keys: localStorage `plan-cache:v1`; sessionStorage `plan-reloaded-at`. Every storage access wrapped in try/catch.
- Timings: reload window 4000 ms (`elapsedMs ≤ 4000` → reload); reload guard 60 000 ms; fetch timeout 15 s per CSV.
- Warning text format: `<Tab> dòng <N> · <message>` — messages verbatim from spec §5.4.
- Apps Script file: no `import`/`export`, no `?.` / `??` (keep to syntax Apps Script V8 surely runs).
- Commits: Conventional Commits, English, ending with `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.

**Deviation from spec §8:** `plan` link validation lives in `js/model/plan.js` (`planLinks`) next to the rest of the plan code, so `js/model/trip.js` is not modified. `clockText` moves from `js/views/fund.js` to `js/lib/time.js` so the footer can share it.

## File map

| File | Responsibility | Task |
|---|---|---|
| `tests/fixtures/trip.json` | Frozen copy of today's full `data/trip.json` for tests | 1 |
| `js/lib/table.js` | `readTable`, `parseAmount` (moved from `model/fund.js`) | 1 |
| `js/lib/csv.js` | + `fetchCsv` (moved from `controllers/fund.js`) | 1 |
| `js/lib/time.js` | + `clockText` (moved from `views/fund.js`) | 1 |
| `tests/table.test.js` | Tests moved from `fund.test.js` | 1 |
| `tests/helpers/sheets.js` | `sheetsOf(raw)` → CSV of 3 tabs; `messySheets(raw)` adds bad rows | 2 |
| `js/model/plan.js` | `parseDate`, `parseTime`, `parseBudget`, `parseFlag`, `readPlan`, `mergePlan`, `planLinks` | 2, 3 |
| `tests/plan.test.js` | Parsers, warnings, round-trip | 2, 3 |
| `js/controllers/plan.js` | `sameCopy`, `decide`, `readCopy`, `writeCopy`, `readReloadMark`, `writeReloadMark`, `fetchPlan`, `refreshPlan` | 4 |
| `tests/plan-cache.test.js` | `decide`, storage helpers, `refreshPlan` with fakes | 4 |
| `scripts/apps-script/form-sync.js` | Apps Script: `planLabels`, `syncForm`, `setup`, `onOpen`, `syncFromMenu` | 5 |
| `tests/form-sync.test.js` | Script in `node:vm` vs page labels | 5 |
| `js/views/plan-warnings.js` | Warning banner | 6 |
| `js/views/update-toast.js` | "Lịch trình vừa thay đổi" toast | 6 |
| `js/views/footer.js` | + `createPlanStamp`, optional stamp slot | 6 |
| `css/base.css`, `css/fund.css`, `css/motion/keyframes.css`, `js/views/fund.js` | Shared `.warn-box`, banner, toast styles | 6 |
| `js/main.js` | Load flow §5.1 | 7 |
| `README.md`, `package.json`, `scripts/form-options.js` (delete) | Docs, drop `form-options` | 8 |
| `data/trip.json` | Switch to `plan` (after the Sheet is live) | 9 |

---

### Task 1: Test fixture and shared helpers

Pure refactor: tests stop reading live `data/trip.json`; helpers the plan code needs move to `lib/`. Behaviour unchanged, still 83 tests.

**Files:**
- Create: `tests/fixtures/trip.json`, `js/lib/table.js`, `tests/table.test.js`
- Modify: `tests/trip.test.js:6`, `tests/fund.test.js:1-11,41-63`, `tests/status.test.js:15`, `tests/calendar.test.js:7`, `js/model/fund.js:1-2,29-52`, `js/lib/csv.js`, `js/controllers/fund.js:1,6,73-88`, `js/lib/time.js`, `js/views/fund.js:1-2,172`

**Interfaces:**
- Produces: `readTable(rows: string[][], tableName: string, columns: Record<string, { names: string[], required?: boolean }>) → Array<{ line: number, [key]: string }>` and `parseAmount(text) → number | null` from `js/lib/table.js`; `fetchCsv(url: string) → Promise<string>` from `js/lib/csv.js`; `clockText(ms: number) → string` (`"14:05"`) from `js/lib/time.js`; fixture at `tests/fixtures/trip.json`.

- [ ] **Step 1: Freeze the fixture**

```bash
mkdir -p tests/fixtures && cp data/trip.json tests/fixtures/trip.json
```

- [ ] **Step 2: Point the four tests at the fixture**

In `tests/trip.test.js`, `tests/fund.test.js`, `tests/status.test.js`, `tests/calendar.test.js` replace

```js
new URL('../data/trip.json', import.meta.url)
```

with

```js
new URL('./fixtures/trip.json', import.meta.url)
```

- [ ] **Step 3: Write `tests/table.test.js` (moved tests, new import)**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv } from '../js/lib/csv.js';
import { readTable, parseAmount } from '../js/lib/table.js';

test('readTable finds columns by name, in any order, case or Unicode form', () => {
  const rows = parseCsv('ghi chú, SỐ TIỀN ,Ai trả,Chia cho,Địa điểm\nx,5,Quỹ,,Day 1 · Hidden Land\n,,,,\n');
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
```

Then delete those two tests (`readTable finds columns…`, `amounts keep only digits`) from `tests/fund.test.js` and change its import block to:

```js
import {
  splitShares, buildLedger,
  describeBucket, describeEntry, describeDay, describeBalance, formUrl, placeLabelAt,
} from '../js/model/fund.js';
```

- [ ] **Step 4: Run to see it fail**

Run: `npm test`
Expected: FAIL — `Cannot find module '…/js/lib/table.js'`.

- [ ] **Step 5: Create `js/lib/table.js`**

Cut `readTable` and `parseAmount` (with the comment above `readTable`) out of `js/model/fund.js` into:

```js
import { keyOf } from './text.js';

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
```

Top of `js/model/fund.js` becomes:

```js
import { keyOf } from '../lib/text.js';
import { readTable, parseAmount } from '../lib/table.js';
import { formatShort, formatFull, formatDiff, formatExact } from '../lib/money.js';
import { FUND_PAYER } from './trip.js';
```

- [ ] **Step 6: Move `fetchCsv` to `js/lib/csv.js`**

Append to `js/lib/csv.js`:

```js
const FETCH_TIMEOUT_MS = 15_000;

// A published sheet as text. Skips the browser cache; Google still caches
// published CSV for ~5 min.
export async function fetchCsv(url) {
  const busted = `${url}${url.includes('?') ? '&' : '?'}_=${Date.now()}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(busted, { cache: 'no-store', signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return assertCsv(await response.text());
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Hết thời gian tải (15s)');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
```

In `js/controllers/fund.js`: delete the `fetchCsv` function and the `FETCH_TIMEOUT_MS` constant; change line 1 to

```js
import { parseCsv, fetchCsv } from '../lib/csv.js';
```

- [ ] **Step 7: Move `clockText` to `js/lib/time.js`**

Append to `js/lib/time.js`:

```js
// "14:05" in the viewer's own clock: when data was fetched on this phone.
export function clockText(ms) {
  return new Date(ms).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}
```

In `js/views/fund.js` delete `const clockText = …` (line 172) and add to the imports:

```js
import { clockText } from '../lib/time.js';
```

- [ ] **Step 8: Run tests**

Run: `npm test`
Expected: PASS, `# pass 83`.

- [ ] **Step 9: Smoke the page**

Run (background): `python3 -m http.server 8765 --bind 127.0.0.1`, open `http://127.0.0.1:8765/` — schedule renders, tab `💰 Quỹ` shows `Cập nhật HH:MM` or a load error for the sheet (network), no uncaught exception in the console.

- [ ] **Step 10: Commit**

```bash
git add tests/fixtures/trip.json tests/table.test.js tests/trip.test.js tests/fund.test.js tests/status.test.js tests/calendar.test.js js/lib/table.js js/lib/csv.js js/lib/time.js js/model/fund.js js/controllers/fund.js js/views/fund.js
git commit -m "refactor: share table, fetch and clock helpers; freeze test fixture

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `readPlan` — three CSV tabs to raw days and shared costs

**Files:**
- Create: `js/model/plan.js`, `tests/helpers/sheets.js`, `tests/plan.test.js`

**Interfaces:**
- Consumes: `parseCsv` (`js/lib/csv.js`), `readTable` (`js/lib/table.js`), `isDate`, `isTime`, `toMinutes` (`js/lib/time.js`), `keyOf` (`js/lib/text.js`), `EXTRA_TITLE` (`js/model/trip.js`).
- Produces (`js/model/plan.js`):
  - `parseDate(text: string) → 'YYYY-MM-DD' | null`
  - `parseTime(text: string) → 'HH:MM' | null`
  - `parseBudget(text: string) → number | undefined | null` (`undefined` = blank, `null` = invalid)
  - `parseFlag(text: string) → boolean`
  - `readPlan({ items: string, days: string, shared: string }) → { days: RawDay[], shared: RawCost[], warnings: string[] }` — throws `"<Tab>: thiếu cột \"<Cột>\""` when a required column is missing. `RawDay = { date, items: RawItem[], icon?, note? }`, `RawItem = { start, end, title, icon?, tag?, map?, budget?, empty? }`, `RawCost = { title, icon?, budget?, note? }`; empty fields are absent, `days` sorted by date.
- Produces (`tests/helpers/sheets.js`): `sheetsOf(raw) → { items, days, shared }` CSV text; `messySheets(raw) → { items, days, shared }` = `sheetsOf(raw)` plus the bad rows below.

- [ ] **Step 1: Write `tests/helpers/sheets.js`**

```js
// Builds the three sheet tabs, as published CSV, from a trip.json-shaped
// object. Dates and times use the forms Google Sheets (Vietnam) publishes.

const cell = (value) => {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

export const csvOf = (rows) => rows.map((row) => row.map(cell).join(',')).join('\n');

const vnDate = (iso) => {
  const [year, month, day] = iso.split('-');
  return `${Number(day)}/${Number(month)}/${year}`;
};

export const ITEM_HEADER = ['Ngày', 'Bắt đầu', 'Kết thúc', 'Icon', 'Tên', 'Tag', 'Maps', 'Dự kiến', 'Trống'];
export const DAY_HEADER = ['Ngày', 'Icon', 'Ghi chú'];
export const SHARED_HEADER = ['Tên', 'Icon', 'Dự kiến', 'Ghi chú'];

export function sheetsOf(raw) {
  return {
    // Start as "7:00" (leading zero dropped), end as "09:00:00": both forms
    // the sheet may publish.
    items: csvOf([ITEM_HEADER, ...raw.days.flatMap((day) => day.items.map((item) => [
      vnDate(day.date), item.start.replace(/^0/, ''), `${item.end}:00`, item.icon, item.title,
      item.tag, item.map, item.budget, item.empty ? 'TRUE' : 'FALSE',
    ]))]),
    days: csvOf([DAY_HEADER, ...raw.days.map((day) => [vnDate(day.date), day.icon, day.note])]),
    shared: csvOf([SHARED_HEADER, ...(raw.fund?.shared ?? []).map((cost) => [cost.title, cost.icon, cost.budget, cost.note])]),
  };
}

// For the fixture trip: LichTrinh lines 23–29, Ngay lines 5–6, ChiChung
// lines 5–7 are appended. Only lines 29 ("Dậy sớm") and Ngay 5 (19/10) are
// kept; every other appended row is dropped with a warning.
export function messySheets(raw) {
  const sheets = sheetsOf(raw);
  const add = (csv, rows) => [csv, csvOf(rows)].join('\n');
  return {
    items: add(sheets.items, [
      ['32/10/2026', '08:00', '09:00', '', 'Sai ngày', '', '', '', ''],
      ['16/10/2026', '10:00', '09:00', '', 'Ngược giờ', '', '', '', ''],
      ['16/10/2026', '7h', '09:00', '', 'Sai giờ', '', '', '', ''],
      ['17/10/2026', '23:00', '23:30', '', 'phát sinh', '', '', '', ''],
      ['16/10/2026', '23:00', '23:30', '', 'hidden land', '', '', '', ''],
      ['18/10/2026', '13:00', '14:00', '', '', '', '', '', ''],
      ['17/10/2026', '06:00', '06:30', '⏰', 'Dậy sớm', '', '', 'hai trăm', ''],
    ]),
    days: add(sheets.days, [
      ['19/10/2026', '🧳', 'Ngày thêm'],
      ['16/10/2026', '🌿', 'trùng'],
    ]),
    shared: add(sheets.shared, [
      ['khách sạn', '', '1', ''],
      ['Phát sinh', '', '', ''],
      ['', '', '5', ''],
    ]),
  };
}
```

- [ ] **Step 2: Write the failing tests `tests/plan.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseDate, parseTime, parseBudget, parseFlag, readPlan } from '../js/model/plan.js';
import { sheetsOf, messySheets } from './helpers/sheets.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/trip.json', import.meta.url), 'utf8'));

test('dates read the Vietnam sheet form and ISO, and must exist', () => {
  assert.equal(parseDate('16/10/2026'), '2026-10-16');
  assert.equal(parseDate('6/9/2026'), '2026-09-06');
  assert.equal(parseDate('2026-10-16'), '2026-10-16');
  assert.equal(parseDate('31/9/2026'), null);
  assert.equal(parseDate('16-10-2026'), null);
  assert.equal(parseDate(''), null);
});

test('times accept H:MM, HH:MM and HH:MM:SS', () => {
  assert.equal(parseTime('7:00'), '07:00');
  assert.equal(parseTime('07:00'), '07:00');
  assert.equal(parseTime('7:00:00'), '07:00');
  assert.equal(parseTime('23:59'), '23:59');
  assert.equal(parseTime('24:00'), null);
  assert.equal(parseTime('7h'), null);
  assert.equal(parseTime('7:5'), null);
  assert.equal(parseTime(''), null);
});

test('budgets: blank is none, 0 is free, separators are fine, words are invalid', () => {
  assert.equal(parseBudget(''), undefined);
  assert.equal(parseBudget('0'), 0);
  assert.equal(parseBudget('280000'), 280000);
  assert.equal(parseBudget('280.000'), 280000);
  assert.equal(parseBudget('280,000đ'), 280000);
  assert.equal(parseBudget('hai trăm'), null);
  assert.equal(parseBudget('-5'), null);
  assert.equal(parseBudget('.'), null);
});

test('the empty flag reads a checkbox, x or có', () => {
  for (const yes of ['TRUE', 'true', 'x', 'X', 'có', 'Có']) assert.equal(parseFlag(yes), true, yes);
  for (const no of ['FALSE', '', 'không']) assert.equal(parseFlag(no), false, no);
});

test('clean sheets give the fixture days and shared costs, without warnings', () => {
  const plan = readPlan(sheetsOf(fixture));
  assert.deepEqual(plan.warnings, []);
  assert.equal(plan.days.length, 3);
  assert.deepEqual(plan.days[0].items[1], {
    start: '09:15', end: '10:30', icon: '☕', title: 'Hidden Land', tag: 'Coffee', map: 'Hidden Land coffee Đà Lạt', budget: 200000,
  });
  assert.deepEqual(plan.days[1].items[2], { start: '10:15', end: '11:15', icon: '☕', title: 'Cà phê — Tự do', budget: 280000, empty: true });
  assert.deepEqual(plan.days[2].items.at(-1), { start: '12:15', end: '13:00', icon: '🚗', title: 'Go Home', tag: 'End trip' });
  assert.deepEqual(plan.days[0], { ...plan.days[0], date: '2026-10-16', icon: '🌿' });
  assert.equal('note' in plan.days[0], false);
  assert.equal(plan.days[2].note, 'Ngày cuối');
  assert.deepEqual(plan.shared, fixture.fund.shared);
});

test('bad rows are dropped with the sheet line; a bad budget keeps the row', () => {
  const plan = readPlan(messySheets(fixture));
  assert.deepEqual(plan.warnings, [
    'LichTrinh dòng 23 · Ngày "32/10/2026" không hợp lệ',
    'LichTrinh dòng 24 · Kết thúc "09:00" phải sau Bắt đầu "10:00"',
    'LichTrinh dòng 25 · Bắt đầu "7h" không hợp lệ',
    'LichTrinh dòng 26 · "Phát sinh" là tên dành riêng',
    'LichTrinh dòng 27 · trùng tên "hidden land" với dòng 3',
    'LichTrinh dòng 28 · thiếu Tên',
    'LichTrinh dòng 29 · Dự kiến "hai trăm" không hợp lệ',
    'Ngay dòng 6 · trùng ngày 16/10/2026 với dòng 2',
    'ChiChung dòng 5 · trùng tên "khách sạn" với dòng 3',
    'ChiChung dòng 6 · "Phát sinh" là tên dành riêng',
    'ChiChung dòng 7 · thiếu Tên',
  ]);
  assert.deepEqual(plan.days.map((day) => [day.date, day.items.length]), [
    ['2026-10-16', 9], ['2026-10-17', 9], ['2026-10-18', 4], ['2026-10-19', 0],
  ]);
  assert.deepEqual(plan.days[1].items.at(-1), { start: '06:00', end: '06:30', icon: '⏰', title: 'Dậy sớm' });
  assert.deepEqual(plan.days[3], { date: '2026-10-19', items: [], icon: '🧳', note: 'Ngày thêm' });
  assert.equal(plan.days[0].icon, '🌿');
  assert.equal(plan.shared.length, 3);
});

test('a tab without a required column throws', () => {
  const sheets = sheetsOf(fixture);
  assert.throws(() => readPlan({ ...sheets, items: 'Ngày,Bắt đầu,Tên\n16/10/2026,07:00,X' }), /LichTrinh: thiếu cột "Kết thúc"/);
  assert.throws(() => readPlan({ ...sheets, days: 'Icon\n🌿' }), /Ngay: thiếu cột "Ngày"/);
  assert.throws(() => readPlan({ ...sheets, shared: '' }), /ChiChung: thiếu cột "Tên"/);
});
```

- [ ] **Step 3: Run to see it fail**

Run: `node --test tests/plan.test.js`
Expected: FAIL — `Cannot find module '…/js/model/plan.js'`.

- [ ] **Step 4: Implement `js/model/plan.js`**

```js
import { parseCsv } from '../lib/csv.js';
import { readTable } from '../lib/table.js';
import { isDate, isTime, toMinutes } from '../lib/time.js';
import { keyOf } from '../lib/text.js';
import { EXTRA_TITLE } from './trip.js';

const ITEM_COLUMNS = {
  date: { names: ['Ngày'], required: true },
  start: { names: ['Bắt đầu'], required: true },
  end: { names: ['Kết thúc'], required: true },
  title: { names: ['Tên'], required: true },
  icon: { names: ['Icon'] },
  tag: { names: ['Tag'] },
  map: { names: ['Maps'] },
  budget: { names: ['Dự kiến'] },
  empty: { names: ['Trống'] },
};

const DAY_COLUMNS = {
  date: { names: ['Ngày'], required: true },
  icon: { names: ['Icon'] },
  note: { names: ['Ghi chú'] },
};

const SHARED_COLUMNS = {
  title: { names: ['Tên'], required: true },
  icon: { names: ['Icon'] },
  budget: { names: ['Dự kiến'] },
  note: { names: ['Ghi chú'] },
};

const VN_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const SHEET_TIME = /^(\d{1,2}):(\d{2})(?::\d{2})?$/;
const YES = new Set(['true', 'x', 'có']);

// "16/10/2026" (Google Sheets, Vietnam) or "2026-10-16".
export function parseDate(text) {
  const match = VN_DATE.exec(text.trim());
  const iso = match ? `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}` : text.trim();
  return isDate(iso) ? iso : null;
}

// Sheets turns a typed "07:00" into "7:00:00" once the cell is a time.
export function parseTime(text) {
  const match = SHEET_TIME.exec(text.trim());
  if (!match) return null;
  const time = `${match[1].padStart(2, '0')}:${match[2]}`;
  return isTime(time) ? time : null;
}

// undefined: no budget. null: something unreadable was typed.
export function parseBudget(text) {
  const value = text.trim();
  if (value === '') return undefined;
  const digits = value.replace(/\D/g, '');
  if (!/^[\d.,\s]+(đ|vnd)?$/i.test(value) || digits === '') return null;
  return Number(digits);
}

export function parseFlag(text) {
  return YES.has(keyOf(text));
}

// Blank cells leave the field out, the way it would be missing from JSON.
const compact = (object) => Object.fromEntries(
  Object.entries(object).filter(([, value]) => value !== undefined && value !== ''),
);

// The three published tabs → the `days` and `fund.shared` buildTrip takes.
// A bad row is dropped (or loses only its budget) and reported by its sheet
// line; only a missing column throws.
export function readPlan({ items, days, shared }) {
  const itemRows = readTable(parseCsv(items), 'LichTrinh', ITEM_COLUMNS);
  const dayRows = readTable(parseCsv(days), 'Ngay', DAY_COLUMNS);
  const sharedRows = readTable(parseCsv(shared), 'ChiChung', SHARED_COLUMNS);

  const warnings = [];
  const warn = (table, line, message) => warnings.push(`${table} dòng ${line} · ${message}`);
  const reserved = `"${EXTRA_TITLE}" là tên dành riêng`;

  const byDate = new Map();
  const dayAt = (date) => {
    if (!byDate.has(date)) byDate.set(date, { date, items: [] });
    return byDate.get(date);
  };

  const titleLines = new Map();
  for (const row of itemRows) {
    const warnRow = (message) => warn('LichTrinh', row.line, message);
    const date = parseDate(row.date);
    if (!date) { warnRow(`Ngày "${row.date}" không hợp lệ`); continue; }
    const start = parseTime(row.start);
    if (!start) { warnRow(`Bắt đầu "${row.start}" không hợp lệ`); continue; }
    const end = parseTime(row.end);
    if (!end) { warnRow(`Kết thúc "${row.end}" không hợp lệ`); continue; }
    if (toMinutes(end) <= toMinutes(start)) { warnRow(`Kết thúc "${end}" phải sau Bắt đầu "${start}"`); continue; }
    if (!row.title) { warnRow('thiếu Tên'); continue; }
    if (keyOf(row.title) === keyOf(EXTRA_TITLE)) { warnRow(reserved); continue; }
    const titleKey = `${date} ${keyOf(row.title)}`;
    if (titleLines.has(titleKey)) { warnRow(`trùng tên "${row.title}" với dòng ${titleLines.get(titleKey)}`); continue; }
    titleLines.set(titleKey, row.line);

    const budget = parseBudget(row.budget);
    if (budget === null) warnRow(`Dự kiến "${row.budget}" không hợp lệ`);
    dayAt(date).items.push(compact({
      start, end, icon: row.icon, title: row.title, tag: row.tag, map: row.map,
      budget: budget ?? undefined,
      empty: parseFlag(row.empty) ? true : undefined,
    }));
  }

  const dateLines = new Map();
  for (const row of dayRows) {
    const date = parseDate(row.date);
    if (!date) { warn('Ngay', row.line, `Ngày "${row.date}" không hợp lệ`); continue; }
    if (dateLines.has(date)) { warn('Ngay', row.line, `trùng ngày ${row.date} với dòng ${dateLines.get(date)}`); continue; }
    dateLines.set(date, row.line);
    Object.assign(dayAt(date), compact({ icon: row.icon, note: row.note }));
  }

  const costLines = new Map();
  const costs = [];
  for (const row of sharedRows) {
    const warnRow = (message) => warn('ChiChung', row.line, message);
    if (!row.title) { warnRow('thiếu Tên'); continue; }
    const key = keyOf(row.title);
    if (key === keyOf(EXTRA_TITLE)) { warnRow(reserved); continue; }
    if (costLines.has(key)) { warnRow(`trùng tên "${row.title}" với dòng ${costLines.get(key)}`); continue; }
    costLines.set(key, row.line);
    const budget = parseBudget(row.budget);
    if (budget === null) warnRow(`Dự kiến "${row.budget}" không hợp lệ`);
    costs.push(compact({ title: row.title, icon: row.icon, budget: budget ?? undefined, note: row.note }));
  }

  return {
    days: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
    shared: costs,
    warnings,
  };
}
```

- [ ] **Step 5: Run tests**

Run: `node --test tests/plan.test.js`
Expected: PASS (7 tests). If `clean sheets…` fails on `plan.shared`, compare key sets — `fixture.fund.shared` entries have all four keys filled, so `compact` must keep them all.

Run: `npm test`
Expected: PASS, `# pass 90`.

- [ ] **Step 6: Commit**

```bash
git add js/model/plan.js tests/plan.test.js tests/helpers/sheets.js
git commit -m "feat: read schedule and shared costs from sheet CSV

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `planLinks`, `mergePlan` and the round trip

**Files:**
- Modify: `js/model/plan.js` (append), `tests/plan.test.js` (append + imports)

**Interfaces:**
- Consumes: `readPlan` (Task 2), `buildTrip` (`js/model/trip.js`), `sheetsOf`, `messySheets` (Task 2).
- Produces (`js/model/plan.js`):
  - `planLinks(json) → { items: string, days: string, shared: string } | null` — throws `plan: phải là object` / `plan.<tab>: phải là link https://docs.google.com/`.
  - `mergePlan(json, { days, shared }) → rawTrip` — new object; `days` replaced; `fund.shared` replaced only when `json.fund` exists; `json` not mutated.

- [ ] **Step 1: Write the failing tests**

Change the imports at the top of `tests/plan.test.js` to:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildTrip } from '../js/model/trip.js';
import { parseDate, parseTime, parseBudget, parseFlag, readPlan, mergePlan, planLinks } from '../js/model/plan.js';
import { sheetsOf, messySheets } from './helpers/sheets.js';
```

Append:

```js
const LINKS = {
  items: 'https://docs.google.com/spreadsheets/d/e/X/pub?gid=101&single=true&output=csv',
  days: 'https://docs.google.com/spreadsheets/d/e/X/pub?gid=102&single=true&output=csv',
  shared: 'https://docs.google.com/spreadsheets/d/e/X/pub?gid=103&single=true&output=csv',
};

test('planLinks reads the three published tab links', () => {
  assert.equal(planLinks({}), null);
  assert.deepEqual(planLinks({ plan: LINKS }), LINKS);
  assert.throws(() => planLinks({ plan: 'x' }), /plan: phải là object/);
  assert.throws(() => planLinks({ plan: { ...LINKS, days: 'https://evil.example/x.csv' } }), /plan\.days: phải là link https:\/\/docs\.google\.com\//);
  assert.throws(() => planLinks({ plan: { items: LINKS.items } }), /plan\.days: phải là link/);
});

test('mergePlan swaps in the sheet days and shared costs', () => {
  const plan = { days: [{ date: '2026-10-20', items: [] }], shared: [{ title: 'Vé' }] };
  const merged = mergePlan(fixture, plan);
  assert.equal(merged.days, plan.days);
  assert.equal(merged.fund.shared, plan.shared);
  assert.deepEqual(merged.fund.members, fixture.fund.members);
  assert.equal(merged.hero, fixture.hero);
  assert.equal(fixture.fund.shared.length, 3, 'trip.json is not mutated');
  const { fund, ...withoutFund } = fixture;
  assert.equal('fund' in mergePlan(withoutFund, plan), false);
});

test('round trip: the fixture through the sheets builds the same trip', () => {
  const { days, ...config } = fixture;
  const { shared, ...fundConfig } = fixture.fund;
  const json = { ...config, fund: fundConfig, plan: LINKS };
  assert.deepEqual(buildTrip(mergePlan(json, readPlan(sheetsOf(fixture)))), buildTrip(fixture));
});

test('messy sheets still build, from the kept rows only', () => {
  const trip = buildTrip(mergePlan(fixture, readPlan(messySheets(fixture))));
  assert.equal(trip.dayCount, 4);
  assert.equal(trip.days[1].items[0].title, 'Dậy sớm');
  assert.equal(trip.days[1].items[0].budget, null);
  assert.equal(trip.days[3].countText, 'Chưa có lịch');
  assert.ok(trip.fund.labels.includes('Day 4 · Phát sinh'));
  assert.equal(trip.fund.labels.filter((label) => label === 'Day 1 · Hidden Land').length, 1);
});
```

- [ ] **Step 2: Run to see it fail**

Run: `node --test tests/plan.test.js`
Expected: FAIL — `does not provide an export named 'mergePlan'`.

- [ ] **Step 3: Implement (append to `js/model/plan.js`)**

```js
const DOCS_URL = 'https://docs.google.com/';
const TABS = ['items', 'days', 'shared'];

// The published CSV links of the three tabs, or null when trip.json keeps
// its own days. Checked before anything is fetched.
export function planLinks(json) {
  const { plan } = json;
  if (plan == null) return null;
  if (typeof plan !== 'object') throw new Error('plan: phải là object');
  for (const tab of TABS) {
    if (typeof plan[tab] !== 'string' || !plan[tab].startsWith(DOCS_URL)) {
      throw new Error(`plan.${tab}: phải là link ${DOCS_URL}`);
    }
  }
  return { items: plan.items, days: plan.days, shared: plan.shared };
}

// trip.json with the sheet's days and shared costs in place of its own.
export function mergePlan(json, plan) {
  const merged = { ...json, days: plan.days };
  if (json.fund != null) merged.fund = { ...json.fund, shared: plan.shared };
  return merged;
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS, `# pass 94`. If the round trip fails, the diff names the first differing field — fix `readPlan`/`sheetsOf`, never the assertion.

- [ ] **Step 5: Commit**

```bash
git add js/model/plan.js tests/plan.test.js
git commit -m "feat: merge sheet plan into trip config

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Local copy, background refresh and `decide()`

**Files:**
- Create: `js/controllers/plan.js`, `tests/plan-cache.test.js`

**Interfaces:**
- Consumes: `fetchCsv` (`js/lib/csv.js`, Task 1).
- Produces (`js/controllers/plan.js`):
  - Constants `CACHE_KEY = 'plan-cache:v1'`, `RELOAD_KEY = 'plan-reloaded-at'`, `RELOAD_WINDOW_MS = 4000`, `RELOAD_GUARD_MS = 60_000`.
  - `Copy = { urls: { items, days, shared }, fetchedAt: number, items: string, days: string, shared: string }`.
  - `sameCopy(a: Copy, b: Copy) → boolean` (tabs only).
  - `decide({ cached, fresh, buildable, elapsedMs, lastReloadAt, canMark, now }) → 'none' | 'touch' | 'save' | 'reload' | 'toast'`.
  - `readCopy(storage, links) → Copy | null`; `writeCopy(storage, copy) → boolean`.
  - `readReloadMark(session) → { at: number | null, usable: boolean }`; `writeReloadMark(session, at) → boolean`.
  - `fetchPlan(links) → Promise<Copy>`.
  - `refreshPlan({ links, cached, storage, session, openedAt, build, onTouch, onToast, reload, fetchCopy?, now? }) → Promise<action>` — `build(copy)` throws when the copy cannot make a trip; `onTouch(fetchedAt)`; `onToast()`; `reload()`.

- [ ] **Step 1: Write the failing tests `tests/plan-cache.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CACHE_KEY, RELOAD_KEY, sameCopy, decide, readCopy, writeCopy, readReloadMark, writeReloadMark, refreshPlan,
} from '../js/controllers/plan.js';

const LINKS = { items: 'https://docs.google.com/i', days: 'https://docs.google.com/d', shared: 'https://docs.google.com/s' };
const copyOf = (items, fetchedAt = 1000) => ({ urls: LINKS, fetchedAt, items, days: 'D', shared: 'S' });
const OLD = copyOf('old');
const NEW = copyOf('new', 2000);
const NOW = 1_000_000;
const base = { cached: OLD, fresh: NEW, buildable: true, elapsedMs: 1000, lastReloadAt: null, canMark: true, now: NOW };

const memoryStorage = (entries = {}) => {
  const map = new Map(Object.entries(entries));
  return { map, getItem: (key) => (map.has(key) ? map.get(key) : null), setItem: (key, value) => { map.set(key, String(value)); } };
};
const brokenStorage = {
  getItem() { throw new Error('blocked'); },
  setItem() { throw new Error('blocked'); },
};

test('sameCopy compares the three tabs only', () => {
  assert.equal(sameCopy(OLD, { ...OLD, fetchedAt: 5 }), true);
  assert.equal(sameCopy(OLD, NEW), false);
  assert.equal(sameCopy(OLD, { ...OLD, shared: 'S2' }), false);
});

test('decide covers every row of the spec table', () => {
  assert.equal(decide({ ...base, fresh: null }), 'none');
  assert.equal(decide({ ...base, fresh: { ...OLD, fetchedAt: 9 } }), 'touch');
  assert.equal(decide({ ...base, buildable: false }), 'none');
  assert.equal(decide({ ...base, lastReloadAt: NOW - 59_000 }), 'save');
  assert.equal(decide({ ...base, lastReloadAt: NOW - 61_000 }), 'reload');
  assert.equal(decide({ ...base, elapsedMs: 4000 }), 'reload');
  assert.equal(decide({ ...base, elapsedMs: 4001 }), 'toast');
  assert.equal(decide({ ...base, canMark: false }), 'toast');
});

test('readCopy returns a stored copy only for the same links', () => {
  const storage = memoryStorage({ [CACHE_KEY]: JSON.stringify(OLD) });
  assert.deepEqual(readCopy(storage, LINKS), OLD);
  assert.equal(readCopy(storage, { ...LINKS, days: 'https://docs.google.com/other' }), null);
  assert.equal(readCopy(memoryStorage({ [CACHE_KEY]: '{broken' }), LINKS), null);
  assert.equal(readCopy(memoryStorage({ [CACHE_KEY]: JSON.stringify({ ...OLD, items: 5 }) }), LINKS), null);
  assert.equal(readCopy(memoryStorage(), LINKS), null);
  assert.equal(readCopy(brokenStorage, LINKS), null);
  assert.equal(readCopy(null, LINKS), null);
});

test('writeCopy and the reload mark never throw', () => {
  const storage = memoryStorage();
  assert.equal(writeCopy(storage, NEW), true);
  assert.deepEqual(JSON.parse(storage.map.get(CACHE_KEY)), NEW);
  assert.equal(writeCopy(brokenStorage, NEW), false);
  assert.equal(writeCopy(null, NEW), false);

  const session = memoryStorage();
  assert.deepEqual(readReloadMark(session), { at: null, usable: true });
  assert.equal(writeReloadMark(session, NOW), true);
  assert.deepEqual(readReloadMark(session), { at: NOW, usable: true });
  assert.deepEqual(readReloadMark(brokenStorage), { at: null, usable: false });
  assert.deepEqual(readReloadMark(null), { at: null, usable: false });
  assert.equal(writeReloadMark(brokenStorage, NOW), false);
});

const refresh = async (overrides = {}) => {
  const storage = memoryStorage({ [CACHE_KEY]: JSON.stringify(OLD) });
  const session = memoryStorage();
  const calls = { touch: [], toast: 0, reload: 0 };
  const action = await refreshPlan({
    links: LINKS,
    cached: OLD,
    storage,
    session,
    openedAt: NOW - 1000,
    now: () => NOW,
    fetchCopy: async () => NEW,
    build: () => {},
    onTouch: (at) => calls.touch.push(at),
    onToast: () => { calls.toast += 1; },
    reload: () => { calls.reload += 1; },
    ...overrides,
  });
  return { action, calls, storage, session };
};

const quietly = async (fn) => {
  const original = console.error;
  console.error = () => {};
  try {
    return await fn();
  } finally {
    console.error = original;
  }
};

test('refreshPlan reloads once for a quick change and marks it', async () => {
  const { action, calls, storage, session } = await refresh();
  assert.equal(action, 'reload');
  assert.equal(calls.reload, 1);
  assert.deepEqual(JSON.parse(storage.map.get(CACHE_KEY)), NEW);
  assert.equal(session.map.get(RELOAD_KEY), String(NOW));
});

test('refreshPlan touches, toasts, or keeps the old copy', async () => {
  const same = await refresh({ fetchCopy: async () => ({ ...OLD, fetchedAt: 7 }) });
  assert.equal(same.action, 'touch');
  assert.deepEqual(same.calls.touch, [7]);
  assert.equal(JSON.parse(same.storage.map.get(CACHE_KEY)).fetchedAt, 7);

  const slow = await refresh({ openedAt: NOW - 5000 });
  assert.equal(slow.action, 'toast');
  assert.equal(slow.calls.toast, 1);
  assert.equal(slow.calls.reload, 0);
  assert.deepEqual(JSON.parse(slow.storage.map.get(CACHE_KEY)), NEW);

  const offline = await quietly(() => refresh({ fetchCopy: async () => { throw new Error('offline'); } }));
  assert.equal(offline.action, 'none');
  assert.deepEqual(JSON.parse(offline.storage.map.get(CACHE_KEY)), OLD);

  const broken = await quietly(() => refresh({ build: () => { throw new Error('LichTrinh: thiếu cột "Tên"'); } }));
  assert.equal(broken.action, 'none');
  assert.deepEqual(JSON.parse(broken.storage.map.get(CACHE_KEY)), OLD);
  assert.equal(broken.calls.reload, 0);

  const blocked = await refresh({ session: brokenStorage });
  assert.equal(blocked.action, 'toast');
  assert.equal(blocked.calls.reload, 0);
});
```

- [ ] **Step 2: Run to see it fail**

Run: `node --test tests/plan-cache.test.js`
Expected: FAIL — `Cannot find module '…/js/controllers/plan.js'`.

- [ ] **Step 3: Implement `js/controllers/plan.js`**

```js
import { fetchCsv } from '../lib/csv.js';

export const CACHE_KEY = 'plan-cache:v1';
export const RELOAD_KEY = 'plan-reloaded-at';
export const RELOAD_WINDOW_MS = 4000;
export const RELOAD_GUARD_MS = 60_000;

const TABS = ['items', 'days', 'shared'];

export const sameCopy = (a, b) => TABS.every((tab) => a[tab] === b[tab]);

// What to do once a background fetch is back (spec §5.2). `cached` is on
// screen; `fresh` is null when the fetch failed.
export function decide({ cached, fresh, buildable, elapsedMs, lastReloadAt, canMark, now }) {
  if (!fresh) return 'none';
  if (sameCopy(cached, fresh)) return 'touch';
  if (!buildable) return 'none';
  // Google's edge caches may answer old and new copies in turn: at most one
  // reload a minute.
  if (lastReloadAt != null && now - lastReloadAt < RELOAD_GUARD_MS) return 'save';
  // Past the first seconds people are reading. Without a mark a reload could
  // loop, so ask instead.
  if (elapsedMs > RELOAD_WINDOW_MS || !canMark) return 'toast';
  return 'reload';
}

// A copy is only trusted for the links it was fetched from.
export function readCopy(storage, links) {
  try {
    const copy = JSON.parse(storage.getItem(CACHE_KEY));
    const valid = copy && Number.isFinite(copy.fetchedAt)
      && TABS.every((tab) => typeof copy[tab] === 'string' && copy.urls?.[tab] === links[tab]);
    return valid ? copy : null;
  } catch {
    return null;
  }
}

export function writeCopy(storage, copy) {
  try {
    storage.setItem(CACHE_KEY, JSON.stringify(copy));
    return true;
  } catch {
    return false;
  }
}

export function readReloadMark(session) {
  try {
    const at = Number(session.getItem(RELOAD_KEY));
    return { at: at > 0 ? at : null, usable: true };
  } catch {
    return { at: null, usable: false };
  }
}

export function writeReloadMark(session, at) {
  try {
    session.setItem(RELOAD_KEY, String(at));
    return true;
  } catch {
    return false;
  }
}

// All three tabs or nothing: never one new tab beside two old ones.
export async function fetchPlan(links) {
  const [items, days, shared] = await Promise.all(TABS.map((tab) => fetchCsv(links[tab])));
  return { urls: { ...links }, fetchedAt: Date.now(), items, days, shared };
}

// Runs after the page was built from `cached`. Returns the action taken.
export async function refreshPlan({
  links, cached, storage, session, openedAt, build, onTouch, onToast, reload,
  fetchCopy = fetchPlan, now = Date.now,
}) {
  let fresh = null;
  try {
    fresh = await fetchCopy(links);
  } catch (error) {
    console.error(error);
  }

  let buildable = false;
  if (fresh && !sameCopy(cached, fresh)) {
    try {
      build(fresh);
      buildable = true;
    } catch (error) {
      console.error(error);
    }
  }

  const mark = readReloadMark(session);
  const at = now();
  let action = decide({
    cached, fresh, buildable, elapsedMs: at - openedAt, lastReloadAt: mark.at, canMark: mark.usable, now: at,
  });

  if (action === 'touch') {
    writeCopy(storage, { ...cached, fetchedAt: fresh.fetchedAt });
    onTouch(fresh.fetchedAt);
  } else if (action !== 'none') {
    writeCopy(storage, fresh);
  }
  if (action === 'reload' && !writeReloadMark(session, at)) action = 'toast';
  if (action === 'reload') reload();
  if (action === 'toast') onToast();
  return action;
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS, `# pass 100`.

- [ ] **Step 5: Commit**

```bash
git add js/controllers/plan.js tests/plan-cache.test.js
git commit -m "feat: keep a local plan copy and decide on refresh

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Apps Script that syncs the Form dropdown

**Files:**
- Create: `scripts/apps-script/form-sync.js`, `tests/form-sync.test.js`

**Interfaces:**
- Consumes (tests only): `parseCsv`, `buildTrip`, `readPlan`, `mergePlan`, `sheetsOf`, `messySheets`.
- Produces (global functions in the Apps Script project):
  - `planLabels(itemValues: string[][], dayValues: string[][], sharedValues: string[][]) → string[]` — equal to `trip.fund.labels` the page builds from the same tabs.
  - `syncForm() → { changed: boolean, count: number }` — throws `Sheet chưa liên kết Google Form`, `Không tìm thấy tab "<Tab>"`, `Không tìm thấy câu hỏi "Địa điểm" (menu thả xuống)`, `<Tab>: thiếu cột "<Cột>"`.
  - `setup()`, `onOpen()`, `syncFromMenu()`.

- [ ] **Step 1: Write the failing tests `tests/form-sync.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parseCsv } from '../js/lib/csv.js';
import { buildTrip } from '../js/model/trip.js';
import { readPlan, mergePlan } from '../js/model/plan.js';
import { sheetsOf, messySheets } from './helpers/sheets.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/trip.json', import.meta.url), 'utf8'));
const source = readFileSync(new URL('../scripts/apps-script/form-sync.js', import.meta.url), 'utf8');
const FORM_URL = 'https://docs.google.com/forms/d/abc/edit';

const pageLabels = (sheets) => buildTrip(mergePlan(fixture, readPlan(sheets))).fund.labels;

// A fresh copy of the script, with fake Google services around it. Arrays
// the script returns come from another realm: spread them before deepEqual.
function load({ sheets = sheetsOf(fixture), formUrl = FORM_URL, questions = [['Người nhập', []], ['Địa điểm', ['cũ']]] } = {}) {
  const log = { set: [], opened: [], toasts: [], alerts: [], released: 0 };
  let triggers = [];
  const tabs = Object.fromEntries(Object.entries({ LichTrinh: sheets.items, Ngay: sheets.days, ChiChung: sheets.shared })
    .filter(([, csv]) => csv !== undefined));
  const items = questions.map(([title, initial]) => {
    let choices = [...initial];
    return {
      getTitle: () => title,
      asListItem: () => ({
        getChoices: () => choices.map((value) => ({ getValue: () => value })),
        setChoiceValues: (values) => {
          choices = [...values];
          log.set.push([...values]);
        },
      }),
    };
  });
  const spreadsheet = {
    getFormUrl: () => formUrl,
    getSheetByName: (name) => (name in tabs
      ? { getDataRange: () => ({ getDisplayValues: () => parseCsv(tabs[name]) }) }
      : null),
    toast: (message) => log.toasts.push(message),
  };
  const context = vm.createContext({
    SpreadsheetApp: {
      getActive: () => spreadsheet,
      getUi: () => ({
        alert: (message) => log.alerts.push(message),
        createMenu: () => ({ addItem() { return this; }, addToUi() {} }),
      }),
    },
    FormApp: {
      ItemType: { LIST: 'LIST' },
      openByUrl: (url) => {
        log.opened.push(url);
        return { getItems: () => items };
      },
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() { log.released += 1; } }) },
    ScriptApp: {
      getProjectTriggers: () => triggers,
      deleteTrigger: (trigger) => { triggers = triggers.filter((t) => t !== trigger); },
      newTrigger: (handler) => ({
        forSpreadsheet: () => ({
          onChange: () => ({
            create: () => {
              const trigger = { getHandlerFunction: () => handler };
              triggers.push(trigger);
              return trigger;
            },
          }),
        }),
      }),
    },
  });
  vm.runInContext(source, context);
  return { script: context, log, triggers: () => triggers };
}

test('the script names places exactly like the page, bad rows included', () => {
  for (const sheets of [sheetsOf(fixture), messySheets(fixture)]) {
    const { script } = load({ sheets });
    const labels = [...script.planLabels(parseCsv(sheets.items), parseCsv(sheets.days), parseCsv(sheets.shared))];
    assert.deepEqual(labels, pageLabels(sheets));
  }
  assert.equal(pageLabels(sheetsOf(fixture)).length, 28);
  assert.equal(pageLabels(messySheets(fixture)).length, 30);
});

test('syncForm writes the dropdown only when it differs', () => {
  const { script, log } = load();
  const first = script.syncForm();
  assert.equal(first.changed, true);
  assert.equal(first.count, 28);
  assert.deepEqual(log.set, [pageLabels(sheetsOf(fixture))]);
  assert.deepEqual(log.opened, [FORM_URL]);

  const second = script.syncForm();
  assert.equal(second.changed, false);
  assert.equal(log.set.length, 1);
  assert.equal(log.released, 2);
});

test('syncForm says what is missing and always releases the lock', () => {
  const unlinked = load({ formUrl: null });
  assert.throws(() => unlinked.script.syncForm(), /Sheet chưa liên kết Google Form/);
  assert.equal(unlinked.log.released, 1);
  assert.throws(() => load({ questions: [['Người nhập', []]] }).script.syncForm(), /Không tìm thấy câu hỏi "Địa điểm" \(menu thả xuống\)/);
  assert.throws(() => load({ sheets: { ...sheetsOf(fixture), days: undefined } }).script.syncForm(), /Không tìm thấy tab "Ngay"/);
  assert.throws(() => load({ sheets: { ...sheetsOf(fixture), items: 'Ngày,Tên\n16/10/2026,X' } }).script.syncForm(), /LichTrinh: thiếu cột "Bắt đầu"/);
});

test('setup installs one change trigger however often it runs', () => {
  const { script, triggers } = load();
  script.setup();
  script.setup();
  assert.equal(triggers().length, 1);
  assert.equal(triggers()[0].getHandlerFunction(), 'syncForm');
});

test('the menu reports the result or the error', () => {
  const ok = load();
  ok.script.syncFromMenu();
  ok.script.syncFromMenu();
  assert.deepEqual(ok.log.toasts, ['Đã cập nhật 28 địa điểm', 'Form đã khớp (28 địa điểm)']);

  const failing = load({ formUrl: null });
  failing.script.syncFromMenu();
  assert.deepEqual(failing.log.alerts, ['Không đồng bộ được Form: Sheet chưa liên kết Google Form']);
});
```

- [ ] **Step 2: Run to see it fail**

Run: `node --test tests/form-sync.test.js`
Expected: FAIL — `ENOENT … scripts/apps-script/form-sync.js`.

- [ ] **Step 3: Implement `scripts/apps-script/form-sync.js`**

```js
/**
 * Keeps the "Địa điểm" dropdown of the linked Google Form in step with the
 * LichTrinh / Ngay / ChiChung tabs.
 *
 * Install: Sheet → Tiện ích mở rộng → Apps Script → paste this file → run
 * setup() once and allow access. From then on every change to the sheet
 * syncs the Form within seconds; the "🔄 Đồng bộ Form" menu syncs on demand.
 *
 * The label rules mirror readPlan (js/model/plan.js) and buildFund
 * (js/model/trip.js); tests/form-sync.test.js runs this file against the
 * page code, so change them together. Plain script: no modules, no ?. / ??.
 */

const PLACE_QUESTION = 'Địa điểm';
const EXTRA_TITLE = 'Phát sinh';
const SHARED_GROUP = 'Chung';

// Same key as js/lib/text.js. Vietnamese has no locale-specific casing, so
// toLowerCase() matches toLocaleLowerCase('vi').
function keyOf(value) {
  return String(value == null ? '' : value).normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
}

const pad = (value) => String(value).padStart(2, '0');

// "16/10/2026" or "2026-10-16" → "2026-10-16"; null unless a real date.
function parseDate(text) {
  const vn = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  const iso = vn ? `${vn[3]}-${pad(vn[2])}-${pad(vn[1])}` : text;
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!parts) return null;
  const [year, month, day] = parts.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const real = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return real ? iso : null;
}

// "7:00", "07:00", "7:00:00" → minutes after midnight; null otherwise.
function parseMinutes(text) {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(text);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : null;
}

// Rows under the header as { line, field: text }; columns found by name,
// blank rows skipped, line = the row number seen in the sheet.
function readRows(values, table, columns) {
  const header = (values[0] || []).map(keyOf);
  const fields = Object.keys(columns);
  const at = {};
  for (const field of fields) {
    at[field] = header.indexOf(keyOf(columns[field]));
    if (at[field] === -1) throw new Error(`${table}: thiếu cột "${columns[field]}"`);
  }
  return values.slice(1)
    .map((cells, index) => ({ line: index + 2, cells }))
    .filter(({ cells }) => cells.some((cell) => String(cell).trim() !== ''))
    .map(({ line, cells }) => {
      const row = { line };
      for (const field of fields) {
        const cell = cells[at[field]];
        row[field] = String(cell == null ? '' : cell).trim();
      }
      return row;
    });
}

// The dropdown choices, in the order the page lists them: shared costs, the
// shared extra bucket, then each day's slots closed by its extra bucket.
function planLabels(itemValues, dayValues, sharedValues) {
  const itemRows = readRows(itemValues, 'LichTrinh', { date: 'Ngày', start: 'Bắt đầu', end: 'Kết thúc', title: 'Tên' });
  const dayRows = readRows(dayValues, 'Ngay', { date: 'Ngày' });
  const sharedRows = readRows(sharedValues, 'ChiChung', { title: 'Tên' });
  const extraKey = keyOf(EXTRA_TITLE);
  const labels = [];

  const costs = new Set();
  for (const row of sharedRows) {
    const key = keyOf(row.title);
    if (!key || key === extraKey || costs.has(key)) continue;
    costs.add(key);
    labels.push(`${SHARED_GROUP} · ${row.title}`);
  }
  labels.push(`${SHARED_GROUP} · ${EXTRA_TITLE}`);

  const days = new Map();
  const dayAt = (date) => {
    if (!days.has(date)) days.set(date, { items: [], titles: new Set() });
    return days.get(date);
  };
  for (const row of itemRows) {
    const date = parseDate(row.date);
    const start = parseMinutes(row.start);
    const end = parseMinutes(row.end);
    const key = keyOf(row.title);
    if (!date || start === null || end === null || end <= start || !key || key === extraKey) continue;
    const day = dayAt(date);
    if (day.titles.has(key)) continue;
    day.titles.add(key);
    day.items.push({ start, title: row.title });
  }
  for (const row of dayRows) {
    const date = parseDate(row.date);
    if (date) dayAt(date);
  }

  [...days.keys()].sort().forEach((date, index) => {
    const label = `Day ${index + 1}`;
    days.get(date).items.slice()
      .sort((a, b) => a.start - b.start)
      .forEach((item) => labels.push(`${label} · ${item.title}`));
    labels.push(`${label} · ${EXTRA_TITLE}`);
  });
  return labels;
}

function syncForm() {
  const lock = LockService.getScriptLock();
  // Runs queue up; each reads the sheet after taking the lock, so the last
  // edit always lands.
  lock.waitLock(30000);
  try {
    const spreadsheet = SpreadsheetApp.getActive();
    const formUrl = spreadsheet.getFormUrl();
    if (!formUrl) throw new Error('Sheet chưa liên kết Google Form');
    const valuesOf = (name) => {
      const sheet = spreadsheet.getSheetByName(name);
      if (!sheet) throw new Error(`Không tìm thấy tab "${name}"`);
      return sheet.getDataRange().getDisplayValues();
    };
    const labels = planLabels(valuesOf('LichTrinh'), valuesOf('Ngay'), valuesOf('ChiChung'));

    const question = FormApp.openByUrl(formUrl).getItems(FormApp.ItemType.LIST)
      .find((item) => keyOf(item.getTitle()) === keyOf(PLACE_QUESTION));
    if (!question) throw new Error(`Không tìm thấy câu hỏi "${PLACE_QUESTION}" (menu thả xuống)`);

    const list = question.asListItem();
    const current = list.getChoices().map((choice) => choice.getValue());
    // Form submissions fire the change trigger too: write only real changes.
    const changed = current.length !== labels.length || current.some((value, index) => value !== labels[index]);
    if (changed) list.setChoiceValues(labels);
    return { changed, count: labels.length };
  } finally {
    lock.releaseLock();
  }
}

function setup() {
  for (const trigger of ScriptApp.getProjectTriggers()) {
    if (trigger.getHandlerFunction() === 'syncForm') ScriptApp.deleteTrigger(trigger);
  }
  ScriptApp.newTrigger('syncForm').forSpreadsheet(SpreadsheetApp.getActive()).onChange().create();
  return syncForm();
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🔄 Đồng bộ Form')
    .addItem('Cập nhật danh sách địa điểm', 'syncFromMenu')
    .addToUi();
}

function syncFromMenu() {
  try {
    const result = syncForm();
    SpreadsheetApp.getActive().toast(
      result.changed ? `Đã cập nhật ${result.count} địa điểm` : `Form đã khớp (${result.count} địa điểm)`,
      'Đồng bộ Form',
    );
  } catch (error) {
    SpreadsheetApp.getUi().alert(`Không đồng bộ được Form: ${error.message}`);
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS, `# pass 105`. If the label test fails, print both arrays and find the first index that differs; fix the script, never the page.

- [ ] **Step 5: Commit**

```bash
git add scripts/apps-script/form-sync.js tests/form-sync.test.js
git commit -m "feat: add Apps Script that syncs the form place dropdown

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Verification harness (used by Tasks 6–9)

Scratch files, not committed. `$SCRATCH` = `/private/tmp/claude-501/-Users-huucao-Projects-huucao/cb38a259-0eac-49df-a45a-ec44fd9accbe/scratchpad`.

Start the server once (background) from the repo root: `python3 -m http.server 8765 --bind 127.0.0.1`. `B=http://127.0.0.1:8765/`.

`node $SCRATCH/shot.mjs <out-prefix> <url> <width> <mobile 0|1>`

- `ROUTES=<file.json>` — `[{ "match": "<substring of URL>", "file": "<path>", "delay": <ms>, "fail": true }]`; matching requests are answered from disk (with `Access-Control-Allow-Origin: *`) after `delay`, or failed; others go to the network.
- `INIT_FILE=<file.js>` — runs before any page script on every document (reloads included).
- `RUN=<js>` runs after `WAIT`, then waits 1500 ms (longer with `AFTER=<ms>`).
- `PROBE=<js expression>` prints its value last.
- `SHOT=1` saves `<out-prefix>.png`. `MOTION=1` keeps animations (default: reduced motion). `WAIT=<ms>` after navigation (default 4000).
- Prints `navigations=N` (main-frame loads, so 2 = the page reloaded once), `scrollWidth`, uncaught exceptions and `console.error` lines. `console.error` about the fund's real Google CSV is expected noise; anything else is a failure.

`$SCRATCH/shot.mjs`:

```js
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const [out, url, width = '390', mobile = '1'] = process.argv.slice(2);
const W = Number(width);
const H = mobile === '1' ? 844 : 900;
const here = dirname(fileURLToPath(import.meta.url));
const routes = process.env.ROUTES ? JSON.parse(readFileSync(process.env.ROUTES, 'utf8')) : [];
const port = 9300 + Math.floor(Math.random() * 500);
const dir = mkdtempSync(join(here, 'prof-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${port}`,
  `--user-data-dir=${dir}`, 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets;
for (let i = 0; i < 50; i++) {
  try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break; } catch { await sleep(200); }
}
const page = targets.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const evalJs = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;

let navigations = 0;
ws.addEventListener('message', (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  if (msg.method === 'Runtime.exceptionThrown') {
    const d = msg.params.exceptionDetails;
    console.log('exception:', d.exception?.description ?? d.text);
  }
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
    console.log('console.error:', msg.params.args.map((a) => a.value ?? a.description).join(' '));
  }
  if (msg.method === 'Page.frameNavigated' && !msg.params.frame.parentId) navigations += 1;
  if (msg.method === 'Fetch.requestPaused') {
    const { requestId, request } = msg.params;
    const route = routes.find((r) => request.url.includes(r.match));
    if (!route) { send('Fetch.continueRequest', { requestId }); return; }
    setTimeout(() => {
      if (route.fail) { send('Fetch.failRequest', { requestId, errorReason: 'InternetDisconnected' }); return; }
      send('Fetch.fulfillRequest', {
        requestId,
        responseCode: 200,
        responseHeaders: [
          { name: 'Content-Type', value: route.file.endsWith('.json') ? 'application/json; charset=utf-8' : 'text/csv; charset=utf-8' },
          { name: 'Access-Control-Allow-Origin', value: '*' },
        ],
        body: readFileSync(route.file).toString('base64'),
      });
    }, route.delay ?? 0);
  }
});

await send('Page.enable');
await send('Runtime.enable');
if (routes.length) await send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: mobile === '1' });
if (process.env.MOTION !== '1') {
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
}
if (process.env.INIT_FILE) await send('Page.addScriptToEvaluateOnNewDocument', { source: readFileSync(process.env.INIT_FILE, 'utf8') });
await send('Page.navigate', { url });
await sleep(Number(process.env.WAIT ?? 4000));
if (process.env.RUN) { await evalJs(process.env.RUN); await sleep(Number(process.env.AFTER ?? 1500)); }
console.log(`navigations=${navigations} scrollWidth=${await evalJs('document.documentElement.scrollWidth')} viewport=${W}`);
if (process.env.PROBE) console.log('probe:', JSON.stringify(await evalJs(process.env.PROBE)));
if (process.env.SHOT === '1') {
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${out}.png`, Buffer.from(shot.result.data, 'base64'));
}
ws.close();
chrome.kill();
await sleep(300);
try { rmSync(dir, { recursive: true, force: true }); } catch {}
process.exit(0);
```

JS passed through the shell is wrapped in single quotes and uses only double quotes inside.

---

### Task 6: Warning banner, update toast, footer stamp

Views and styles only; wired into the page in Task 7. Checked by mounting them on the current page from the harness.

**Files:**
- Create: `js/views/plan-warnings.js`, `js/views/update-toast.js`
- Modify: `js/views/footer.js`, `js/views/fund.js:336` (class name), `css/base.css` (append), `css/fund.css:391-401`, `css/motion/keyframes.css` (append)

**Interfaces:**
- Consumes: `h` (`js/lib/dom.js`), `clockText` (`js/lib/time.js`, Task 1).
- Produces:
  - `renderPlanWarnings(warnings: string[], sheet: string | null) → HTMLDetailsElement | null` (null when no warnings).
  - `createUpdateToast() → { element: HTMLElement, show(): void }` — starts hidden.
  - `renderFooter(footer, stamp?: HTMLElement | null) → HTMLElement`.
  - `createPlanStamp(fetchedAt: number) → { element: HTMLElement, set(ms: number): void }`.
  - CSS classes: `.warn-box` (shared with the fund tab), `.plan-warn`, `.plan-warn-link`, `.update-toast`, `.footer-stamp`.

- [ ] **Step 1: Create `js/views/plan-warnings.js`**

```js
import { h } from '../lib/dom.js';

const LINK = { target: '_blank', rel: 'noopener noreferrer' };

// Sheet rows the schedule had to skip, shown above every tab so whoever
// opens the page can go and fix them.
export function renderPlanWarnings(warnings, sheet) {
  if (warnings.length === 0) return null;
  return h('details', { class: 'warn-box plan-warn' },
    h('summary', { text: `⚠️ Lịch trình có ${warnings.length} dòng lỗi` }),
    h('ul', {}, warnings.map((text) => h('li', { text }))),
    sheet ? h('a', { class: 'plan-warn-link', href: sheet, ...LINK }, 'Mở Sheet') : null);
}
```

- [ ] **Step 2: Create `js/views/update-toast.js`**

```js
import { h } from '../lib/dom.js';

// Offered when a newer schedule arrived after people started reading
// (controllers/plan.js), instead of reloading under them.
export function createUpdateToast() {
  const reload = h('button', { class: 'update-toast-reload', type: 'button' }, 'Tải lại');
  const close = h('button', { class: 'update-toast-close', type: 'button', 'aria-label': 'Đóng' }, '✕');
  const element = h('div', { class: 'update-toast', role: 'status', hidden: true },
    h('span', { class: 'update-toast-text', text: '🔄 Lịch trình vừa thay đổi' }), reload, close);

  reload.addEventListener('click', () => window.location.reload());
  close.addEventListener('click', () => { element.hidden = true; });

  return {
    element,
    show() {
      element.hidden = false;
    },
  };
}
```

- [ ] **Step 3: Replace `js/views/footer.js`**

```js
import { h } from '../lib/dom.js';
import { clockText } from '../lib/time.js';

export function renderFooter(footer, stamp = null) {
  return h('footer', { class: 'footer' },
    footer.title,
    footer.note ? [h('br'), h('small', { text: footer.note })] : null,
    stamp ? [h('br'), stamp] : null);
}

// "Lịch trình cập nhật 14:05": when the sheet copy on screen was fetched.
export function createPlanStamp(fetchedAt) {
  const element = h('small', { class: 'footer-stamp' });
  const set = (ms) => {
    element.textContent = `Lịch trình cập nhật ${clockText(ms)}`;
  };
  set(fetchedAt);
  return { element, set };
}
```

- [ ] **Step 4: Share the warning style**

In `css/fund.css` delete the `.fund-warn { … }` block and the `.fund-warn ul { … }` line (lines 391–401); keep `.fund-warn-line`.

In `js/views/fund.js` `renderWarnings`, change `class: 'fund-warn'` to `class: 'warn-box'`.

Append to `css/base.css` (before the `@media (min-width: 761px)` block at the end):

```css
/* Rows to fix in the sheet: the fund tab's warnings and the schedule's. */
.warn-box {
  margin-top: 14px;
  padding: 10px 14px;
  border: 1px solid #e6c9c3;
  border-radius: 12px;
  background: #fbf1ef;
  color: #7a3b2e;
  font-size: 12.5px;
}

.warn-box ul { margin: 6px 0 0; padding-left: 18px; }

/* The summary is the tap target: at least 44px tall inside the box padding. */
.plan-warn summary {
  margin: -10px 0;
  padding: 13px 0;
  font-weight: 700;
  cursor: pointer;
}

.plan-warn[open] summary { margin-bottom: 0; }

.plan-warn-link {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  font-weight: 700;
  color: inherit;
}

/* Above the floating "+ Nhập chi" button (phones) and the now hint. Outside
   <main>, like them, so position: fixed holds. */
.update-toast {
  position: fixed;
  left: 50%;
  bottom: calc(84px + env(safe-area-inset-bottom));
  z-index: 26;
  display: flex;
  align-items: center;
  gap: 4px;
  width: max-content;
  max-width: calc(100% - 32px);
  padding: 4px 4px 4px 16px;
  border-radius: 99px;
  background: var(--primary);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  box-shadow: 0 8px 24px rgba(16, 30, 25, .3);
  transform: translateX(-50%);
}

.update-toast-text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.update-toast button {
  min-height: 44px;
  border: 0;
  border-radius: 99px;
  font: inherit;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.update-toast-reload { padding: 0 16px; background: var(--live); color: var(--live-ink); }
.update-toast-close { width: 44px; background: transparent; color: #fff; }
.update-toast button:focus-visible { outline: 2px solid var(--live); outline-offset: 2px; }

@media (prefers-reduced-motion: no-preference) {
  .update-toast:not([hidden]) { animation: toast-in .24s ease-out both; }
}
```

Append to `css/motion/keyframes.css` (first run `grep -n 'toast-in' css/motion/keyframes.css` — must print nothing):

```css
/* ---------- UPDATE TOAST (base.css) ---------- */
/* Opacity only: the toast's own transform centres it. */
@keyframes toast-in {
  from { opacity: 0; }
}
```

- [ ] **Step 5: Unit tests still pass**

Run: `npm test`
Expected: PASS, `# pass 105`.

- [ ] **Step 6: Mount the views on the live page and measure (iPhone)**

```bash
RUN='Promise.all([import("/js/views/plan-warnings.js"), import("/js/views/update-toast.js"), import("/js/views/footer.js")]).then(([w, t, f]) => { document.querySelector("main").prepend(w.renderPlanWarnings(["LichTrinh dòng 7 · thiếu Tên", "Ngay dòng 3 · trùng ngày 16/10/2026 với dòng 2"], "https://docs.google.com/spreadsheets/d/x/edit")); const toast = t.createUpdateToast(); document.body.append(toast.element); toast.show(); document.querySelector(".footer").append(f.createPlanStamp(Date.now()).element); window.scrollTo(0, 0); })' \
PROBE='(() => { const toast = document.querySelector(".update-toast").getBoundingClientRect(); const fab = document.querySelector(".fab"); const box = document.querySelector(".plan-warn"); return { toastBottom: Math.round(toast.bottom), fabTop: fab ? Math.round(fab.getBoundingClientRect().top) : null, toastHeight: Math.round(toast.height), summaryHeight: Math.round(box.querySelector("summary").getBoundingClientRect().height), background: getComputedStyle(box).backgroundColor, stamp: document.querySelector(".footer-stamp").textContent }; })()' \
SHOT=1 node $SCRATCH/shot.mjs $SCRATCH/t6-phone http://127.0.0.1:8765/ 390 1
```

Expected: `scrollWidth=390`; `toastBottom` ≤ `fabTop`; `toastHeight` ≥ 44; `summaryHeight` ≥ 44; `background` = `rgb(251, 241, 239)`; `stamp` matches `Lịch trình cập nhật HH:MM`; no exception. Open `$SCRATCH/t6-phone.png`: banner above the tabs' content, toast centred above the green `+ Nhập chi` button, text not cut.

Repeat with `390 1` replaced by `1280 0` (`$SCRATCH/t6-desktop`): `scrollWidth=1280`, `fabTop` = null or the fab hidden, toast centred.

- [ ] **Step 7: Commit**

```bash
git add js/views/plan-warnings.js js/views/update-toast.js js/views/footer.js js/views/fund.js css/base.css css/fund.css css/motion/keyframes.css
git commit -m "feat: add plan warning banner, update toast and footer stamp

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Load the plan in `main.js`

**Files:**
- Modify: `js/main.js` (full replacement below)
- Scratch: `$SCRATCH/make-fixtures.mjs`, `$SCRATCH/fx/*`

**Interfaces:**
- Consumes: `planLinks`, `readPlan`, `mergePlan` (Tasks 2–3); `fetchPlan`, `readCopy`, `writeCopy`, `refreshPlan` (Task 4); `renderPlanWarnings`, `createUpdateToast`, `renderFooter`, `createPlanStamp` (Task 6).
- Produces: page behaviour of spec §5.1–5.2 and §6. `mount()` returns `stamp` and `toast` in addition to today's fields.

- [ ] **Step 1: Replace `js/main.js`**

```js
import { buildTrip } from './model/trip.js';
import { planLinks, readPlan, mergePlan } from './model/plan.js';
import { buildCalendar } from './model/calendar.js';
import { createClock } from './lib/clock.js';
import { h } from './lib/dom.js';
import { renderHero } from './views/hero.js';
import { renderTabs } from './views/tabs.js';
import { renderDay } from './views/day.js';
import { createCalendar } from './views/calendar.js';
import { createCountdown } from './views/countdown.js';
import { createNowHint } from './views/now-hint.js';
import { createFundView } from './views/fund.js';
import { renderFooter, createPlanStamp } from './views/footer.js';
import { renderPlanWarnings } from './views/plan-warnings.js';
import { createUpdateToast } from './views/update-toast.js';
import { renderError } from './views/error.js';
import { createTabs } from './controllers/tabs.js';
import { startStatus } from './controllers/status.js';
import { startCalendar } from './controllers/calendar.js';
import { startFund } from './controllers/fund.js';
import { startReveal } from './controllers/reveal.js';
import { startScrollFx } from './controllers/scroll-fx.js';
import { fetchPlan, readCopy, writeCopy, refreshPlan } from './controllers/plan.js';

const DATA_URL = 'data/trip.json';

async function loadJson() {
  const response = await fetch(DATA_URL);
  if (!response.ok) throw new Error(`${DATA_URL}: HTTP ${response.status}`);
  return response.json();
}

// Reading web storage throws where site data is blocked; the page then just
// remembers nothing (list/calendar choice, plan copy, reload mark).
function safeStorage(name) {
  try {
    return window[name];
  } catch {
    return null;
  }
}

// The trip, and the sheet rows it had to skip, from one copy of the tabs.
// Throws when the copy cannot make a trip (a lost column, no valid slot).
function buildFrom(json, copy) {
  const plan = readPlan(copy);
  return { trip: buildTrip(mergePlan(json, plan)), warnings: plan.warnings };
}

function mount(app, trip, clock, plan) {
  const hero = renderHero(trip.hero);
  const countdown = createCountdown();
  const fund = trip.fund ? createFundView({ trip, clock }) : null;
  // The status is about the whole trip, so it sits between the hero and the
  // day tabs; the tabs stay right above the content they switch.
  const status = h('div', { class: fund ? 'status wrap has-fund' : 'status wrap' }, countdown.element, fund?.statusRow);
  const tabbar = renderTabs(trip.days, { fund: Boolean(fund) });
  const calModel = buildCalendar(trip);
  const calendar = createCalendar(calModel);
  const panels = [...trip.days.map((day) => renderDay(day, { fund: Boolean(fund) })), calendar.panel, fund?.panel].filter(Boolean);
  // Only with a sheet plan: rows to fix above every tab, and when the copy
  // on screen was fetched.
  const stamp = plan ? createPlanStamp(plan.fetchedAt) : null;
  const warnings = plan ? renderPlanWarnings(plan.warnings, trip.fund?.sheet ?? null) : null;
  const main = h('main', { class: fund?.fab ? 'wrap has-fab' : 'wrap' }, warnings, panels, renderFooter(trip.footer, stamp?.element));
  // Fixed-position pieces live outside <main>: an animated ancestor would
  // break position: fixed.
  const hint = createNowHint();
  const toast = plan ? createUpdateToast() : null;

  app.replaceChildren(...[hero, status, tabbar, main, fund?.fab, hint.element, toast?.element].filter(Boolean));
  return { hero, tabbar, countdown, panels, main, fund, hint, calendar, calModel, stamp, toast };
}

// Builds the page and starts everything that runs on it.
function run(app, trip, plan) {
  const clock = createClock(window.location.search);
  const view = mount(app, trip, clock, plan);

  // Same task as mount(), before the next paint (see startReveal).
  const reveal = startReveal(view.main);
  startScrollFx({
    bar: document.querySelector('.progress'),
    bg: view.hero.querySelector('.hero-bg'),
    inner: view.hero.querySelector('.hero-inner'),
    thumbs: view.hero.querySelector('.hero-thumbs'),
  });

  const tabs = createTabs(view.tabbar.querySelector('[role="tablist"]'), view.panels, {
    onChange: (shown) => {
      shown.forEach((panel) => reveal.replay(panel));
      if (shown.includes(view.calendar.panel)) view.calendar.scrollToNow();
    },
    storage: safeStorage('localStorage'),
  });
  const status = startStatus({
    trip, root: view.main, countdown: view.countdown, tabs, clock, hint: view.hint,
    calendar: view.calendar, calModel: view.calModel, reveal,
  });
  startCalendar({ view: view.calendar, tabs, show: status.show, tabbar: view.tabbar });
  // The fund never takes the schedule down with it.
  if (view.fund) {
    try {
      startFund({ trip, view: view.fund, clock });
    } catch (error) {
      console.error(error);
      view.fund.fail(error.message);
    }
  }
  return view;
}

async function start() {
  const app = document.getElementById('app');

  try {
    const json = await loadJson();
    const links = planLinks(json);
    if (!links) {
      run(app, buildTrip(json), null);
      return;
    }

    // Spec §5.1: a saved copy shows at once and is checked in the background;
    // without one the page waits for the sheet.
    const storage = safeStorage('localStorage');
    const cached = readCopy(storage, links);
    let shown = null;
    if (cached) {
      try {
        shown = buildFrom(json, cached);
      } catch (error) {
        // Saved under older rules: fetch a new copy instead.
        console.error(error);
      }
    }

    if (!shown) {
      const copy = await fetchPlan(links);
      const built = buildFrom(json, copy);
      writeCopy(storage, copy);
      run(app, built.trip, { warnings: built.warnings, fetchedAt: copy.fetchedAt });
      return;
    }

    const view = run(app, shown.trip, { warnings: shown.warnings, fetchedAt: cached.fetchedAt });
    refreshPlan({
      links,
      cached,
      storage,
      session: safeStorage('sessionStorage'),
      openedAt: Date.now(),
      build: (copy) => buildFrom(json, copy),
      onTouch: (fetchedAt) => view.stamp.set(fetchedAt),
      onToast: () => view.toast.show(),
      reload: () => window.location.reload(),
    }).catch((error) => console.error(error));
  } catch (error) {
    console.error(error);
    app.replaceChildren(h('main', { class: 'wrap' }, renderError(error.message)));
  }
}

start();
```

- [ ] **Step 2: Unit tests**

Run: `npm test`
Expected: PASS, `# pass 105`.

- [ ] **Step 3: Page without `plan` is unchanged**

```bash
PROBE='({ items: document.querySelectorAll(".timeline > .item").length, warn: !!document.querySelector(".plan-warn"), stamp: !!document.querySelector(".footer-stamp"), toast: !!document.querySelector(".update-toast") })' \
node $SCRATCH/shot.mjs $SCRATCH/t7-noplan http://127.0.0.1:8765/ 390 1
```

Expected: `navigations=1 scrollWidth=390`; probe `{"items":21,"warn":false,"stamp":false,"toast":false}`; no exception.

- [ ] **Step 4: Write and run the fixture generator**

`$SCRATCH/make-fixtures.mjs`:

```js
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { sheetsOf, messySheets } from '/Users/huucao/Projects/huucao/tests/helpers/sheets.js';

const out = process.argv[2];
mkdirSync(out, { recursive: true });
const write = (name, text) => writeFileSync(`${out}/${name}`, text);
const fixture = JSON.parse(readFileSync('/Users/huucao/Projects/huucao/tests/fixtures/trip.json', 'utf8'));

const tab = (gid) => `https://docs.google.com/spreadsheets/d/e/TEST/pub?gid=${gid}&single=true&output=csv`;
const LINKS = { items: tab(101), days: tab(102), shared: tab(103) };

// trip.json as it will look after Task 9. The fund's own CSV links are left
// out so the fund stays "unlinked" and makes no network noise.
const { days, ...config } = fixture;
const { shared, csv, ...fund } = fixture.fund;
write('trip-plan.json', JSON.stringify({ ...config, fund, plan: LINKS }));

const clean = sheetsOf(fixture);
const renamed = sheetsOf({
  ...fixture,
  days: fixture.days.map((day) => ({
    ...day,
    items: day.items.map((item) => (item.title === 'Hidden Land' ? { ...item, title: 'Hidden Land 2' } : item)),
  })),
});
const messy = messySheets(fixture);
write('items.csv', clean.items);
write('days.csv', clean.days);
write('shared.csv', clean.shared);
write('items-renamed.csv', renamed.items);
write('messy-items.csv', messy.items);
write('messy-days.csv', messy.days);
write('messy-shared.csv', messy.shared);
write('bad-items.csv', 'Ngày,Bắt đầu,Kết thúc,Tên\n32/10/2026,08:00,09:00,X\n');

// Seeds the clean copy (fetched an hour ago) once per tab, so a reload keeps
// whatever the page saved.
const copy = { urls: LINKS, fetchedAt: Date.now() - 3_600_000, ...clean };
write('init-seed.js', `if (!sessionStorage.getItem("seeded")) { localStorage.setItem("plan-cache:v1", ${JSON.stringify(JSON.stringify(copy))}); sessionStorage.setItem("seeded", "1"); }`);

const route = (match, file, extra = {}) => ({ match, file: `${out}/${file}`, ...extra });
const json = route('data/trip.json', 'trip-plan.json');
const sheets = (items, extra = {}) => [
  json, route('gid=101', items, extra), route('gid=102', 'days.csv', extra), route('gid=103', 'shared.csv', extra),
];
const routes = {
  clean: sheets('items.csv'),
  renamed: sheets('items-renamed.csv'),
  'renamed-slow': sheets('items-renamed.csv', { delay: 6000 }),
  offline: [json, route('gid=10', 'items.csv', { fail: true })],
  messy: [json, route('gid=101', 'messy-items.csv'), route('gid=102', 'messy-days.csv'), route('gid=103', 'messy-shared.csv')],
  bad: sheets('bad-items.csv'),
};
for (const [name, list] of Object.entries(routes)) write(`routes-${name}.json`, JSON.stringify(list));
console.log(`fixtures in ${out}`);
```

Run: `node $SCRATCH/make-fixtures.mjs $SCRATCH/fx`
Expected: `fixtures in …/fx`; `ls $SCRATCH/fx` lists 8 CSV, `trip-plan.json`, `init-seed.js`, 6 `routes-*.json`.

`FX=$SCRATCH/fx`. Common probe used below:

```bash
P='({ items: document.querySelectorAll(".timeline > .item").length, renamed: document.body.textContent.includes("Hidden Land 2"), warn: document.querySelector(".plan-warn summary")?.textContent ?? null, stamp: document.querySelector(".footer-stamp")?.textContent ?? null, toast: document.querySelector(".update-toast") ? !document.querySelector(".update-toast").hidden : null, error: document.querySelector(".load-error")?.textContent ?? null, cacheRenamed: (localStorage.getItem("plan-cache:v1") ?? "").includes("Hidden Land 2"), reloadMark: sessionStorage.getItem("plan-reloaded-at") })'
```

- [ ] **Step 5: First open, no copy (spec §9.2 #1, #10)**

```bash
ROUTES=$FX/routes-clean.json PROBE="$P" node $SCRATCH/shot.mjs $SCRATCH/t7-first http://127.0.0.1:8765/ 390 1
PROBE='[document.querySelector(".fund-panel")?.textContent.includes("Vé xe 2 chiều"), localStorage.getItem("plan-cache:v1") !== null]' ROUTES=$FX/routes-clean.json node $SCRATCH/shot.mjs $SCRATCH/t7-first-fund http://127.0.0.1:8765/ 390 1
```

Expected: `navigations=1 scrollWidth=390`; `items: 21, renamed: false, warn: null, stamp: "Lịch trình cập nhật HH:MM", toast: false, error: null`; second probe `[true,true]`; no `console.error`.

- [ ] **Step 6: Saved copy, sheet unchanged → touch (§9.2 #2)**

```bash
INIT_FILE=$FX/init-seed.js ROUTES=$FX/routes-clean.json \
PROBE='document.querySelector(".footer-stamp").textContent === "Lịch trình cập nhật " + new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })' \
node $SCRATCH/shot.mjs $SCRATCH/t7-touch http://127.0.0.1:8765/ 390 1
```

Expected: `navigations=1`; probe `true` (the stamp moved from an hour ago to now; rerun if it straddled a minute).

- [ ] **Step 7: Changed sheet, answered quickly → one reload (§9.2 #3)**

```bash
INIT_FILE=$FX/init-seed.js ROUTES=$FX/routes-renamed.json WAIT=6000 PROBE="$P" \
node $SCRATCH/shot.mjs $SCRATCH/t7-reload http://127.0.0.1:8765/ 390 1
```

Expected: `navigations=2`; `items: 21, renamed: true, toast: false, cacheRenamed: true`, `reloadMark` a number string.

- [ ] **Step 8: Changed sheet, answered slowly → shown at once, then toast (§9.2 #2, #4)**

```bash
INIT_FILE=$FX/init-seed.js ROUTES=$FX/routes-renamed-slow.json WAIT=1500 \
RUN='window.__early = document.querySelectorAll(".timeline > .item").length' AFTER=7000 \
PROBE="({ early: window.__early, ...$P })" SHOT=1 \
node $SCRATCH/shot.mjs $SCRATCH/t7-toast http://127.0.0.1:8765/ 390 1
```

Expected: `navigations=1`; `early: 21` (page built from the copy before the sheet answered); `renamed: false, toast: true, cacheRenamed: true, reloadMark: null`. `$SCRATCH/t7-toast.png`: toast above `+ Nhập chi`.

Then tap `Tải lại`:

```bash
INIT_FILE=$FX/init-seed.js ROUTES=$FX/routes-renamed-slow.json WAIT=8000 \
RUN='document.querySelector(".update-toast-reload").click()' AFTER=3000 PROBE="$P" \
node $SCRATCH/shot.mjs $SCRATCH/t7-toast-tap http://127.0.0.1:8765/ 390 1
```

Expected: `navigations=2`; `renamed: true`.

- [ ] **Step 9: Offline (§9.2 #5, #6)**

```bash
INIT_FILE=$FX/init-seed.js ROUTES=$FX/routes-offline.json PROBE="$P" node $SCRATCH/shot.mjs $SCRATCH/t7-offline-copy http://127.0.0.1:8765/ 390 1
ROUTES=$FX/routes-offline.json PROBE="$P" node $SCRATCH/shot.mjs $SCRATCH/t7-offline-none http://127.0.0.1:8765/ 390 1
```

Expected, with copy: `navigations=1`; `items: 21, toast: false, warn: null, error: null`; one `console.error: TypeError: Failed to fetch` line.
Expected, without copy: `error` starts with `Không tải được lịch trình`; `items: 0`.

- [ ] **Step 10: Bad rows (§9.2 #7) and nothing valid (§9.2 #8)**

```bash
ROUTES=$FX/routes-messy.json RUN='document.querySelector(".plan-warn").open = true; window.scrollTo(0, document.querySelector(".plan-warn").getBoundingClientRect().top + scrollY - 80)' \
PROBE='({ ...'"$P"', lines: document.querySelectorAll(".plan-warn li").length, link: document.querySelector(".plan-warn-link")?.href })' SHOT=1 \
node $SCRATCH/shot.mjs $SCRATCH/t7-messy http://127.0.0.1:8765/ 390 1
ROUTES=$FX/routes-bad.json PROBE="$P" node $SCRATCH/shot.mjs $SCRATCH/t7-bad-none http://127.0.0.1:8765/ 390 1
INIT_FILE=$FX/init-seed.js ROUTES=$FX/routes-bad.json PROBE="$P" node $SCRATCH/shot.mjs $SCRATCH/t7-bad-copy http://127.0.0.1:8765/ 390 1
```

Expected, messy: `items: 22` (21 + `Dậy sớm`), `warn: "⚠️ Lịch trình có 11 dòng lỗi"`, `lines: 11`, `link` = the fixture's `fund.sheet`; screenshot shows the open list.
Expected, bad without copy: `error` contains `days: cần ít nhất 1 khung giờ`.
Expected, bad with copy: `navigations=1`; `items: 21, toast: false, cacheRenamed: false`; one `console.error` naming `cần ít nhất 1 khung giờ`.

- [ ] **Step 11: Desktop**

Repeat Steps 5, 8 (first command) and 10 (messy) with `1280 0` instead of `390 1`. Expected: `scrollWidth=1280`, same probe values; toast centred at the bottom, not over the now hint.

- [ ] **Step 12: Commit**

```bash
git add js/main.js
git commit -m "feat: load schedule from sheet with local copy and refresh

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: README, drop `form-options`

**Files:**
- Modify: `README.md`, `package.json`
- Delete: `scripts/form-options.js`

**Interfaces:** none (docs and cleanup). The Apps Script replaces `npm run form-options`.

- [ ] **Step 1: Remove the old script**

```bash
git rm scripts/form-options.js
```

In `package.json` delete the line `"form-options": "node scripts/form-options.js"` and the trailing comma on the `"dev"` line before it.

Run: `grep -rn 'form-options' --exclude-dir=.git --exclude-dir=docs .`
Expected: only hits in `README.md` (fixed below).

- [ ] **Step 2: README intro (line 7)**

Replace

```md
Toàn bộ nội dung nằm trong một file dữ liệu `data/trip.json`. Trang tự dựng giao diện, tự tính số liệu và tự cập nhật theo thời gian thực. Không có build step, không có dependency.
```

with

```md
Lịch trình và chi phí chung nằm trong Google Sheet — sửa trên điện thoại, trang tự cập nhật, không cần đụng code. Phần ít đổi (hero, footer, thành viên, link) nằm trong `data/trip.json`. Trang tự dựng giao diện, tự tính số liệu và tự cập nhật theo thời gian thực. Không có build step, không có dependency.
```

- [ ] **Step 3: README §8 "Dữ liệu và xử lý lỗi"**

Replace the whole bullet list under `### 8. Dữ liệu và xử lý lỗi` with:

```md
- **Sửa lịch trình trong Google Sheet** (tab `LichTrinh`, `Ngay`, `ChiChung`) — xem [Sửa lịch trình](#sửa-lịch-trình). Dropdown `Địa điểm` của Form tự khớp theo.
- **Mở nhanh, mất sóng vẫn xem được:** trang hiện ngay bản lưu gần nhất trên máy rồi tải Sheet ngầm. Sheet đổi và tải xong trong 4 giây đầu → trang tự tải lại một lần; muộn hơn → hiện `🔄 Lịch trình vừa thay đổi · Tải lại`. Footer ghi `Lịch trình cập nhật 14:05`.
- **Tự sắp xếp:** ngày theo ngày tháng, khung giờ theo giờ bắt đầu — nhập theo thứ tự nào cũng được.
- **Dòng sai không làm sập trang:** dòng đó bị bỏ, đầu trang hiện `⚠️ Lịch trình có 2 dòng lỗi` — mở ra thấy đúng dòng trong Sheet (`LichTrinh dòng 7 · Kết thúc "09:00" phải sau Bắt đầu "10:00"`) và link `Mở Sheet`. Sheet mất cột bắt buộc hoặc không còn khung giờ nào → giữ bản lưu cũ.
- **`data/trip.json` được kiểm tra** trước khi hiển thị, báo lỗi chỉ đúng vị trí (`hero.image.src: phải chứa {w}`, `plan.items: phải là link https://docs.google.com/`).
- **Lần đầu mở mà không tải được Sheet, hoặc `trip.json` sai:** trang hiện hộp thông báo `Không tải được lịch trình` kèm chi tiết, thay vì trang trắng.
- **Tắt JavaScript:** hiện hướng dẫn mở bằng link trong trình duyệt.
```

- [ ] **Step 4: README "Kiểm thử" table**

Replace the `tests/trip.test.js` and `tests/fund.test.js` rows and add four rows, so that part of the table reads:

```md
| `tests/trip.test.js` | Số ngày/đêm/điểm/khung trống, `srcset`, link Maps, sắp xếp, thông báo lỗi dữ liệu, budget, cấu hình quỹ, nhãn Form |
| `tests/plan.test.js` | Đọc tab Sheet: ngày `16/10/2026`, giờ `7:00:00`, dự kiến, checkbox; từng loại dòng lỗi và số dòng; thiếu cột; link `plan`; Sheet → trang giống hệt `trip.json` |
| `tests/plan-cache.test.js` | Bản lưu theo link, quyết định sau khi tải ngầm (giữ nguyên / tải lại / toast / giữ bản cũ), chặn tải lại lặp, bộ nhớ trình duyệt bị chặn |
| `tests/form-sync.test.js` | Apps Script tạo đúng danh sách địa điểm như trang (kể cả dòng lỗi), chỉ ghi Form khi khác, báo lỗi rõ, trigger không trùng |
| `tests/table.test.js` | Tìm cột theo tên, đọc số tiền |
```

and the fund row becomes:

```md
| `tests/fund.test.js` | Chia lẻ, tổng khung/ngày/chung/chuyến, quyết toán, chữ Hoàn / Nộp / Đủ, dòng lỗi, link Form điền sẵn |
```

In the paragraph under the table append to the browser list: `lịch trình từ Sheet (lần đầu, bản lưu, tải lại, toast, mất mạng, dòng lỗi)`.

- [ ] **Step 5: README "Sửa lịch trình" — replace the whole section**

Replace everything from `## Sửa lịch trình` up to (not including) `## Kết nối Google Form / Sheet` with:

````md
## Sửa lịch trình

Sửa trong Google Sheet quỹ, trên điện thoại cũng được — không cần đụng code, không cần push. Thứ tự dòng và cột tùy ý (cột tìm theo tên ở dòng 1). Google cần khoảng 5 phút để công bố bản mới; dropdown `Địa điểm` của Form đổi sau vài giây.

**Tab `LichTrinh`** — mỗi khung giờ một dòng:

| Cột | Bắt buộc | Ghi chú |
|---|---|---|
| `Ngày` | có | `16/10/2026` (hoặc `2026-10-16`) |
| `Bắt đầu`, `Kết thúc` | có | `07:00` — Sheet tự đổi thành `7:00:00` cũng được; `Kết thúc` sau `Bắt đầu` |
| `Tên` | có | `Nơi — hoạt động`, vd. `Đồi chè Cầu Đất — Săn mây, ăn sáng` |
| `Icon` | không | Emoji |
| `Tag` | không | |
| `Maps` | không | Từ khóa tìm trên Google Maps; có thì hiện link `📍 Maps` |
| `Dự kiến` | không | VND, `280000` hoặc `280.000`. Trống = không có dự kiến, `0` = `Miễn phí` |
| `Trống` | không | Checkbox (hoặc `x`) = khung trống, không tính là điểm |

**Tab `Ngay`** — không bắt buộc có dòng: `Ngày` · `Icon` · `Ghi chú` cho từng ngày. Ngày chỉ có ở tab này (chưa có khung giờ) hiện `Chưa có lịch`.

**Tab `ChiChung`** — chi phí không thuộc ngày nào: `Tên` · `Icon` · `Dự kiến` · `Ghi chú` (vd. `Vé xe 2 chiều` · `🚌` · `2800000` · `700k/người`).

Lưu ý:

- Dòng sai (ngày/giờ sai, thiếu tên…) bị bỏ qua và hiện trong `⚠️ Lịch trình có N dòng lỗi` ở đầu trang, ghi đúng số dòng.
- Trong cùng một ngày không trùng `Tên`; không đặt tên `Phát sinh` (cả ở `ChiChung`) — Form phân biệt địa điểm bằng tên.
- Đổi tên hoặc chuyển ngày một điểm **đã có khoản chi**: các dòng cũ rơi vào `Không khớp địa điểm` — sửa tên trong tab `ChiTieu`.
- Thêm ngày **trước** ngày đầu tiên làm mọi `Day N` dịch số và các khoản đã nhập đều lệch — tránh khi đã bắt đầu nhập chi.

**`data/trip.json`** giữ phần ít đổi:

| Trường | Bắt buộc | Ghi chú |
|---|---|---|
| `timezone` | có | Múi giờ chuyến đi, dạng `+07:00` |
| `hero.title` | có | |
| `hero.eyebrow`, `hero.chips[]` | không | |
| `hero.subtitle`, `footer.title` | không | Dùng được `{days}`, `{nights}`, `{dates}` (vd. `16 – 18/10`) |
| `hero.image`, `hero.thumbs[]` | không | `{ "src": "assets/img/hero-{w}.jpg", "widths": [800, 1600, 2560] }` — mỗi width là một file có sẵn |
| `footer.note` | không | |
| `plan.items`, `plan.days`, `plan.shared` | có (khi dùng Sheet) | Link CSV publish của tab `LichTrinh`, `Ngay`, `ChiChung` |
| `fund.members[]` | có (khi có `fund`) | Tên thành viên, không trùng, không được là `Quỹ` |
| `fund.csv.expenses`, `fund.csv.contributions` | không | Link CSV publish của tab `ChiTieu` và `GopQuy`. Thiếu thì trang chỉ hiện dự kiến |
| `fund.form.url`, `fund.form.placeField` | không | Link Form (`…/viewform`) và `entry.…` của câu hỏi Địa điểm |
| `fund.sheet` | không | Link mở Google Sheet |

Không có `plan` thì trang đọc `days[]` và `fund.shared[]` ngay trong `data/trip.json` như trước — xem mẫu đầy đủ ở `tests/fixtures/trip.json`.
````

- [ ] **Step 6: README "Kết nối Google Form / Sheet" — replace the whole section**

Replace everything from `## Kết nối Google Form / Sheet` up to (not including) `## Cấu trúc thư mục` with:

````md
## Kết nối Google Form / Sheet

Làm một lần, khoảng 20 phút. **Lưu ý:** link CSV đã publish là công khai — ai có link (kể cả người xem source trang) đọc được lịch trình, tên và số tiền, nhưng không sửa được.

1. **Tạo Google Form** "Chi tiêu Đà Lạt". Tên câu hỏi phải giữ **đúng chữ** như bảng:

   | Câu hỏi | Loại | Lựa chọn / xác thực | Bắt buộc |
   |---|---|---|---|
   | Người nhập | Menu thả xuống | Hữu, MiMi, Khanh, Trâm | có |
   | Địa điểm | Menu thả xuống | Để một lựa chọn tạm bất kỳ — Apps Script (bước 6) sẽ điền | có |
   | Số tiền | Câu trả lời ngắn | Xác thực phản hồi: Biểu thức chính quy → Khớp → `^[1-9][0-9]*$`; văn bản lỗi: `Chỉ nhập số, vd 260000` | có |
   | Ai trả | Trắc nghiệm | Quỹ, Hữu, MiMi, Khanh, Trâm | có |
   | Chia cho | Hộp kiểm | Hữu, MiMi, Khanh, Trâm — mô tả: "Bỏ trống = chia đều cả nhóm" | không |
   | Ghi chú | Câu trả lời ngắn | | không |

   Trong Cài đặt → Câu trả lời: tắt thu thập email và giới hạn 1 câu trả lời, để nhập không cần đăng nhập.
2. **Liên kết Sheet:** tab Câu trả lời → Liên kết với Trang tính → tạo bảng tính mới. Đổi tên tab câu trả lời thành `ChiTieu`.
3. **Tạo các tab còn lại** trong cùng bảng tính, dòng 1 là tên cột:
   - `GopQuy`: `Ngày`, `Người góp`, `Số tiền`, `Ghi chú`. Mỗi lần góp quỹ nhập một dòng.
   - `LichTrinh`, `Ngay`, `ChiChung`: cột như mục [Sửa lịch trình](#sửa-lịch-trình). Cột `Trống`: chọn cả cột → Chèn → Hộp kiểm.
4. **Đặt khu vực:** Tệp → Cài đặt → Ngôn ngữ và khu vực = **Việt Nam**.
5. **Publish CSV:** Tệp → Chia sẻ → Công bố lên web → chọn tab `ChiTieu`, định dạng **Giá trị được phân tách bằng dấu phẩy (.csv)** → Công bố → copy link. Làm lại cho `GopQuy`, `LichTrinh`, `Ngay`, `ChiChung`. Giữ bật "Tự động công bố lại khi có thay đổi".
6. **Cài Apps Script đồng bộ Form:** Tiện ích mở rộng → Apps Script → xóa code mẫu → dán toàn bộ `scripts/apps-script/form-sync.js` → Lưu. Chọn hàm `setup` → Chạy → cấp quyền (Google cảnh báo "ứng dụng chưa xác minh" vì script do bạn viết: Nâng cao → Đi tới dự án). Mở lại Sheet thấy menu `🔄 Đồng bộ Form`; dropdown `Địa điểm` của Form đã có đủ địa điểm. Từ giờ sửa Sheet là Form tự đổi; lỗi sẽ được Google gửi email.
7. **Lấy `placeField`:** trong Form, menu ⋮ → Nhận đường liên kết điền sẵn → chọn một Địa điểm bất kỳ → Nhận đường liên kết → Sao chép. Link có đoạn `entry.123456789=…`; lấy phần `entry.123456789`. Phần trước dấu `?` (kết thúc bằng `/viewform`) là link Form.
8. **Chia sẻ bảng tính** quyền chỉnh sửa cho cả nhóm, để ai cũng sửa được lịch trình và dòng nhập sai.
9. **Điền vào `data/trip.json`:**

   ```json
   "plan": {
     "items": "https://docs.google.com/spreadsheets/d/e/…/pub?gid=…&single=true&output=csv",
     "days": "https://docs.google.com/spreadsheets/d/e/…/pub?gid=…&single=true&output=csv",
     "shared": "https://docs.google.com/spreadsheets/d/e/…/pub?gid=…&single=true&output=csv"
   },
   "fund": {
     "members": ["Hữu", "MiMi", "Khanh", "Trâm"],
     "csv": {
       "expenses": "https://docs.google.com/spreadsheets/d/e/…/pub?gid=…&single=true&output=csv",
       "contributions": "https://docs.google.com/spreadsheets/d/e/…/pub?gid=…&single=true&output=csv"
     },
     "form": { "url": "https://docs.google.com/forms/d/e/…/viewform", "placeField": "entry.123456789" },
     "sheet": "https://docs.google.com/spreadsheets/d/…/edit"
   }
   ```

10. `npm test`, mở trang local → lịch trình hiện đủ, footer có `Lịch trình cập nhật HH:MM`, tab `💰 Quỹ` hiện `Cập nhật HH:MM`. Push lên `main`.
````

- [ ] **Step 7: README "Cấu trúc thư mục" and "Tài liệu"**

In the tree replace these lines:

```
data/trip.json          toàn bộ nội dung
```
→
```
data/trip.json          cấu hình: hero, footer, thành viên, link Sheet / Form
```

```
  main.js               tải dữ liệu → dựng trang → khởi động
  lib/                  giờ, đồng hồ, animation, tạo DOM, đọc CSV, định dạng tiền, so tên
  model/                dữ liệu → model, trạng thái chuyến đi, lưới lịch biểu, sổ quỹ (thuần, có test)
  views/                hero, tabs, ngày, lịch biểu, panel trạng thái, quỹ, footer, lỗi
  controllers/          tabs, đồng hồ thời gian thực, bấm lịch biểu, reveal, parallax dự phòng, tải sổ quỹ
scripts/form-options.js in danh sách địa điểm cho Google Form
tests/                  node --test
```
→
```
  main.js               tải cấu hình → bản lưu / Google Sheet → dựng trang → khởi động
  lib/                  giờ, đồng hồ, animation, tạo DOM, đọc và tải CSV, bảng theo tên cột, định dạng tiền, so tên
  model/                dữ liệu → model, đọc lịch trình từ Sheet, trạng thái chuyến đi, lưới lịch biểu, sổ quỹ (thuần, có test)
  views/                hero, tabs, ngày, lịch biểu, panel trạng thái, quỹ, cảnh báo lịch trình, toast cập nhật, footer, lỗi
  controllers/          tabs, đồng hồ thời gian thực, bấm lịch biểu, reveal, parallax dự phòng, tải sổ quỹ, bản lưu lịch trình
scripts/apps-script/    form-sync.js — Apps Script đồng bộ dropdown Địa điểm của Form
tests/                  node --test · fixtures/trip.json (mẫu đầy đủ) · helpers/sheets.js
```

Replace the flow line with:

```md
Luồng dữ liệu một chiều: `trip.json` + 3 tab Sheet → `model` (đọc, kiểm tra, tính số liệu) → `views` (dựng DOM) → `controllers` (tương tác, thời gian thực, animation, bản lưu).
```

Append to `## Tài liệu`:

```md
- [Thiết kế lịch trình từ Google Sheet](docs/specs/2026-09-15-sheet-plan-design.md) · [Kế hoạch](docs/plans/2026-09-15-sheet-plan.md).
```

(If the calendar docs line is missing from the list, leave it as is — only add this line.)

- [ ] **Step 8: Check**

Run: `npm test` → PASS, `# pass 105`.
Run: `grep -n 'form-options\|Toàn bộ nội dung' README.md package.json` → no output.
Open `README.md` preview: tables render, the four `## …` anchors in `## Mục lục` still resolve (section titles unchanged).

- [ ] **Step 9: Commit**

```bash
git add README.md package.json scripts/form-options.js
git commit -m "docs: explain editing the plan in Google Sheet

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Go live on the real Sheet (needs the user)

Steps 2–5 happen in the user's Google account; the agent prepares files and waits for the links. Do not edit `data/trip.json` before Step 5.

**Files:**
- Scratch: `$SCRATCH/seed-tsv.mjs`, `$SCRATCH/seed/*.tsv`
- Modify: `data/trip.json`

**Interfaces:**
- Consumes: everything above; from the user: the three published CSV links (`LichTrinh`, `Ngay`, `ChiChung`).

- [ ] **Step 1: Generate paste-ready tabs from today's `data/trip.json`**

`$SCRATCH/seed-tsv.mjs`:

```js
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const out = process.argv[2];
mkdirSync(out, { recursive: true });
const trip = JSON.parse(readFileSync('/Users/huucao/Projects/huucao/data/trip.json', 'utf8'));
const tsv = (rows) => `${rows.map((row) => row.map((cell) => String(cell ?? '')).join('\t')).join('\n')}\n`;
const vnDate = (iso) => {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
};

writeFileSync(`${out}/LichTrinh.tsv`, tsv([
  ['Ngày', 'Bắt đầu', 'Kết thúc', 'Icon', 'Tên', 'Tag', 'Maps', 'Dự kiến', 'Trống'],
  ...trip.days.flatMap((day) => day.items.map((item) => [
    vnDate(day.date), item.start, item.end, item.icon, item.title, item.tag, item.map, item.budget, item.empty ? 'TRUE' : 'FALSE',
  ])),
]));
writeFileSync(`${out}/Ngay.tsv`, tsv([
  ['Ngày', 'Icon', 'Ghi chú'],
  ...trip.days.map((day) => [vnDate(day.date), day.icon, day.note]),
]));
writeFileSync(`${out}/ChiChung.tsv`, tsv([
  ['Tên', 'Icon', 'Dự kiến', 'Ghi chú'],
  ...trip.fund.shared.map((cost) => [cost.title, cost.icon, cost.budget, cost.note]),
]));
console.log(`seed in ${out}`);
```

Run: `node $SCRATCH/seed-tsv.mjs $SCRATCH/seed`
Expected: `seed in …/seed`; `wc -l $SCRATCH/seed/*.tsv` → `LichTrinh.tsv` 22, `Ngay.tsv` 4, `ChiChung.tsv` 4.

Check the round trip before handing over: `node -e` is not needed — the same rows through `sheetsOf` are covered by `tests/plan.test.js`. Open each file and eyeball: no tab characters inside cells, emoji intact.

- [ ] **Step 2: User creates and fills the tabs**

Tell the user (Vietnamese), then wait:

1. In the fund spreadsheet add tabs `LichTrinh`, `Ngay`, `ChiChung`.
2. Open each `.tsv` from `$SCRATCH/seed/`, copy all, click cell A1 of the matching tab, paste.
3. `LichTrinh`: select column `Trống` below the header → Chèn → Hộp kiểm (TRUE/FALSE become ticks).
4. Tệp → Chia sẻ → Công bố lên web: publish each of the three tabs as CSV; send back the three links.

- [ ] **Step 3: User installs the Apps Script and checks it (spec §9.3)**

Tell the user, then wait for a yes on each:

1. Tiện ích mở rộng → Apps Script → paste `scripts/apps-script/form-sync.js` → Lưu → run `setup` → cấp quyền. Triggers page (⏰) shows one `syncForm` / `Khi thay đổi`.
2. Rename one slot in `LichTrinh` → within ~10 s the Form's `Địa điểm` dropdown shows the new name. Rename it back.
3. Delete a spare test row → its place disappears from the dropdown.
4. Submit one test expense through the Form → Apps Script → Lần thực thi shows `syncForm` ran without changing anything (toast-free, no error). Delete the test row in `ChiTieu`.
5. Reload the Sheet → menu `🔄 Đồng bộ Form` → `Cập nhật danh sách địa điểm` → toast `Form đã khớp (28 địa điểm)`.

- [ ] **Step 4: Verify the live links before switching**

With the three links from the user as `$ITEMS`, `$DAYS`, `$SHARED`:

```bash
for u in "$ITEMS" "$DAYS" "$SHARED"; do curl -sL "$u" | head -2; echo ---; done
```

Expected: each prints a CSV header (`Ngày,Bắt đầu,…`, `Ngày,Icon,Ghi chú`, `Tên,Icon,Dự kiến,Ghi chú`) and one data row — not HTML. If HTML: the tab is not published; go back to Step 2.4.

- [ ] **Step 5: Switch `data/trip.json`**

Edit `data/trip.json`:
- Add after `"hero": { … },`:

```json
  "plan": {
    "items": "<ITEMS link from the user>",
    "days": "<DAYS link from the user>",
    "shared": "<SHARED link from the user>"
  },
```

- Delete the whole `"days": [ … ],` array.
- Delete `"shared": [ … ]` inside `fund` (and the comma before it).

Run: `node -e "const j=require('./data/trip.json'); console.log(Object.keys(j), Object.keys(j.fund))"`
Expected: `[ 'timezone', 'hero', 'plan', 'fund', 'footer' ]` and `[ 'members', 'csv', 'form', 'sheet' ]`.

- [ ] **Step 6: Check against the real Sheet**

```bash
npm test
PROBE='({ items: document.querySelectorAll(".timeline > .item").length, warn: document.querySelector(".plan-warn summary")?.textContent ?? null, stamp: document.querySelector(".footer-stamp")?.textContent ?? null, error: document.querySelector(".load-error")?.textContent ?? null, shared: document.querySelector(".fund-panel")?.textContent.includes("Vé xe 2 chiều") })' SHOT=1 WAIT=6000 \
node $SCRATCH/shot.mjs $SCRATCH/t9-live http://127.0.0.1:8765/ 390 1
```

Expected: `# pass 105`; `items: 21` (or the user's current count), `warn: null`, `stamp` set, `error: null`, `shared: true`; screenshot matches the page before the switch.

- [ ] **Step 7: Commit, then ask about pushing**

```bash
git add data/trip.json
git commit -m "feat: read the Da Lat plan from Google Sheet

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

Ask the user whether to push `feat/sheet-plan` and open a PR (GitHub Pages deploys `main` on merge). Do not push without a yes.

