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
