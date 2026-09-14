import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatShort, formatFull, formatDiff, formatBalance } from '../js/lib/money.js';

test('formatShort rounds to tenths of a thousand', () => {
  assert.equal(formatShort(0), '0');
  assert.equal(formatShort(260_000), '260k');
  assert.equal(formatShort(1_660_000), '1.660k');
  assert.equal(formatShort(11_360_000), '11.360k');
  assert.equal(formatShort(33_333), '33,3k');
  assert.equal(formatShort(300), '0,3k');
  assert.equal(formatShort(999_960), '1.000k');
  assert.equal(formatShort(-200_000), '−200k');
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
  assert.equal(formatBalance(2_695_000), '+2.695k');
  assert.equal(formatBalance(-200_000), '−200k');
  assert.equal(formatBalance(0), '0');
});
