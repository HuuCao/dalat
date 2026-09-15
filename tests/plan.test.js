import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseDate, parseTime, parseBudget, parseFlag, readPlan } from '../js/model/plan.js';
import { sheetsOf, messySheets } from './helpers/sheets.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/trip.json', import.meta.url), 'utf8'));

test('dates read the Vietnam sheet form and ISO, and must exist', () => {
  assert.equal(parseDate('16/10/2026'), '2026-10-16');
  assert.equal(parseDate('6/9/2026'), '2026-09-06');
  assert.equal(parseDate('2026-10-16'), '2026-10-16');
  assert.equal(parseDate('31/9/2026'), null);
  assert.equal(parseDate('16-10-2026'), null);
  assert.equal(parseDate(''), null);
});

test('times accept H:MM, HH:MM and HH:MM:SS', () => {
  assert.equal(parseTime('7:00'), '07:00');
  assert.equal(parseTime('07:00'), '07:00');
  assert.equal(parseTime('7:00:00'), '07:00');
  assert.equal(parseTime('23:59'), '23:59');
  assert.equal(parseTime('24:00'), null);
  assert.equal(parseTime('7h'), null);
  assert.equal(parseTime('7:5'), null);
  assert.equal(parseTime(''), null);
});

test('budgets: blank is none, 0 is free, separators are fine, words are invalid', () => {
  assert.equal(parseBudget(''), undefined);
  assert.equal(parseBudget('0'), 0);
  assert.equal(parseBudget('280000'), 280000);
  assert.equal(parseBudget('280.000'), 280000);
  assert.equal(parseBudget('280,000đ'), 280000);
  assert.equal(parseBudget('hai trăm'), null);
  assert.equal(parseBudget('-5'), null);
  assert.equal(parseBudget('.'), null);
});

test('the empty flag reads a checkbox, x or có', () => {
  for (const yes of ['TRUE', 'true', 'x', 'X', 'có', 'Có']) assert.equal(parseFlag(yes), true, yes);
  for (const no of ['FALSE', '', 'không']) assert.equal(parseFlag(no), false, no);
});

test('clean sheets give the fixture days and shared costs, without warnings', () => {
  const plan = readPlan(sheetsOf(fixture));
  assert.deepEqual(plan.warnings, []);
  assert.equal(plan.days.length, 3);
  assert.deepEqual(plan.days[0].items[1], {
    start: '09:15', end: '10:30', icon: '☕', title: 'Hidden Land', tag: 'Coffee', map: 'Hidden Land coffee Đà Lạt', budget: 200000,
  });
  assert.deepEqual(plan.days[1].items[2], { start: '10:15', end: '11:15', icon: '☕', title: 'Cà phê — Tự do', budget: 280000, empty: true });
  assert.deepEqual(plan.days[2].items.at(-1), { start: '12:15', end: '13:00', icon: '🚗', title: 'Go Home', tag: 'End trip' });
  assert.deepEqual(plan.days[0], { ...plan.days[0], date: '2026-10-16', icon: '🌿' });
  assert.equal('note' in plan.days[0], false);
  assert.equal(plan.days[2].note, 'Ngày cuối');
  assert.deepEqual(plan.shared, fixture.fund.shared);
});

test('bad rows are dropped with the sheet line; a bad budget keeps the row', () => {
  const plan = readPlan(messySheets(fixture));
  assert.deepEqual(plan.warnings, [
    'LichTrinh dòng 23 · Ngày "32/10/2026" không hợp lệ',
    'LichTrinh dòng 24 · Kết thúc "09:00" phải sau Bắt đầu "10:00"',
    'LichTrinh dòng 25 · Bắt đầu "7h" không hợp lệ',
    'LichTrinh dòng 26 · "Phát sinh" là tên dành riêng',
    'LichTrinh dòng 27 · trùng tên "hidden land" với dòng 3',
    'LichTrinh dòng 28 · thiếu Tên',
    'LichTrinh dòng 29 · Dự kiến "hai trăm" không hợp lệ',
    'Ngay dòng 6 · trùng ngày 16/10/2026 với dòng 2',
    'ChiChung dòng 5 · trùng tên "khách sạn" với dòng 3',
    'ChiChung dòng 6 · "Phát sinh" là tên dành riêng',
    'ChiChung dòng 7 · thiếu Tên',
  ]);
  assert.deepEqual(plan.days.map((day) => [day.date, day.items.length]), [
    ['2026-10-16', 9], ['2026-10-17', 9], ['2026-10-18', 4], ['2026-10-19', 0],
  ]);
  assert.deepEqual(plan.days[1].items.at(-1), { start: '06:00', end: '06:30', icon: '⏰', title: 'Dậy sớm' });
  assert.deepEqual(plan.days[3], { date: '2026-10-19', items: [], icon: '🧳', note: 'Ngày thêm' });
  assert.equal(plan.days[0].icon, '🌿');
  assert.equal(plan.shared.length, 3);
});

test('a tab without a required column throws', () => {
  const sheets = sheetsOf(fixture);
  assert.throws(() => readPlan({ ...sheets, items: 'Ngày,Bắt đầu,Tên\n16/10/2026,07:00,X' }), /LichTrinh: thiếu cột "Kết thúc"/);
  assert.throws(() => readPlan({ ...sheets, days: 'Icon\n🌿' }), /Ngay: thiếu cột "Ngày"/);
  assert.throws(() => readPlan({ ...sheets, shared: '' }), /ChiChung: thiếu cột "Tên"/);
});
