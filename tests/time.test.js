import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isTime, isDate, isTimezone, toMinutes, toDate,
  weekdayText, dateText, dateRangeText, derivePeriod, fillTemplate,
  shortWeekdayText, shortDateText, durationText, localDateOf, localMinuteOf,
} from '../js/lib/time.js';

test('dateRangeText shortens a shared month', () => {
  assert.equal(dateRangeText('2026-10-16', '2026-10-18'), '16 – 18/10');
  assert.equal(dateRangeText('2026-10-30', '2026-11-02'), '30/10 – 02/11');
  assert.equal(dateRangeText('2026-10-16', '2026-10-16'), '16/10');
});

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

test('derivePeriod names the part of the day', () => {
  const cases = [
    ['07:00', '09:00', 'Sáng'],
    ['09:15', '10:30', 'Sáng'],
    ['11:00', '12:15', 'Trưa'],
    ['12:45', '14:00', 'Trưa → chiều'],
    ['14:15', '16:00', 'Chiều'],
    ['16:30', '17:45', 'Chiều'],
    ['18:00', '19:00', 'Tối'],
    ['19:30', '21:00', 'Tối'],
    ['08:00', '10:00', 'Sáng'],
    ['11:00', '17:00', 'Trưa → chiều'],
    ['18:00', '21:30', 'Tối'],
    ['08:00', '10:30', 'Sáng'],
    ['11:00', '13:00', 'Trưa'],
  ];
  for (const [start, end, expected] of cases) {
    assert.equal(derivePeriod(start, end), expected, `${start}–${end}`);
  }
});

test('fillTemplate replaces known keys and keeps unknown ones', () => {
  assert.equal(fillTemplate('{days} ngày {nights} đêm {x}', { days: 3, nights: 2 }), '3 ngày 2 đêm {x}');
});

test('short weekday and date for tabs', () => {
  assert.equal(shortWeekdayText('2026-10-16'), 'T6');
  assert.equal(shortWeekdayText('2026-10-18'), 'CN');
  assert.equal(shortDateText('2026-10-16'), 'T6 16/10');
  assert.equal(shortDateText('2026-10-18'), 'CN 18/10');
  assert.equal(shortDateText('2026-03-05'), 'T5 05/03');
});

test('durationText rounds up to the minute', () => {
  assert.equal(durationText(30_000), '< 1 phút');
  assert.equal(durationText(60_000), '1 phút');
  assert.equal(durationText(61_000), '2 phút');
  assert.equal(durationText(59 * 60_000), '59 phút');
  assert.equal(durationText(59 * 60_000 + 1), '1 giờ');
  assert.equal(durationText(2 * 3_600_000), '2 giờ');
  assert.equal(durationText(80 * 60_000), '1 giờ 20 phút');
});

test('durationText counts whole days from 24 hours, rounding up to the hour', () => {
  assert.equal(durationText(23 * 3_600_000 + 59 * 60_000), '23 giờ 59 phút');
  assert.equal(durationText(24 * 3_600_000), '1 ngày');
  assert.equal(durationText(24 * 3_600_000 + 1), '1 ngày 1 giờ');
  assert.equal(durationText(32 * 3_600_000 + 20 * 60_000), '1 ngày 9 giờ');
  assert.equal(durationText(48 * 3_600_000), '2 ngày');
});

test('localDateOf reads the calendar date in the trip timezone', () => {
  assert.equal(localDateOf(Date.parse('2026-10-16T16:59:00Z'), '+07:00'), '2026-10-16');
  assert.equal(localDateOf(Date.parse('2026-10-16T17:00:00Z'), '+07:00'), '2026-10-17');
  assert.equal(localDateOf(Date.parse('2026-10-17T03:00:00Z'), '-03:30'), '2026-10-16');
});

test('localMinuteOf counts minutes from midnight in the trip timezone', () => {
  assert.equal(localMinuteOf(Date.parse('2026-10-16T12:00:00+07:00'), '+07:00'), 720);
  assert.equal(localMinuteOf(Date.parse('2026-10-16T05:00:00Z'), '+07:00'), 720);
  assert.equal(localMinuteOf(Date.parse('2026-10-16T17:30:00Z'), '+07:00'), 30);
  assert.equal(localMinuteOf(Date.parse('2026-10-17T03:00:00Z'), '-03:30'), 1410);
});
