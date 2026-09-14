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
  assert.equal(trip.placeCount, 16);
  assert.equal(trip.items.length, 21);
  assert.equal(trip.start.toISOString(), '2026-10-16T00:00:00.000Z');
  assert.equal(trip.end.toISOString(), '2026-10-18T06:00:00.000Z');
});

test('templates are filled', () => {
  assert.equal(trip.hero.subtitle, "16 – 18/10 · 3 ngày 2 đêm — Let's go");
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
    { id: 'day-1', label: 'Day 1', dateText: 'Th 6, 16/10', rangeText: '07:00 → 22:00', count: '9 điểm' },
    { id: 'day-2', label: 'Day 2', dateText: 'Th 7, 17/10', rangeText: '07:00 → 21:30', count: '6 điểm · 2 khung trống' },
    { id: 'day-3', label: 'Day 3', dateText: 'CN, 18/10', rangeText: '07:30 → 13:00', count: '1 điểm · 3 khung trống' },
  ]);
});

test('items carry ids, order, heading and map url', () => {
  const [first] = trip.days[0].items;
  assert.equal(first.id, 'day-1-item-1');
  assert.equal(first.dayId, 'day-1');
  assert.equal(first.order, 0);
  assert.equal(first.heading, '🍃 Đồi chè Cầu Đất — Săn mây, ăn sáng, cà phê');
  assert.equal(first.name, 'Đồi chè Cầu Đất');
  assert.equal(first.detail, 'Săn mây, ăn sáng, cà phê');
  assert.equal(first.period, 'Buổi sáng');
  assert.equal(first.mapUrl, `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Đồi chè Cầu Đất Đà Lạt')}`);
  assert.doesNotMatch(first.mapUrl, /\s/);

  const lastDay = trip.days[2].items;
  const goHome = lastDay[lastDay.length - 1];
  assert.equal(lastDay[0].empty, true);
  assert.equal(goHome.title, 'Go Home');
  assert.equal(goHome.name, 'Go Home');
  assert.equal(goHome.detail, '');
  assert.equal(goHome.tag, 'End trip');
  assert.equal(goHome.tagKey, 'end-trip');
  assert.equal(trip.days[0].items.at(-1).tagKey, 'street-food');
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
