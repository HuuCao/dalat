import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, assertCsv } from '../js/lib/csv.js';

test('plain rows and empty cells', () => {
  assert.deepEqual(parseCsv('a,b\n1,2'), [['a', 'b'], ['1', '2']]);
  assert.deepEqual(parseCsv('a,,c'), [['a', '', 'c']]);
  assert.deepEqual(parseCsv(''), []);
});

test('quoted cells keep commas, quotes and line breaks', () => {
  assert.deepEqual(parseCsv('x,"Hữu, MiMi"'), [['x', 'Hữu, MiMi']]);
  assert.deepEqual(parseCsv('"say ""hi"""'), [['say "hi"']]);
  assert.deepEqual(parseCsv('"a\nb",c\nd,e'), [['a\nb', 'c'], ['d', 'e']]);
});

test('CRLF, BOM and trailing line break', () => {
  assert.deepEqual(parseCsv('a,b\r\n1,2\r\n'), [['a', 'b'], ['1', '2']]);
  assert.deepEqual(parseCsv('\uFEFFa,b\n'), [['a', 'b']]);
});

test('blank rows stay so line numbers match the sheet', () => {
  assert.deepEqual(parseCsv('a\n\nb'), [['a'], [''], ['b']]);
});

test('assertCsv rejects an HTML page', () => {
  assert.equal(assertCsv('a,b'), 'a,b');
  assert.throws(() => assertCsv('\uFEFF  <!DOCTYPE html><html>'), /Sheet chưa publish dạng CSV/);
});
