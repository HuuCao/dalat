# Calendar View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `Danh sách | 📅 Lịch` switch inside the `Tất cả` tab that shows the whole trip as a week grid (columns = days, vertical axis = time), live-marked like the list, where tapping a slot jumps to its card.

**Architecture:** Pure model first (`buildCalendar`, `nowMark`, `localMinuteOf`, `panelShown`, `readView`) with unit tests; then the shared switch style, the calendar view + CSS wired into `main.js`, live state from the status controller, and taps. Blocks are absolutely positioned inside each day column from minute offsets × a `--ppm` (px per minute) CSS variable.

**Tech Stack:** Vanilla ES modules, CSS, `node --test`, no build step, no dependencies. Headless Chrome via CDP for UI checks.

**Spec:** `docs/specs/2026-09-15-calendar-view-design.md`

## Global Constraints

- No build step, no dependency. Tests: `npm test` (Node ≥ 18). Baseline before Task 1: 73 tests pass.
- Mobile-first CSS; desktop overrides only inside `@media (min-width: 761px)`.
- Data text goes into the DOM only through `h()` / `textContent`, never HTML.
- `Element.replaceChildren()` never receives `null` — filter first.
- Animation DOM contract stays: `.day-head` directly before `.timeline`; every `.item` a direct child of `.timeline`. `startReveal` targets stay `.day-head, .item`.
- No `overflow: hidden` / `clip` on `.cal` or any ancestor of `.cal-head` (breaks sticky).
- No horizontal page scroll at any width, with any number of days.
- Tap targets ≥ 44px (day headings, switch buttons). Smallest text 11px.
- Motion only inside `@media (prefers-reduced-motion: no-preference)`; hover only inside `@media (hover: hover)`.
- Stored view key: `dalat:schedule-view`, values `list` / `calendar`; any storage error falls back to `list` silently.
- Form labels (`Day N · …`) untouched.
- Commits: Conventional Commits, English, ending with `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.

## Verification harness (used by Tasks 2–7)

Scratch script, not committed. `$SCRATCH` = `/private/tmp/claude-501/-Users-huucao-Projects-huucao/f6f4f06f-e8d1-4a23-80b6-742f841e0316/scratchpad`.

Start the server once (background) from the repo root: `python3 -m http.server 8765 --bind 127.0.0.1`.

`node $SCRATCH/shot.mjs <out-prefix> <url> <width> <mobile 0|1> [js-run-after-load]`

- `PROBE=<js expression>` prints its value after the pre-script.
- `INIT=<js>` runs before any page script (e.g. to break `localStorage` or patch `fetch`).
- `SHOT=1` saves the current viewport to `<out-prefix>.png`.
- `MOTION=1` leaves animations on (default: reduced motion, so scrolling is instant).
- `WAIT=<ms>` wait after navigation (default 4000).
- Uncaught exceptions and `console.error` calls are printed. `console.error` from the fund (Google CSV unreachable) is expected noise; any other line is a failure.

`$SCRATCH/shot.mjs`:

```js
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const [out, url, width = '390', mobile = '1', pre = ''] = process.argv.slice(2);
const W = Number(width);
const H = mobile === '1' ? 844 : 900;
const here = dirname(fileURLToPath(import.meta.url));
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
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const evalJs = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: mobile === '1' });
if (process.env.MOTION !== '1') {
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
}
if (process.env.INIT) await send('Page.addScriptToEvaluateOnNewDocument', { source: process.env.INIT });
await send('Page.navigate', { url });
await sleep(Number(process.env.WAIT ?? 4000));
if (pre) { await evalJs(pre); await sleep(1500); }
console.log(`scrollWidth=${await evalJs('document.documentElement.scrollWidth')} viewport=${W}`);
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

`B=http://127.0.0.1:8765/`. Moments: `?now=2026-10-10T09:00:00%2B07:00` (soon), `?now=2026-10-16T12:00:00%2B07:00` (in a slot), `?now=2026-10-16T12:30:00%2B07:00` (between), `?now=2026-10-16T17:00:00%2B07:00` (late afternoon), `?now=2026-10-19T00:00:00%2B07:00` (done).

JS passed through the shell is wrapped in single quotes and uses only double quotes inside; attribute selectors use unquoted values (`[data-id=day-1-item-3]`).

---

### Task 1: Calendar model

**Files:**
- Modify: `js/lib/time.js` (append after `localDateOf`)
- Create: `js/model/calendar.js`
- Test: `tests/time.test.js`, `tests/calendar.test.js`

**Interfaces:**
- Consumes: `buildTrip(raw)` days (`id`, `title`, `shortDate`, `dateText`, `date`, `items`) and items (`id`, `startText`, `endText`, …) from `js/model/trip.js`; `toMinutes`, `localDateOf` from `js/lib/time.js`.
- Produces:
  - `localMinuteOf(ms: number, timezone: string): number` — minutes since the trip's midnight.
  - `buildCalendar(trip) → { startMinute, endMinute, span, hours: [{ top, text }], days: [{ id, title, shortDate, dateText, date, blocks: [{ item, top, height, lane, lanes }] }] }` (all minute values are numbers).
  - `nowMark(calendar, now: number, timezone: string) → { dayId: string, top: number } | null`.

- [ ] **Step 1: Write the failing time test**

In `tests/time.test.js` add `localMinuteOf` to the import list (after `localDateOf`) and append:

```js
test('localMinuteOf counts minutes from midnight in the trip timezone', () => {
  assert.equal(localMinuteOf(Date.parse('2026-10-16T12:00:00+07:00'), '+07:00'), 720);
  assert.equal(localMinuteOf(Date.parse('2026-10-16T05:00:00Z'), '+07:00'), 720);
  assert.equal(localMinuteOf(Date.parse('2026-10-16T17:30:00Z'), '+07:00'), 30);
  assert.equal(localMinuteOf(Date.parse('2026-10-17T03:00:00Z'), '-03:30'), 1410);
});
```

- [ ] **Step 2: Write the failing calendar tests**

Create `tests/calendar.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildTrip } from '../js/model/trip.js';
import { buildCalendar, nowMark } from '../js/model/calendar.js';

const trip = buildTrip(JSON.parse(readFileSync(new URL('../data/trip.json', import.meta.url), 'utf8')));
const calendar = buildCalendar(trip);

// Small trips without a fund, so titles may repeat across tests.
const slot = (start, end, title = `${start}-${end}`) => ({ start, end, title });
const calendarOf = (...days) => buildCalendar(buildTrip({
  timezone: '+07:00',
  hero: { title: 'Test' },
  days: days.map((items, index) => ({ date: `2026-10-${16 + index}`, items })),
}));
const layout = ({ item, top, height, lane, lanes }) => ({ id: item.id, top, height, lane, lanes });
const lanesOf = (day) => day.blocks.map(({ item, lane, lanes }) => ({ title: item.title, lane, lanes }));

test('the grid spans whole hours around every slot of the trip', () => {
  assert.equal(calendar.startMinute, 420);
  assert.equal(calendar.endMinute, 1320);
  assert.equal(calendar.span, 900);
  assert.equal(calendar.hours.length, 16);
  assert.deepEqual(calendar.hours[0], { top: 0, text: '07:00' });
  assert.deepEqual(calendar.hours[15], { top: 900, text: '22:00' });
});

test('hours round down at the start and up at the end', () => {
  const rounded = calendarOf([slot('07:30', '09:00')], [slot('10:00', '21:30')]);
  assert.equal(rounded.startMinute, 420);
  assert.equal(rounded.endMinute, 1320);
  const exact = calendarOf([slot('08:00', '22:00')]);
  assert.equal(exact.startMinute, 480);
  assert.equal(exact.endMinute, 1320);
});

test('days carry their labels and a block per slot', () => {
  assert.deepEqual(calendar.days.map(({ id, title, shortDate, dateText, date, blocks }) => ({ id, title, shortDate, dateText, date, count: blocks.length })), [
    { id: 'day-1', title: 'Ngày 1', shortDate: 'T6 16/10', dateText: 'Th 6, 16/10', date: '2026-10-16', count: 9 },
    { id: 'day-2', title: 'Ngày 2', shortDate: 'T7 17/10', dateText: 'Th 7, 17/10', date: '2026-10-17', count: 8 },
    { id: 'day-3', title: 'Ngày 3', shortDate: 'CN 18/10', dateText: 'CN, 18/10', date: '2026-10-18', count: 4 },
  ]);
  assert.deepEqual(layout(calendar.days[0].blocks[0]), { id: 'day-1-item-1', top: 0, height: 120, lane: 0, lanes: 1 });
  assert.deepEqual(layout(calendar.days[2].blocks[3]), { id: 'day-3-item-4', top: 315, height: 45, lane: 0, lanes: 1 });
  assert.equal(calendar.days[0].blocks[0].item.name, 'Đồi chè Cầu Đất');
});

test('a day without slots has no blocks', () => {
  assert.deepEqual(calendarOf([slot('08:00', '09:00')], []).days[1].blocks, []);
});

test('overlapping slots share the width in lanes; touching slots do not', () => {
  const overlapping = calendarOf([slot('09:00', '11:00', 'A'), slot('10:00', '12:00', 'B'), slot('11:00', '13:00', 'C')]);
  assert.deepEqual(lanesOf(overlapping.days[0]), [
    { title: 'A', lane: 0, lanes: 2 },
    { title: 'B', lane: 1, lanes: 2 },
    { title: 'C', lane: 0, lanes: 2 },
  ]);
  const touching = calendarOf([slot('09:00', '10:00', 'A'), slot('10:00', '11:00', 'B')]);
  assert.deepEqual(lanesOf(touching.days[0]), [
    { title: 'A', lane: 0, lanes: 1 },
    { title: 'B', lane: 0, lanes: 1 },
  ]);
});

test('nowMark places the current minute on the day in progress', () => {
  const at = (iso) => nowMark(calendar, Date.parse(iso), trip.timezone);
  assert.deepEqual(at('2026-10-16T12:00:00+07:00'), { dayId: 'day-1', top: 300 });
  assert.deepEqual(at('2026-10-16T05:00:00Z'), { dayId: 'day-1', top: 300 });
  assert.deepEqual(at('2026-10-16T22:00:00+07:00'), { dayId: 'day-1', top: 900 });
  assert.equal(at('2026-10-19T12:00:00+07:00'), null);
  assert.equal(at('2026-10-16T06:59:00+07:00'), null);
  assert.equal(at('2026-10-16T22:01:00+07:00'), null);
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `tests/time.test.js` "does not provide an export named 'localMinuteOf'", `tests/calendar.test.js` "Cannot find module … js/model/calendar.js".

- [ ] **Step 4: Implement `localMinuteOf`**

Append to `js/lib/time.js`:

```js
// Minutes since the trip's midnight at an instant, whatever the viewer's
// timezone.
export function localMinuteOf(ms, timezone) {
  const shifted = new Date(ms + offsetMinutes(timezone) * 60_000);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}
```

- [ ] **Step 5: Implement the calendar model**

Create `js/model/calendar.js`:

```js
import { toMinutes, localDateOf, localMinuteOf } from '../lib/time.js';

const HOUR = 60;

const hourText = (minute) => `${String(minute / HOUR).padStart(2, '0')}:00`;

// The whole trip on one time grid: whole hours from the earliest start to
// the latest end, each slot a block measured in minutes from the top. The
// view turns minutes into pixels.
export function buildCalendar(trip) {
  const startMinute = Math.floor(Math.min(...trip.items.map((item) => toMinutes(item.startText))) / HOUR) * HOUR;
  const endMinute = Math.ceil(Math.max(...trip.items.map((item) => toMinutes(item.endText))) / HOUR) * HOUR;

  const hours = [];
  for (let minute = startMinute; minute <= endMinute; minute += HOUR) {
    hours.push({ top: minute - startMinute, text: hourText(minute) });
  }

  return {
    startMinute,
    endMinute,
    span: endMinute - startMinute,
    hours,
    days: trip.days.map((day) => ({
      id: day.id,
      title: day.title,
      shortDate: day.shortDate,
      dateText: day.dateText,
      date: day.date,
      blocks: layoutBlocks(day.items, startMinute),
    })),
  };
}

// Where the current minute sits, or null off the trip's days or outside the
// grid's hours.
export function nowMark(calendar, now, timezone) {
  const date = localDateOf(now, timezone);
  const day = calendar.days.find((entry) => entry.date === date);
  if (!day) return null;
  const minute = localMinuteOf(now, timezone);
  if (minute < calendar.startMinute || minute > calendar.endMinute) return null;
  return { dayId: day.id, top: minute - calendar.startMinute };
}

// Nothing stops two slots of a day from overlapping, so overlapping slots
// share the width side by side. Slots that only touch (end == start) do not
// overlap. Items arrive sorted by start (buildDay).
function layoutBlocks(items, startMinute) {
  const clusters = [];
  let clusterEnd = -Infinity;
  for (const item of items) {
    const start = toMinutes(item.startText);
    const end = toMinutes(item.endText);
    if (start >= clusterEnd) clusters.push([]);
    clusters[clusters.length - 1].push({ item, start, end });
    clusterEnd = Math.max(clusterEnd, end);
  }

  return clusters.flatMap((cluster) => {
    const laneEnds = [];
    const placed = cluster.map(({ item, start, end }) => {
      let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = end;
      return { item, top: start - startMinute, height: end - start, lane };
    });
    return placed.map((block) => ({ ...block, lanes: laneEnds.length }));
  });
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, 80 tests (73 + 1 time + 6 calendar), 0 fail.

- [ ] **Step 7: Commit**

```bash
git add js/lib/time.js js/model/calendar.js tests/time.test.js tests/calendar.test.js
git commit -m "feat: lay out the trip on an hour grid for the calendar view

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: List or calendar in the tabs controller

**Files:**
- Modify: `js/views/tabs.js`
- Modify: `js/controllers/tabs.js`
- Test: `tests/tabs.test.js` (create)

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `js/views/tabs.js`: `CALENDAR_PANEL = 'calendar'`, `LIST_VIEW = 'list'`, `CALENDAR_VIEW = 'calendar'`; the `Tất cả` tab's `aria-controls` includes `panel-calendar`.
  - `js/controllers/tabs.js`: `panelShown(key: string, tab: string, view: string): boolean`; `readView(storage: Storage | null): 'list' | 'calendar'`; `createTabs(tablist, panels, { onChange, switcher, storage })` returns `{ select, markToday, view: () => 'list' | 'calendar' }`. `switcher` is an element holding `button[data-view]`; clicking one switches the view, stores it, re-selects `Tất cả` as a user action (so `onChange(shown)` runs).

- [ ] **Step 1: Write the failing tests**

Create `tests/tabs.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { panelShown, readView } from '../js/controllers/tabs.js';
import { ALL_TAB, FUND_TAB, CALENDAR_PANEL, LIST_VIEW, CALENDAR_VIEW } from '../js/views/tabs.js';

const KEYS = ['day-1', 'day-2', CALENDAR_PANEL, FUND_TAB];
const shownKeys = (tab, view) => KEYS.filter((key) => panelShown(key, tab, view));

test('"Tất cả" lists the days or shows the calendar alone; other tabs show their own panel', () => {
  assert.deepEqual(shownKeys(ALL_TAB, LIST_VIEW), ['day-1', 'day-2']);
  assert.deepEqual(shownKeys(ALL_TAB, CALENDAR_VIEW), [CALENDAR_PANEL]);
  assert.deepEqual(shownKeys('day-2', LIST_VIEW), ['day-2']);
  assert.deepEqual(shownKeys('day-2', CALENDAR_VIEW), ['day-2']);
  assert.deepEqual(shownKeys(FUND_TAB, CALENDAR_VIEW), [FUND_TAB]);
});

const storageWith = (value) => ({ getItem: (key) => (key === 'dalat:schedule-view' ? value : null) });

test('readView falls back to the list for anything but a stored calendar', () => {
  assert.equal(readView(storageWith('calendar')), CALENDAR_VIEW);
  assert.equal(readView(storageWith('list')), LIST_VIEW);
  assert.equal(readView(storageWith('xyz')), LIST_VIEW);
  assert.equal(readView(storageWith(null)), LIST_VIEW);
  assert.equal(readView(null), LIST_VIEW);
  assert.equal(readView({ getItem() { throw new Error('blocked'); } }), LIST_VIEW);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `tests/tabs.test.js` "does not provide an export named 'CALENDAR_PANEL'" (or `panelShown`).

- [ ] **Step 3: Add the constants and `aria-controls` in `js/views/tabs.js`**

Replace:

```js
export const ALL_TAB = 'all';
export const FUND_TAB = 'fund';
```

with:

```js
export const ALL_TAB = 'all';
export const FUND_TAB = 'fund';
// "Tất cả" shows the days as a list or as a calendar (views/calendar.js).
export const CALENDAR_PANEL = 'calendar';
export const LIST_VIEW = 'list';
export const CALENDAR_VIEW = 'calendar';
```

Replace:

```js
        tab(ALL_TAB, days.map(panelId).join(' '), 'Tất cả'),
```

with:

```js
        tab(ALL_TAB, [...days.map(panelId), `panel-${CALENDAR_PANEL}`].join(' '), 'Tất cả'),
```

- [ ] **Step 4: Implement view handling in `js/controllers/tabs.js`**

Replace the top of the file, from line 1 through the end of `select` (the line `  }` after `onChange(shown);`), with:

```js
import { ALL_TAB, FUND_TAB, CALENDAR_PANEL, LIST_VIEW, CALENDAR_VIEW } from '../views/tabs.js';

const ARROW_STEPS = { ArrowLeft: -1, ArrowRight: 1 };
const GAP_BELOW_TABBAR = 12;
const VIEW_KEY = 'dalat:schedule-view';

// Which panels a tab shows. "Tất cả" lists every day or shows the calendar
// alone; the fund panel only shows on its own tab.
export function panelShown(key, tab, view) {
  if (tab !== ALL_TAB) return key === tab;
  if (view === CALENDAR_VIEW) return key === CALENDAR_PANEL;
  return key !== FUND_TAB && key !== CALENDAR_PANEL;
}

// Storage may be missing or throw (private mode, blocked site data).
export function readView(storage) {
  try {
    return storage?.getItem(VIEW_KEY) === CALENDAR_VIEW ? CALENDAR_VIEW : LIST_VIEW;
  } catch {
    return LIST_VIEW;
  }
}

function saveView(storage, view) {
  try {
    storage?.setItem(VIEW_KEY, view);
  } catch {
    // Not remembered; the switch still works for this visit.
  }
}

// onChange(shownPanels) runs after every tab or view the user picks, so the
// shown days can play their entrance again.
export function createTabs(tablist, panels, { onChange = () => {}, switcher = null, storage = null } = {}) {
  const tabs = [...tablist.querySelectorAll('[role="tab"]')];
  const tabbar = tablist.closest('.tabbar');
  const viewButtons = switcher ? [...switcher.querySelectorAll('[data-view]')] : [];
  let view = readView(storage);

  function select(id, { focus = false, user = false } = {}) {
    const active = tabs.find((tab) => tab.dataset.tab === id) ?? tabs[0];
    const activeId = active.dataset.tab;

    for (const tab of tabs) {
      const selected = tab === active;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    }
    for (const panel of panels) {
      panel.hidden = !panelShown(panel.dataset.day, activeId, view);
    }
    // The list/calendar switch belongs to "Tất cả" only.
    if (switcher) switcher.hidden = activeId !== ALL_TAB;
    for (const button of viewButtons) {
      button.setAttribute('aria-pressed', String(button.dataset.view === view));
    }

    if (focus) active.focus();
    if (!user) return;

    const shown = panels.filter((panel) => !panel.hidden);
    // On phones with many days the tab row scrolls sideways.
    active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    bringIntoView(shown[0]);
    onChange(shown);
  }

  function setView(next) {
    if (next === view) return;
    view = next;
    saveView(storage, view);
    select(ALL_TAB, { user: true });
  }

  switcher?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-view]');
    if (button) setView(button.dataset.view);
  });
```

Leave `bringIntoView`, the two tablist listeners and `markToday` as they are. Replace the last two lines:

```js
  select(ALL_TAB);
  return { select, markToday };
```

with:

```js
  select(ALL_TAB);
  return { select, markToday, view: () => view };
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, 82 tests, 0 fail.

- [ ] **Step 6: Check the page is unchanged**

Run (server running, see harness):

```bash
PROBE='[...document.querySelectorAll(".panel:not([hidden])")].map((p) => p.id)' \
node $SCRATCH/shot.mjs $SCRATCH/t2 "$B" 390 1
```

Expected: `scrollWidth=390`, `probe: ["panel-day-1","panel-day-2","panel-day-3"]`, no `exception:` line.

- [ ] **Step 7: Commit**

```bash
git add js/views/tabs.js js/controllers/tabs.js tests/tabs.test.js
git commit -m "feat: let the all-days tab switch between a list and a calendar

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Shared switch style

**Files:**
- Modify: `css/base.css` (insert before `.load-error`)
- Modify: `css/fund.css:110-140`
- Modify: `js/views/fund.js:142-152`

**Interfaces:**
- Produces: CSS classes `.switch` (container) and `.switch-btn` (option, `aria-pressed`), used by the fund books and by the calendar view switch (Task 4).

- [ ] **Step 1: Add the shared style to `css/base.css`**

Insert right before `.load-error {`:

```css
/* Options side by side, one pressed: the fund's books, list or calendar. */
.switch {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(0, 1fr);
  gap: 4px;
  padding: 4px;
  border-radius: 12px;
  background: var(--accent-soft);
}

.switch-btn {
  min-height: 44px;
  padding: 4px 8px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: var(--text-sub);
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.switch-btn[aria-pressed="true"] { background: var(--card); color: var(--primary); box-shadow: var(--shadow-sm); }
.switch-btn:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }

```

- [ ] **Step 2: Drop the fund copy in `css/fund.css`**

Replace everything from `.book-tabs {` through `.book-tab:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }` (lines 111–140) with:

```css
.books-switch { margin-bottom: 12px; }
```

Keep the `/* ---------- BOOKS (fund tab) ---------- */` comment above it.

- [ ] **Step 3: Use the shared classes in `js/views/fund.js`**

In `renderBooks`, replace `class: 'book-tab',` with `class: 'switch-btn',` and replace `h('div', { class: 'book-tabs' },` with `h('div', { class: 'switch books-switch' },`.

- [ ] **Step 4: Verify**

Run: `grep -rn "book-tab" css js` → no output. `npm test` → 82 pass.

Then:

```bash
PROBE='(() => { const s = document.querySelector(".books-switch"); if (!s) return "no ledger"; const cs = getComputedStyle(s); const on = getComputedStyle(s.querySelector("[aria-pressed=true]")); return [cs.display, cs.marginBottom, cs.backgroundColor, on.backgroundColor, on.minHeight, s.children.length]; })()' \
WAIT=8000 node $SCRATCH/shot.mjs $SCRATCH/t3 "$B" 390 1 'document.querySelector("#tab-fund").click()'
```

Expected: `probe: ["grid","12px","rgb(232, 240, 236)","rgb(255, 255, 255)","44px",2]`. If it prints `"no ledger"` the Google CSV was unreachable from headless Chrome; then check the same styles in a normal browser on the `💰 Quỹ` tab (switch looks exactly as before).

- [ ] **Step 5: Commit**

```bash
git add css/base.css css/fund.css js/views/fund.js
git commit -m "refactor: share the two-way switch style between views

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Calendar panel

**Files:**
- Create: `js/views/calendar.js`
- Create: `css/calendar.css`
- Modify: `index.html` (stylesheet link)
- Modify: `js/main.js`

**Interfaces:**
- Consumes: `buildCalendar(trip)` (Task 1); `CALENDAR_PANEL`, `ALL_TAB`, `LIST_VIEW`, `CALENDAR_VIEW` (Task 2); `createTabs(…, { onChange, switcher, storage })` (Task 2); `.switch`, `.switch-btn` (Task 3).
- Produces:
  - `createCalendar(model) → { panel: HTMLElement, switcher: HTMLElement, update(state), scrollToNow() }` where `state = { currentId: string | null, pastIds: Set<string>, todayId: string | null, mark: { dayId, top } | null }`.
  - DOM: `section#panel-calendar.panel.cal-panel[data-day=calendar]`, `.cal-day[data-day-id]`, `.cal-col[data-day-id]`, `button.cal-block[data-id]`, `.cal-now`.
  - `mount()` in `main.js` returns `calendar` and `calModel` too.

- [ ] **Step 1: Create `js/views/calendar.js`**

```js
import { h } from '../lib/dom.js';
import { ALL_TAB, CALENDAR_PANEL, LIST_VIEW, CALENDAR_VIEW } from './tabs.js';

// Line budget of a block, in px at 1px per minute (the phone scale): the
// start time takes TIME_ROOM, each name line NAME_LINE. Shorter blocks than
// SHORT_BLOCK minutes drop the start time.
const SHORT_BLOCK = 40;
const TIME_ROOM = 22;
const NAME_LINE = 16;

const STATE_TEXT = { now: ', đang diễn ra', past: ', đã qua' };

// The whole trip as a week grid inside "Tất cả". Built once; update() only
// flips classes and moves the now line.
export function createCalendar(model) {
  const switcher = h('div', { class: 'switch view-switch', role: 'group', 'aria-label': 'Cách xem' },
    viewButton(LIST_VIEW, 'Danh sách'),
    viewButton(CALENDAR_VIEW, '📅 Lịch'));

  const heads = new Map();
  const columns = new Map();
  const blocks = new Map();
  const nowLine = h('div', { class: 'cal-now', 'aria-hidden': 'true', hidden: true });
  let todayId = null;

  const head = h('div', { class: 'cal-head' },
    h('span', { class: 'cal-corner' }),
    model.days.map((day) => {
      const button = h('button', {
        class: 'cal-day',
        type: 'button',
        'aria-label': `Mở ${day.title}, ${day.dateText}`,
        dataset: { dayId: day.id },
      },
      h('span', { class: 'cal-day-name', text: day.title }),
      h('span', { class: 'cal-day-date', text: day.shortDate }));
      heads.set(day.id, button);
      return button;
    }));

  const body = h('div', { class: 'cal-body' },
    h('div', { class: 'cal-hours', 'aria-hidden': 'true' },
      model.hours.map((hour) => h('span', { class: 'cal-hour', style: { '--top': String(hour.top) }, text: hour.text }))),
    model.days.map((day) => {
      const column = h('div', { class: 'cal-col', dataset: { dayId: day.id } },
        day.blocks.map((block) => {
          const el = renderBlock(block, day);
          blocks.set(block.item.id, { el, label: el.getAttribute('aria-label'), state: null });
          return el;
        }));
      columns.set(day.id, column);
      return column;
    }));

  const panel = h('section', {
    class: 'panel cal-panel',
    id: `panel-${CALENDAR_PANEL}`,
    role: 'tabpanel',
    'aria-labelledby': `tab-${ALL_TAB}`,
    dataset: { day: CALENDAR_PANEL },
  },
  h('article', { class: 'cal', style: { '--days': String(model.days.length), '--span': String(model.span) } }, head, body));

  // Same states as the list (controllers/status.js); the label keeps the
  // state for screen readers.
  function update({ currentId, pastIds, todayId: nextTodayId, mark }) {
    for (const [id, block] of blocks) {
      const state = id === currentId ? 'now' : pastIds.has(id) ? 'past' : null;
      if (state === block.state) continue;
      block.state = state;
      block.el.classList.toggle('is-now', state === 'now');
      block.el.classList.toggle('is-past', state === 'past');
      block.el.setAttribute('aria-label', block.label + (STATE_TEXT[state] ?? ''));
    }

    if (nextTodayId !== todayId) {
      heads.get(todayId)?.removeAttribute('data-today');
      heads.get(nextTodayId)?.setAttribute('data-today', '');
      todayId = nextTodayId;
    }

    const column = mark ? columns.get(mark.dayId) : null;
    nowLine.hidden = !column;
    if (column) {
      if (nowLine.parentElement !== column) column.append(nowLine);
      nowLine.style.setProperty('--top', String(mark.top));
    }
  }

  // Opening the calendar during the trip centres the current time.
  function scrollToNow() {
    if (nowLine.hidden) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    nowLine.scrollIntoView({ block: 'center', behavior: reduce ? 'instant' : 'smooth' });
  }

  return { panel, switcher, update, scrollToNow };
}

function viewButton(view, text) {
  return h('button', { class: 'switch-btn', type: 'button', 'aria-pressed': 'false', dataset: { view } }, text);
}

function renderBlock(block, day) {
  const { item } = block;
  const short = block.height < SHORT_BLOCK;
  const lines = short ? 1 : Math.max(1, Math.floor((block.height - TIME_ROOM) / NAME_LINE));
  const classes = ['cal-block', item.empty ? 'is-empty' : '', short ? 'is-short' : ''].filter(Boolean).join(' ');

  return h('button', {
    class: classes,
    type: 'button',
    'aria-label': `${day.title}, ${item.startText} – ${item.endText}, ${item.name}`,
    dataset: { id: item.id },
    style: {
      '--top': String(block.top),
      '--height': String(block.height),
      '--lane': String(block.lane),
      '--lanes': String(block.lanes),
      '--lines': String(lines),
    },
  },
  h('span', { class: 'cal-time', text: item.startText }),
  h('span', { class: 'cal-name', text: item.icon ? `${item.icon} ${item.name}` : item.name }));
}
```

- [ ] **Step 2: Create `css/calendar.css`**

```css
/* ---------- VIEW SWITCH ---------- */
/* Leads <main> on "Tất cả" (controllers/tabs.js hides it on other tabs). */
.view-switch { max-width: 280px; margin: 18px auto 0; }

/* ---------- CALENDAR ---------- */
/* Minutes become pixels through --ppm. Nothing on .cal or above it may clip
   overflow: the day row would stop sticking under the tab bar. */
.cal {
  --ppm: 1px;
  --gutter: 38px;
  margin-top: 18px;
  padding: 0 12px 12px;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 14px;
  box-shadow: var(--shadow-md);
}

/* Heading row and grid share one column template, so days line up. Many
   days narrow the columns instead of scrolling sideways. */
.cal-head,
.cal-body {
  display: grid;
  grid-template-columns: var(--gutter) repeat(var(--days), minmax(0, 1fr));
  column-gap: 4px;
}

/* --tabbar-h is measured by controllers/calendar.js. */
.cal-head {
  position: sticky;
  top: var(--tabbar-h, 78px);
  z-index: 5;
  margin: 0 -12px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--line);
  border-radius: 14px 14px 0 0;
  background: var(--card);
}

.cal-day {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: 44px;
  padding: 4px 2px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  font: inherit;
  line-height: 1.25;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.cal-day-name,
.cal-day-date {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cal-day-name { font-size: 13px; font-weight: 700; color: var(--primary); }
.cal-day-date { font-size: 11px; font-weight: 500; color: var(--text-sub); }

/* Today: the same lime dot as the day tab. */
.cal-day[data-today]::after {
  content: "";
  position: absolute;
  bottom: 2px;
  left: 50%;
  width: 6px;
  height: 6px;
  margin-left: -3px;
  border-radius: 50%;
  background: var(--live);
}

.cal-day:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }

/* Room above and below so the first and last hour labels are not cut. */
.cal-body { padding: 10px 0 8px; }

.cal-hours,
.cal-col {
  position: relative;
  height: calc(var(--span) * var(--ppm));
}

.cal-hour {
  position: absolute;
  top: calc(var(--top) * var(--ppm));
  right: 4px;
  transform: translateY(-50%);
  font-size: 11px;
  line-height: 1;
  color: var(--text-sub);
  font-variant-numeric: tabular-nums;
}

/* A hairline every hour, level with the hour labels; the border closes the
   last hour. */
.cal-col {
  border-bottom: 1px solid var(--line);
  background: repeating-linear-gradient(to bottom, var(--line) 0 1px, transparent 1px calc(60 * var(--ppm)));
}

/* ---------- BLOCKS ---------- */
.cal-block {
  position: absolute;
  top: calc(var(--top) * var(--ppm));
  left: calc(100% * var(--lane) / var(--lanes));
  width: calc(100% / var(--lanes) - 2px);
  height: calc(var(--height) * var(--ppm) - 2px);
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 1px;
  min-width: 0;
  overflow: hidden;
  padding: 3px 5px 3px 6px;
  border: 0;
  border-left: 3px solid var(--accent);
  border-radius: 8px;
  background: var(--accent-soft);
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: box-shadow .18s ease;
  -webkit-tap-highlight-color: transparent;
}

.cal-time {
  font-size: 11px;
  font-weight: 600;
  line-height: 14px;
  color: var(--text-sub);
  font-variant-numeric: tabular-nums;
}

/* As many name lines as the block has room for (--lines, views/calendar.js). */
.cal-name {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: var(--lines);
  overflow: hidden;
  font-size: 12px;
  font-weight: 700;
  line-height: 16px;
  overflow-wrap: anywhere;
}

.cal-block.is-short .cal-time { display: none; }

/* Open slots: dashed like the empty card. */
.cal-block.is-empty { border: 1px dashed #c3cfc7; background: #f7faf8; }
.cal-block.is-empty .cal-name { color: var(--empty-ink); font-weight: 600; }

.cal-block:focus-visible { z-index: 3; outline: 2px solid var(--primary); outline-offset: 2px; }

@media (hover: hover) {
  .cal-block:hover { box-shadow: var(--shadow-md); }
  .cal-day:hover { background: var(--accent-soft); }
}

/* ---------- LIVE AND PAST ---------- */
/* Same colours as the time chip in the list (timeline.css). */
.cal-block.is-now { background: var(--live); border-left-color: var(--live-strong); }
.cal-block.is-now .cal-time,
.cal-block.is-now .cal-name { color: var(--live-ink); }

.cal-block.is-past { background: #e4e8e5; border-left-color: #a3aba6; }
.cal-block.is-past .cal-time,
.cal-block.is-past .cal-name { color: #58605b; }

@media (prefers-reduced-motion: no-preference) {
  .cal-block.is-now { animation: live-chip 1.6s ease-out infinite; }
}

/* The current time, in today's column only. */
.cal-now {
  position: absolute;
  top: calc(var(--top) * var(--ppm));
  left: 0;
  right: 0;
  z-index: 2;
  height: 2px;
  margin-top: -1px;
  background: var(--live-strong);
  pointer-events: none;
}

.cal-now::before {
  content: "";
  position: absolute;
  top: -3px;
  left: -4px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--live);
  box-shadow: 0 0 0 1px var(--live-strong);
}

@media (min-width: 761px) {
  .cal { --ppm: 1.2px; --gutter: 48px; padding: 0 20px 20px; border-radius: var(--radius); }
  .cal-head { margin: 0 -20px; padding: 8px 20px; border-radius: var(--radius) var(--radius) 0 0; }
  .cal-name { font-size: 13px; line-height: 17px; }
}
```

- [ ] **Step 3: Link the stylesheet in `index.html`**

Replace:

```html
  <link rel="stylesheet" href="css/timeline.css">
```

with:

```html
  <link rel="stylesheet" href="css/timeline.css">
  <link rel="stylesheet" href="css/calendar.css">
```

- [ ] **Step 4: Wire the calendar into `js/main.js`**

Add imports — after `import { buildTrip } from './model/trip.js';`:

```js
import { buildCalendar } from './model/calendar.js';
```

after `import { renderDay } from './views/day.js';`:

```js
import { createCalendar } from './views/calendar.js';
```

After `const DATA_URL = 'data/trip.json';` and the `loadTrip` function, add:

```js
// Reading localStorage throws where site data is blocked; the list/calendar
// choice is then just not remembered.
function safeStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
```

In `mount`, replace:

```js
  const tabbar = renderTabs(trip.days, { fund: Boolean(fund) });
  const panels = [...trip.days.map((day) => renderDay(day, { fund: Boolean(fund) })), fund?.panel].filter(Boolean);
  const main = h('main', { class: fund?.fab ? 'wrap has-fab' : 'wrap' }, panels, renderFooter(trip.footer));
```

with:

```js
  const tabbar = renderTabs(trip.days, { fund: Boolean(fund) });
  const calModel = buildCalendar(trip);
  const calendar = createCalendar(calModel);
  const panels = [...trip.days.map((day) => renderDay(day, { fund: Boolean(fund) })), calendar.panel, fund?.panel].filter(Boolean);
  // The list/calendar switch leads the content it switches.
  const main = h('main', { class: fund?.fab ? 'wrap has-fab' : 'wrap' }, calendar.switcher, panels, renderFooter(trip.footer));
```

and replace:

```js
  return { hero, tabbar, countdown, panels, main, fund, hint };
```

with:

```js
  return { hero, tabbar, countdown, panels, main, fund, hint, calendar, calModel };
```

In `start`, replace:

```js
    const tabs = createTabs(view.tabbar.querySelector('[role="tablist"]'), view.panels, {
      onChange: (shown) => shown.forEach((panel) => reveal.replay(panel)),
    });
```

with:

```js
    const tabs = createTabs(view.tabbar.querySelector('[role="tablist"]'), view.panels, {
      onChange: (shown) => {
        shown.forEach((panel) => reveal.replay(panel));
        if (shown.includes(view.calendar.panel)) view.calendar.scrollToNow();
      },
      switcher: view.calendar.switcher,
      storage: safeStorage(),
    });
```

- [ ] **Step 5: Verify layout at 390px**

`npm test` → 82 pass. Then:

```bash
PROBE='(() => { const b = document.querySelector(".cal-block[data-id=day-1-item-1]").getBoundingClientRect(); const col = document.querySelector(".cal-col").getBoundingClientRect(); const hour = document.querySelectorAll(".cal-hour")[2].getBoundingClientRect(); return { top: Math.round(b.top - col.top), h: Math.round(b.height), hour9: Math.round(hour.top + hour.height / 2 - col.top), cols: document.querySelectorAll(".cal-col").length, blocks: document.querySelectorAll(".cal-block").length, list: document.getElementById("panel-day-1").hidden, cal: document.getElementById("panel-calendar").hidden, pressed: document.querySelector("[data-view=calendar]").getAttribute("aria-pressed"), stored: localStorage.getItem("dalat:schedule-view") }; })()' \
SHOT=1 node $SCRATCH/shot.mjs $SCRATCH/t4-390 "$B" 390 1 'document.querySelector("[data-view=calendar]").click()'
```

Expected: `scrollWidth=390`; `probe: {"top":0,"h":118,"hour9":120,"cols":3,"blocks":21,"list":true,"cal":false,"pressed":"true","stored":"calendar"}`; no `exception:`. Open `$SCRATCH/t4-390.png`: three columns, hour labels, dashed open slots on day 2/3, names readable.

- [ ] **Step 6: Verify other widths, sticky row and the switch visibility**

```bash
for w in 360 430; do PROBE='document.documentElement.scrollWidth === innerWidth' node $SCRATCH/shot.mjs $SCRATCH/t4-$w "$B" $w 1 'document.querySelector("[data-view=calendar]").click()'; done
PROBE='Math.round(document.querySelector(".cal-block[data-id=day-1-item-1]").getBoundingClientRect().height)' SHOT=1 node $SCRATCH/shot.mjs $SCRATCH/t4-1440 "$B" 1440 0 'document.querySelector("[data-view=calendar]").click()'
PROBE='[Math.round(document.querySelector(".cal-head").getBoundingClientRect().top), Math.round(document.querySelector(".tabbar").getBoundingClientRect().bottom)]' SHOT=1 node $SCRATCH/shot.mjs $SCRATCH/t4-sticky "$B" 390 1 'document.querySelector("[data-view=calendar]").click(); window.scrollTo(0, document.querySelector(".cal").offsetTop + 500)'
PROBE='[document.querySelector(".view-switch").hidden, document.getElementById("panel-calendar").hidden]' node $SCRATCH/shot.mjs $SCRATCH/t4-day "$B" 390 1 'document.querySelector("[data-view=calendar]").click(); document.querySelector("#tab-day-2").click()'
```

Expected:
- 360 / 430: `probe: true`.
- 1440: `probe: 142`; screenshot shows wide columns, 2-line names.
- sticky: the two numbers differ by at most 2 (78px fallback; exact once Task 6 measures the bar); screenshot shows the day row right under the tab bar.
- day tab: `probe: [true,true]`.

- [ ] **Step 7: Commit**

```bash
git add js/views/calendar.js css/calendar.css index.html js/main.js
git commit -m "feat: show the trip as a week calendar under the all-days tab

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Live state on the calendar

**Files:**
- Modify: `js/controllers/status.js`
- Modify: `js/main.js`

**Interfaces:**
- Consumes: `nowMark(calendar, now, timezone)` (Task 1); `calendar.update(state)`, `calendar.panel` (Task 4); `view.calendar`, `view.calModel` from `mount()` (Task 4).
- Produces: `startStatus({ trip, root, countdown, tabs, clock, hint, calendar, calModel })` — `calendar` and `calModel` are required.

- [ ] **Step 1: Import `nowMark` and accept the calendar in `js/controllers/status.js`**

After `import { localDateOf } from '../lib/time.js';` add:

```js
import { nowMark } from '../model/calendar.js';
```

Replace:

```js
export function startStatus({ trip, root, countdown, tabs, clock, hint }) {
```

with:

```js
export function startStatus({ trip, root, countdown, tabs, clock, hint, calendar, calModel }) {
```

- [ ] **Step 2: Update the calendar each tick and stay on it**

Replace the whole `tick` function (from `  function tick() {` through `    timer = setTimeout(tick, status.phase === 'soon' ? FAST_TICK_MS : SLOW_TICK_MS);` and its closing `  }`) with:

```js
  function tick() {
    const now = clock();
    const status = getStatus(trip, now);
    const today = localDateOf(now, trip.timezone);
    const todayId = trip.days.find((day) => day.date === today)?.id ?? null;
    const nextId = status.current?.id ?? null;
    tabs.markToday(todayId);

    for (const [id, el] of elements) {
      const live = status.current?.id === id;
      const past = status.pastIds.has(id);
      el.classList.toggle('is-now', live);
      el.classList.toggle('is-past', past);
      setStateTag(el, live ? 'now' : past ? 'past' : null);
    }
    calendar.update({ currentId: nextId, pastIds: status.pastIds, todayId, mark: nowMark(calModel, now, trip.timezone) });
    countdown.update(describeStatus(trip, status), status.phase);

    // When a slot starts: follow it, or offer it if the viewer is busy. The
    // calendar lights the new slot up itself, so a viewer on it stays put.
    if (firstTick) {
      firstTick = false;
      jumpToLive(status);
    } else if (!calendar.panel.hidden) {
      dismiss();
    } else {
      const action = followAction({ previousId: currentId, currentId: nextId, idleMs: Date.now() - lastInput });
      if (action === 'move') moveTo(status.current);
      else if (action === 'hint') offer(status.current);
    }
    if (offered && offered.id !== nextId) dismiss();
    currentId = nextId;

    timer = setTimeout(tick, status.phase === 'soon' ? FAST_TICK_MS : SLOW_TICK_MS);
  }
```

- [ ] **Step 3: Pass the calendar from `js/main.js`**

Replace:

```js
    startStatus({ trip, root: view.main, countdown: view.countdown, tabs, clock, hint: view.hint });
```

with:

```js
    startStatus({
      trip, root: view.main, countdown: view.countdown, tabs, clock, hint: view.hint,
      calendar: view.calendar, calModel: view.calModel,
    });
```

- [ ] **Step 4: Verify states at each moment**

`npm test` → 82 pass. Define the probe once:

```bash
P='(() => { const q = (s) => [...document.querySelectorAll(s)]; const line = document.querySelector(".cal-now"); return { now: q(".cal-block.is-now").map((b) => b.dataset.id), past: q(".cal-block.is-past").length, line: line.hidden ? null : [line.parentElement.dataset.dayId, line.style.getPropertyValue("--top")], today: q(".cal-day[data-today]").map((d) => d.dataset.dayId), label: document.querySelector(".cal-block[data-id=day-1-item-3]").getAttribute("aria-label") }; })()'
SW='document.querySelector("#tab-all").click(); document.querySelector("[data-view=calendar]").click()'
for t in 2026-10-10T09:00:00 2026-10-16T12:00:00 2026-10-16T12:30:00 2026-10-19T00:00:00; do
  echo "== $t"; PROBE="$P" SHOT=1 node $SCRATCH/shot.mjs $SCRATCH/t5-${t%%:*} "${B}?now=${t}%2B07:00" 390 1 "$SW"
done
```

Expected probes:
- `2026-10-10T09:00`: `{"now":[],"past":0,"line":null,"today":[],"label":"Ngày 1, 11:00 – 12:15, Gà nướng + Cơm lam"}`
- `2026-10-16T12:00`: `{"now":["day-1-item-3"],"past":2,"line":["day-1","300"],"today":["day-1"],"label":"Ngày 1, 11:00 – 12:15, Gà nướng + Cơm lam, đang diễn ra"}`
- `2026-10-16T12:30`: `{"now":[],"past":3,"line":["day-1","330"],"today":["day-1"],"label":"Ngày 1, 11:00 – 12:15, Gà nướng + Cơm lam, đã qua"}`
- `2026-10-19T00:00`: `{"now":[],"past":21,"line":null,"today":[],"label":"Ngày 1, 11:00 – 12:15, Gà nướng + Cơm lam, đã qua"}`

(The clock keeps running after load, so `--top` may read one minute later, e.g. `"301"`.) Screenshots: lime block at 12:00, grey blocks before it, lime line across day 1 only.

- [ ] **Step 5: Verify opening the calendar centres the now line**

```bash
PROBE='(() => { const r = document.querySelector(".cal-now").getBoundingClientRect(); return Math.round(r.top - innerHeight / 2); })()' \
SHOT=1 node $SCRATCH/shot.mjs $SCRATCH/t5-centre "${B}?now=2026-10-16T17:00:00%2B07:00" 390 1 "$SW"
```

Expected: `|probe| ≤ 40` (the page end limits how far it can scroll).

- [ ] **Step 6: Verify a viewer on the calendar is not pulled away**

Slot `day-1-item-4` starts at 12:45; the slow tick (15s) sees it within 25s.

```bash
PROBE='window.__p' node $SCRATCH/shot.mjs $SCRATCH/t5-stay "${B}?now=2026-10-16T12:44:50%2B07:00" 390 1 \
  '(async () => { document.querySelector("#tab-all").click(); document.querySelector("[data-view=calendar]").click(); await new Promise((r) => setTimeout(r, 25000)); window.__p = { tab: document.querySelector("[role=tab][aria-selected=true]").id, cal: !document.getElementById("panel-calendar").hidden, hint: !document.querySelector(".now-hint").hidden, now: [...document.querySelectorAll(".cal-block.is-now")].map((b) => b.dataset.id) }; })()'
```

Expected: `probe: {"tab":"tab-all","cal":true,"hint":false,"now":["day-1-item-4"]}`.

- [ ] **Step 7: Commit**

```bash
git add js/controllers/status.js js/main.js
git commit -m "feat: mark the slot in progress and the current time on the calendar

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Tap a block to open its card

**Files:**
- Create: `js/controllers/calendar.js`
- Modify: `js/controllers/status.js` (`moveTo`, new `flashItem`, return value)
- Modify: `js/views/day.js` (`renderItem`)
- Modify: `css/timeline.css` (before `/* ---------- NOW HINT ---------- */`)
- Modify: `css/motion/keyframes.css` (after `@keyframes live-dot`)
- Modify: `js/main.js`

**Interfaces:**
- Consumes: `tabs.select(id, { user })` (Task 2); `calendar.panel` (Task 4); `startStatus` (Task 5).
- Produces:
  - `startStatus(…)` returns `{ show(itemId: string): void }` — opens the slot's day, centres its card, flashes and focuses it.
  - `startCalendar({ view, tabs, show, tabbar })` — `view` is the `createCalendar` result, `tabbar` the `.tabbar` element.

- [ ] **Step 1: Make slots focusable in `js/views/day.js`**

In `renderItem`, replace:

```js
  return h('div', { class: 'item', dataset: { id: item.id }, style: { '--i': String(item.order) } },
```

with:

```js
  // Focusable from script only: the calendar lands keyboard users here.
  return h('div', { class: 'item', tabindex: '-1', dataset: { id: item.id }, style: { '--i': String(item.order) } },
```

- [ ] **Step 2: Flash and focus in `js/controllers/status.js`**

After `const SCROLL_DELAY_MS = 400; // let the opened panel lay out first` add:

```js
const FLASH_MS = 1200; // two .6s rings (timeline.css)
```

After `let timer = 0;` add:

```js
  let flashTimer = 0;
```

Replace the whole `moveTo` function with:

```js
  // Later moves only switch tabs when the slot is not on screen at all, so
  // "Tất cả" stays open if that is where the viewer is. `flash` is for slots
  // picked on the calendar: the card rings and takes focus once in view.
  function moveTo(item, { openDay = false, flash = false } = {}) {
    dismiss();
    const el = elements.get(item.id);
    if (!el) return;
    const switchTab = openDay || el.closest('.panel').hidden;
    if (switchTab) tabs.select(item.dayId);
    const arrive = () => {
      el.scrollIntoView({ behavior: reduceMotion.matches ? 'instant' : 'smooth', block: 'center' });
      if (flash) flashItem(el);
    };
    if (switchTab) setTimeout(arrive, SCROLL_DELAY_MS);
    else arrive();
  }

  function flashItem(el) {
    root.querySelector('.item.is-flash')?.classList.remove('is-flash');
    clearTimeout(flashTimer);
    void el.offsetWidth; // restart the rings when the same slot is picked again
    el.classList.add('is-flash');
    el.focus({ preventScroll: true });
    flashTimer = setTimeout(() => el.classList.remove('is-flash'), FLASH_MS);
  }
```

Replace the last lines of `startStatus`:

```js
  tick();
}
```

with:

```js
  tick();

  return {
    show(itemId) {
      const item = trip.items.find((entry) => entry.id === itemId);
      if (item) moveTo(item, { openDay: true, flash: true });
    },
  };
}
```

- [ ] **Step 3: Style the flash**

In `css/timeline.css`, insert right before `/* ---------- NOW HINT ---------- */`:

```css
/* ---------- PICKED ON THE CALENDAR ---------- */
/* The card rings twice (controllers/status.js); the ring stands in for the
   focus outline the slot gets at the same moment. */
.item:focus { outline: none; }
.item.is-flash .card { box-shadow: 0 0 0 3px rgba(var(--accent-rgb), .45); }

@media (prefers-reduced-motion: no-preference) {
  .item.is-flash .card { box-shadow: none; animation: flash .6s ease-out 2; }
}

```

In `css/motion/keyframes.css`, insert right after the closing `}` of `@keyframes live-dot`:

```css

/* A slot picked on the calendar rings twice (timeline.css). */
@keyframes flash {
  0% { box-shadow: 0 0 0 0 rgba(var(--accent-rgb), .6); }
  100% { box-shadow: 0 0 0 8px rgba(var(--accent-rgb), 0); }
}
```

- [ ] **Step 4: Create `js/controllers/calendar.js`**

```js
// Taps on the calendar: a block opens its day at that card, a day heading
// opens the day. The heading row sticks right under the tab bar, whatever
// height the bar ends up with.
export function startCalendar({ view, tabs, show, tabbar }) {
  view.panel.addEventListener('click', (event) => {
    const block = event.target.closest('.cal-block');
    if (block) {
      show(block.dataset.id);
      return;
    }
    const day = event.target.closest('.cal-day');
    if (day) tabs.select(day.dataset.dayId, { user: true });
  });

  const measure = () => view.panel.style.setProperty('--tabbar-h', `${tabbar.offsetHeight}px`);
  measure();
  if ('ResizeObserver' in window) new ResizeObserver(measure).observe(tabbar);
}
```

- [ ] **Step 5: Wire it in `js/main.js`**

After `import { startStatus } from './controllers/status.js';` add:

```js
import { startCalendar } from './controllers/calendar.js';
```

Replace:

```js
    startStatus({
      trip, root: view.main, countdown: view.countdown, tabs, clock, hint: view.hint,
      calendar: view.calendar, calModel: view.calModel,
    });
```

with:

```js
    const status = startStatus({
      trip, root: view.main, countdown: view.countdown, tabs, clock, hint: view.hint,
      calendar: view.calendar, calModel: view.calModel,
    });
    startCalendar({ view: view.calendar, tabs, show: status.show, tabbar: view.tabbar });
```

- [ ] **Step 6: Verify tapping a block**

`npm test` → 82 pass. Then:

```bash
PROBE='window.__p' SHOT=1 node $SCRATCH/shot.mjs $SCRATCH/t6-jump "$B" 390 1 \
  '(async () => { document.querySelector("[data-view=calendar]").click(); await new Promise((r) => setTimeout(r, 300)); document.querySelector(".cal-block[data-id=day-2-item-5]").click(); await new Promise((r) => setTimeout(r, 900)); const el = document.querySelector(".item[data-id=day-2-item-5]"); const r = el.getBoundingClientRect(); window.__p = { tab: document.querySelector("[role=tab][aria-selected=true]").id, flash: el.classList.contains("is-flash"), focused: document.activeElement === el, centre: Math.round(r.top + r.height / 2 - innerHeight / 2), ring: getComputedStyle(el.querySelector(".card")).boxShadow }; })()'
```

Expected: `probe: {"tab":"tab-day-2","flash":true,"focused":true,"centre":<between -40 and 40>,"ring":"rgba(82, 121, 111, 0.45) 0px 0px 0px 3px"}` (reduced motion → static ring). Screenshot: Chênh Vênh card centred with a green ring.

With motion on, the ring animates instead:

```bash
MOTION=1 PROBE='window.__p' node $SCRATCH/shot.mjs $SCRATCH/t6-motion "$B" 390 1 \
  '(async () => { document.querySelector("[data-view=calendar]").click(); await new Promise((r) => setTimeout(r, 300)); document.querySelector(".cal-block[data-id=day-2-item-5]").click(); await new Promise((r) => setTimeout(r, 700)); window.__p = getComputedStyle(document.querySelector(".item[data-id=day-2-item-5] .card")).animationName; })()'
```

Expected: `probe: "flash"`.

- [ ] **Step 7: Verify the day heading, the sticky offset and the remembered view**

```bash
PROBE='[document.querySelector("[role=tab][aria-selected=true]").id, document.querySelector(".view-switch").hidden]' node $SCRATCH/shot.mjs $SCRATCH/t6-head "$B" 390 1 'document.querySelector("[data-view=calendar]").click(); document.querySelector(".cal-day[data-day-id=day-3]").click()'
PROBE='[Math.round(document.querySelector(".cal-head").getBoundingClientRect().top), Math.round(document.querySelector(".tabbar").getBoundingClientRect().bottom), document.getElementById("panel-calendar").style.getPropertyValue("--tabbar-h")]' node $SCRATCH/shot.mjs $SCRATCH/t6-sticky "$B" 390 1 'document.querySelector("[data-view=calendar]").click(); window.scrollTo(0, document.querySelector(".cal").offsetTop + 500)'
PROBE='[document.getElementById("panel-calendar").hidden, document.querySelector("[data-view=calendar]").getAttribute("aria-pressed")]' node $SCRATCH/shot.mjs $SCRATCH/t6-reload "$B" 390 1 'document.querySelector("[data-view=calendar]").click(); location.reload()'
INIT='Object.defineProperty(window, "localStorage", { get() { throw new Error("blocked"); } })' PROBE='[document.getElementById("panel-calendar").hidden, document.querySelector("[data-view=list]").getAttribute("aria-pressed")]' node $SCRATCH/shot.mjs $SCRATCH/t6-blocked "$B" 390 1 'document.querySelector("[data-view=calendar]").click(); document.querySelector("[data-view=list]").click()'
```

Expected:
- head: `probe: ["tab-day-3",true]`.
- sticky: first two numbers equal; third is the bar height in px (e.g. `"78px"`).
- reload: `probe: [false,"true"]` (calendar still shown after reload).
- blocked: `probe: [true,"true"]`, and no `exception:` line (the switch works, nothing remembered).

- [ ] **Step 8: Commit**

```bash
git add js/controllers/calendar.js js/controllers/status.js js/views/day.js css/timeline.css css/motion/keyframes.css js/main.js
git commit -m "feat: open a slot's card from the calendar

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: README and full check

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: everything above. Produces documentation only.

- [ ] **Step 1: Table of contents**

Replace:

```markdown
  - [Quỹ chung & chi phí](#10-quỹ-chung--chi-phí)
```

with:

```markdown
  - [Quỹ chung & chi phí](#10-quỹ-chung--chi-phí)
  - [Lịch biểu](#11-lịch-biểu)
```

- [ ] **Step 2: Section 2 (tabs)**

Replace:

```markdown
- Nhiều ngày không đủ chỗ thì hàng tab vuốt ngang được, tab vừa chọn tự cuộn vào tầm nhìn.
```

with:

```markdown
- Nhiều ngày không đủ chỗ thì hàng tab vuốt ngang được, tab vừa chọn tự cuộn vào tầm nhìn.
- Tab `Tất cả` có công tắc `Danh sách | 📅 Lịch` ngay trên nội dung — xem [Lịch biểu](#11-lịch-biểu).
```

- [ ] **Step 3: Section 5 (real time)**

Replace:

```markdown
- Giờ trong dữ liệu tính theo múi giờ chuyến đi (`+07:00`), nên xem từ máy ở múi giờ khác vẫn đúng.
```

with:

```markdown
- **Lịch biểu cũng theo thời gian thực:** khối đang diễn ra xanh chanh nhấp nháy, khối đã qua xám, vạch giờ hiện tại ở cột hôm nay. Đang xem lịch thì trang không tự chuyển sang tab ngày khi khung mới bắt đầu.
- Giờ trong dữ liệu tính theo múi giờ chuyến đi (`+07:00`), nên xem từ máy ở múi giờ khác vẫn đúng.
```

- [ ] **Step 4: New section 11**

Replace:

```markdown
- **Chưa kết nối Sheet:** trang vẫn hiện toàn bộ dự kiến, tab Quỹ ghi `Chưa kết nối Google Sheet`.
```

with:

```markdown
- **Chưa kết nối Sheet:** trang vẫn hiện toàn bộ dự kiến, tab Quỹ ghi `Chưa kết nối Google Sheet`.

### 11. Lịch biểu

Cả chuyến đi trên một lưới, như lịch tuần: mỗi cột một ngày, trục dọc là giờ.

- **Bật:** tab `Tất cả` → công tắc `📅 Lịch`. Trang nhớ lựa chọn cho lần mở sau; trình duyệt chặn lưu dữ liệu thì mở lại vẫn là `Danh sách`.
- **Khung giờ tự tính:** từ giờ tròn trước khung sớm nhất tới giờ tròn sau khung trễ nhất của cả chuyến (`07:00 – 22:00`), vạch mảnh mỗi giờ.
- **Mỗi khung là một khối** đặt đúng giờ, cao đúng thời lượng — khoảng trống giữa các khung thấy ngay. Khối ghi giờ bắt đầu và icon + tên; tên dài xuống dòng khi khối đủ cao, hết chỗ thì `…`. Khung dưới 40 phút chỉ ghi tên. Khung trống viền nét đứt.
- **Hai khung chồng giờ** trong một ngày thì chia đôi bề ngang, không đè nhau.
- **Hàng tên ngày** (`Ngày 1 · T6 16/10`) dính ngay dưới thanh tab khi cuộn; ngày đang diễn ra có chấm xanh. Bấm tên ngày → mở tab ngày đó.
- **Bấm một khối** → mở tab ngày, thẻ của khung đó cuộn vào giữa màn hình và nháy viền hai lần (bật "Giảm chuyển động" thì viền hiện tĩnh).
- **Trong chuyến:** bật lịch thì vạch giờ hiện tại tự vào giữa màn hình.
- Điện thoại 1 phút = 1px (cả ngày ~900px), máy tính 1,2px. Nhiều ngày thì cột hẹp lại chứ không cuộn ngang.
```

- [ ] **Step 5: Test table**

Replace:

```markdown
| `tests/time.test.js` | Định dạng giờ/ngày, thứ trong tuần, suy ra buổi cho mọi khung giờ, điền `{days}`/`{nights}`, thứ ngắn `T6 16/10`, thời lượng `1 giờ 20 phút`, ngày theo múi giờ chuyến đi |
```

with:

```markdown
| `tests/time.test.js` | Định dạng giờ/ngày, thứ trong tuần, suy ra buổi cho mọi khung giờ, điền `{days}`/`{nights}`, thứ ngắn `T6 16/10`, thời lượng `1 giờ 20 phút`, ngày và phút theo múi giờ chuyến đi |
| `tests/calendar.test.js` | Khung giờ lịch làm tròn tới giờ, vị trí và chiều cao khối, chia làn khi chồng giờ, vạch giờ hiện tại (ngoài ngày / ngoài giờ) |
| `tests/tabs.test.js` | Tab nào hiện panel nào ở chế độ Danh sách / Lịch, đọc lựa chọn đã nhớ khi bộ nhớ trình duyệt thiếu hoặc lỗi |
```

- [ ] **Step 6: Folder structure and docs**

Replace:

```markdown
  hero.css · tabs.css · timeline.css · countdown.css · fund.css
```

with:

```markdown
  hero.css · tabs.css · timeline.css · calendar.css · countdown.css · fund.css
```

Replace:

```markdown
  model/                dữ liệu → model, trạng thái chuyến đi, sổ quỹ (thuần, có test)
  views/                hero, tabs, ngày, panel trạng thái, quỹ, footer, lỗi
  controllers/          tabs, đồng hồ thời gian thực, reveal, parallax dự phòng, tải sổ quỹ
```

with:

```markdown
  model/                dữ liệu → model, trạng thái chuyến đi, lưới lịch biểu, sổ quỹ (thuần, có test)
  views/                hero, tabs, ngày, lịch biểu, panel trạng thái, quỹ, footer, lỗi
  controllers/          tabs, đồng hồ thời gian thực, bấm lịch biểu, reveal, parallax dự phòng, tải sổ quỹ
```

Replace:

```markdown
- [Thiết kế tinh gọn giao diện](docs/specs/2026-09-14-ui-polish-design.md) · [Kế hoạch](docs/plans/2026-09-14-ui-polish.md).
```

with:

```markdown
- [Thiết kế tinh gọn giao diện](docs/specs/2026-09-14-ui-polish-design.md) · [Kế hoạch](docs/plans/2026-09-14-ui-polish.md).
- [Thiết kế lịch biểu](docs/specs/2026-09-15-calendar-view-design.md) · [Kế hoạch](docs/plans/2026-09-15-calendar-view.md).
```

- [ ] **Step 7: Full check**

1. `npm test` → 82 pass, 0 fail.
2. Seven days, narrowest phone (4 extra one-slot days patched into the data):

```bash
INIT='const f = window.fetch; window.fetch = async (u, o) => { const r = await f(u, o); if (!String(u).endsWith("trip.json")) return r; const d = await r.json(); for (let i = 19; i <= 22; i++) d.days.push({ date: "2026-10-" + i, icon: "🧳", items: [{ start: "09:00", end: "10:00", icon: "🧳", title: "Thêm " + i }] }); return new Response(JSON.stringify(d)); };' \
PROBE='[document.documentElement.scrollWidth === innerWidth, document.querySelectorAll(".cal-col").length, Math.round(document.querySelector(".cal-col").getBoundingClientRect().width)]' \
SHOT=1 node $SCRATCH/shot.mjs $SCRATCH/t7-7days "$B" 360 1 'document.querySelector("[data-view=calendar]").click()'
```

Expected: `probe: [true,7,<≈ 35>]`; screenshot shows 7 narrow columns with icons visible, no sideways scroll.

3. Reveal still plays on the list after the calendar:

```bash
MOTION=1 PROBE='window.__p' node $SCRATCH/shot.mjs $SCRATCH/t7-reveal "$B" 390 1 \
  '(async () => { document.querySelector("[data-view=calendar]").click(); await new Promise((r) => setTimeout(r, 400)); document.querySelector("[data-view=list]").click(); document.getElementById("panel-day-1").scrollIntoView(); await new Promise((r) => setTimeout(r, 1500)); window.__p = document.querySelectorAll("#panel-day-1 .item.reveal.in").length; })()'
```

Expected: `probe:` a number > 0.

4. Keyboard reachability: `PROBE='[document.querySelector(".cal-block").tabIndex, document.querySelector(".cal-day").tabIndex, document.querySelector("[data-view=calendar]").tabIndex]' node $SCRATCH/shot.mjs $SCRATCH/t7-keys "$B" 390 1 'document.querySelector("[data-view=calendar]").click()'` → `probe: [0,0,0]`.

5. Manual pass in a real browser (`npm run dev`): Tab to the switch, Enter; Tab through blocks, Enter jumps to the card; `←` `→` on the tab bar still move between tabs; `💰 Quỹ` switch `Sổ chi | Góp quỹ` looks and works as before.

- [ ] **Step 8: Commit**

```bash
git add README.md
git commit -m "docs: describe the calendar view

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```
