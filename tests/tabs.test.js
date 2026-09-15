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
