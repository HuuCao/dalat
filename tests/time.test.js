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
