import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keyOf } from '../js/lib/text.js';

test('keyOf ignores case, extra spaces and Unicode form', () => {
  assert.equal(keyOf('  Day 1 ·  Hidden   Land '), 'day 1 · hidden land');
  assert.equal(keyOf('Tra\u0302m'), keyOf('Trâm'));
  assert.equal(keyOf('QUỸ'), keyOf('Quỹ'));
  assert.equal(keyOf(null), '');
  assert.equal(keyOf(undefined), '');
});
