import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatShort, formatFull, formatDiff, formatBalance } from '../js/lib/money.js';

test('formatShort writes thousands under a million', () => {
  assert.equal(formatShort(0), '0');
  assert.equal(formatShort(260_000), '260k');
  assert.equal(formatShort(33_333), '33,3k');
  assert.equal(formatShort(300), '0,3k');
  assert.equal(formatShort(999_949), '999,9k');
  assert.equal(formatShort(-200_000), '−200k');
});

test('formatShort writes millions and whole thousands from a million up', () => {
  assert.equal(formatShort(12_000_000), '12tr');
  assert.equal(formatShort(11_760_000), '11tr760');
  assert.equal(formatShort(3_065_000), '3tr065');
  assert.equal(formatShort(2_800_000), '2tr800');
  assert.equal(formatShort(1_660_500), '1tr661');
  assert.equal(formatShort(999_960), '1tr');
  assert.equal(formatShort(1_999_600), '2tr');
  assert.equal(formatShort(1_200_000_000), '1.200tr');
  assert.equal(formatShort(-1_200_000), '−1tr200');
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
  assert.deepEqual(formatDiff(3_000_000, 1_800_000), { text: '▲ 1tr200', tone: 'over' });
  assert.equal(formatBalance(2_695_000), '+2tr695');
  assert.equal(formatBalance(-200_000), '−200k');
  assert.equal(formatBalance(0), '0');
});
