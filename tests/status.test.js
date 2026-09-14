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
    label: 'Đang diễn ra', tiles: null, headline: '🍃 Đồi chè Cầu Đất — Săn mây, ăn sáng, cà phê', note: 'Đến 09:00 · đã qua 0/16 điểm',
  });
});

test('start is inclusive, end is exclusive', () => {
  const atEnd = statusAt('2026-10-16T09:00:00+07:00');
  assert.equal(atEnd.current, null);
  assert.ok(atEnd.pastIds.has('day-1-item-1'));
  assert.deepEqual(describeStatus(trip, atEnd), {
    label: 'Đang di chuyển', tiles: null, headline: '☕ Hidden Land', note: 'Tiếp theo lúc 09:15 · đã qua 1/16 điểm',
  });
  assert.equal(statusAt('2026-10-16T09:15:00+07:00').current.id, 'day-1-item-2');
});

test('empty slots are shown but not counted as places', () => {
  assert.deepEqual(describeAt('2026-10-17T10:30:00+07:00'), {
    label: 'Đang diễn ra', tiles: null, headline: '☕ Cà phê — Tự do', note: 'Đến 11:15 · đã qua 11/16 điểm',
  });
  const afterLunch = statusAt('2026-10-17T12:45:00+07:00');
  assert.equal(afterLunch.pastIds.size, 13);
  assert.equal(afterLunch.pastPlaces, 11);
  assert.equal(afterLunch.next.id, 'day-2-item-5');
});

test('after the trip says goodbye', () => {
  const status = statusAt('2026-10-18T13:00:00+07:00');
  assert.equal(status.phase, 'done');
  assert.equal(status.pastIds.size, 21);
  assert.deepEqual(describeStatus(trip, status), {
    label: 'Hành trình đã khép lại', tiles: null, headline: 'Hẹn gặp lại Đà Lạt ✦', note: 'Đã đi qua 16 điểm trong 3 ngày',
  });
});

test('countdownTiles keeps at least two units and never truncates', () => {
  const tiles = (ms) => countdownTiles(ms).map((tile) => `${tile.value} ${tile.unit}`).join(' ');
  assert.equal(tiles(59_000), '00 phút 59 giây');
  assert.equal(tiles(2 * 86_400_000 + 3 * 3_600_000 + 4 * 60_000 + 5_000), '02 ngày 03 giờ 04 phút 05 giây');
  assert.equal(tiles(100 * 86_400_000), '100 ngày 00 giờ 00 phút 00 giây');
});
