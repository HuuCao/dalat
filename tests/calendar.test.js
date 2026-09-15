import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildTrip } from '../js/model/trip.js';
import { buildCalendar, nowMark } from '../js/model/calendar.js';

const trip = buildTrip(JSON.parse(readFileSync(new URL('./fixtures/trip.json', import.meta.url), 'utf8')));
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
