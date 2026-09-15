import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv } from '../js/lib/csv.js';
import { readTable, parseAmount } from '../js/lib/table.js';

test('readTable finds columns by name, in any order, case or Unicode form', () => {
  const rows = parseCsv('ghi chú, SỐ TIỀN ,Ai trả,Chia cho,Địa điểm\nx,5,Quỹ,,Day 1 · Hidden Land\n,,,,\n');
  const columns = {
    place: { names: ['Địa điểm'], required: true },
    amount: { names: ['Số tiền'], required: true },
    note: { names: ['Ghi chú'] },
    enteredBy: { names: ['Người nhập'] },
  };
  assert.deepEqual(readTable(rows, 'ChiTieu', columns), [
    { line: 2, place: 'Day 1 · Hidden Land', amount: '5', note: 'x', enteredBy: '' },
  ]);
  assert.throws(() => readTable(parseCsv('Địa điểm\n'), 'ChiTieu', { amount: { names: ['Số tiền'], required: true } }), /ChiTieu: thiếu cột "Số tiền"/);
  assert.throws(() => readTable([], 'GopQuy', { member: { names: ['Người góp'], required: true } }), /GopQuy: thiếu cột "Người góp"/);
});

test('amounts keep only digits', () => {
  assert.equal(parseAmount('260000'), 260000);
  assert.equal(parseAmount('260.000'), 260000);
  assert.equal(parseAmount('260,000đ'), 260000);
  assert.equal(parseAmount(''), null);
  assert.equal(parseAmount('abc'), null);
  assert.equal(parseAmount('0'), null);
});
