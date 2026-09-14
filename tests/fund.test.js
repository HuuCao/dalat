import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildTrip } from '../js/model/trip.js';
import { parseCsv } from '../js/lib/csv.js';
import {
  readTable, parseAmount, splitShares, buildLedger,
  describeBucket, describeEntry, describeDay, formUrl, placeLabelAt,
} from '../js/model/fund.js';

const trip = buildTrip(JSON.parse(readFileSync(new URL('../data/trip.json', import.meta.url), 'utf8')));
const MEMBERS = ['Hữu', 'MiMi', 'Khanh', 'Trâm'];

// Scenario from the spec: everyone put in 3.000k, Hữu paid the hotel by card,
// Khanh paid lunch, the fund paid the rest; afternoon of Day 1.
const EXPENSES = [
  'Dấu thời gian,Người nhập,Địa điểm,Số tiền,Ai trả,Chia cho,Ghi chú',
  '01/10/2026 21:00:00,Hữu,Chung · Khách sạn,1080000,Hữu,,Đặt 2 đêm',
  '05/10/2026 10:00:00,MiMi,Chung · Vé xe 2 chiều,2800000,Quỹ,,4 vé',
  '16/10/2026 8:50:00,Khanh,"Day 1 · Đồi chè Cầu Đất — Săn mây, ăn sáng, cà phê",300000,Quỹ,,Vé + ăn sáng',
  '16/10/2026 10:40:00,MiMi,Day 1 · Hidden Land,260000,Quỹ,,4 nước + bánh',
  '16/10/2026 12:20:00,Khanh,Day 1 · Gà nướng + Cơm lam,540000,Khanh,,',
  '16/10/2026 13:10:00,Trâm,Day 1 · Phát sinh,120000,Quỹ,,Áo mưa x4',
  '16/10/2026 14:00:00,Trâm,Day 1 · Trại Mèo Mướp,440000,Quỹ,,Vé kèm nước',
].join('\n');
const CONTRIBUTIONS = [
  'Ngày,Người góp,Số tiền,Ghi chú',
  '10/10,Hữu,3000000,',
  '10/10,MiMi,3000000,',
  '11/10,Khanh,3000000,',
  '11/10,Trâm,3000000,CK',
].join('\n');
const DURING = Date.parse('2026-10-16T15:00:00+07:00');
const AFTER = Date.parse('2026-10-19T00:00:00+07:00');

const ledgerOf = (expenses = EXPENSES, contributions = CONTRIBUTIONS, now = DURING) =>
  buildLedger(trip, { expenses: parseCsv(expenses), contributions: parseCsv(contributions) }, now);
const withRows = (...rows) => ledgerOf([EXPENSES, ...rows].join('\n'));
const balanceSum = (ledger) => ledger.people.reduce((sum, person) => sum + person.balance, 0);

test('readTable finds columns by name, in any order, case or Unicode form', () => {
  const rows = parseCsv('ghi chú, SỐ TIỀN ,Ai trả,Chia cho,Đi\u0323a điểm\nx,5,Quỹ,,Day 1 · Hidden Land\n,,,,\n');
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

test('shares split whole dong and always add up', () => {
  assert.deepEqual(splitShares(100000, 3), [33334, 33333, 33333]);
  assert.deepEqual(splitShares(100001, 4), [25001, 25000, 25000, 25000]);
  assert.equal(splitShares(1_234_567, 7).reduce((a, b) => a + b, 0), 1_234_567);
});

test('the ledger adds up per slot, day, shared costs and trip', () => {
  const ledger = ledgerOf();
  const hidden = ledger.byId.get('day-1-item-2');
  assert.equal(hidden.label, 'Day 1 · Hidden Land');
  assert.equal(hidden.budget, 200000);
  assert.equal(hidden.actual, 260000);
  assert.equal(ledger.byId.get('day-1-item-6').budget, 0);
  assert.equal(ledger.byId.get('day-3-item-4').budget, null);
  assert.equal(ledger.byId.get('shared-2').actual, 1_080_000);
  assert.deepEqual(ledger.days.map(({ id, label, title, budget, actual, extra }) => ({ id, label, title, budget, actual, extra })), [
    { id: 'day-1', label: 'Day 1', title: 'Ngày 1', budget: 3_120_000, actual: 1_660_000, extra: 120_000 },
    { id: 'day-2', label: 'Day 2', title: 'Ngày 2', budget: 3_040_000, actual: 0, extra: 0 },
    { id: 'day-3', label: 'Day 3', title: 'Ngày 3', budget: 920_000, actual: 0, extra: 0 },
  ]);
  assert.equal(ledger.days[0].extraBucket.id, 'day-1-extra');
  assert.deepEqual(
    { budget: ledger.shared.budget, actual: ledger.shared.actual, extra: ledger.shared.extra, costs: ledger.shared.costs.map((c) => c.id) },
    { budget: 4_280_000, actual: 3_880_000, extra: 0, costs: ['shared-1', 'shared-2', 'shared-3'] },
  );
  assert.deepEqual(ledger.totals, {
    budget: 11_360_000, actual: 5_540_000, extra: 120_000,
    contributed: 12_000_000, fundPaid: 3_920_000, fundLeft: 8_080_000, reserve: 640_000,
  });
  assert.deepEqual(ledger.warnings, []);
  assert.equal(ledger.excluded, 0);
});

test('entries are newest first and keep who entered them', () => {
  const ledger = ledgerOf();
  assert.deepEqual(ledger.entries.map((entry) => entry.line), [8, 7, 6, 5, 4, 3, 2]);
  assert.deepEqual(ledger.entries[0], {
    line: 8, label: 'Day 1 · Trại Mèo Mướp', amount: 440000, payer: 'Quỹ', splitFor: MEMBERS,
    note: 'Vé kèm nước', enteredBy: 'Trâm', time: '16/10 14:00', sortKey: Date.UTC(2026, 9, 16, 14, 0), settled: true,
  });
  assert.equal(ledger.byId.get('day-1-item-1').entries[0].time, '16/10 08:50');
  assert.deepEqual(ledger.contributions[3], { line: 5, date: '11/10', member: 'Trâm', amount: 3_000_000, note: 'CK' });
});

test('member balance is contributed + advanced − share and all balances add up to the fund left', () => {
  const ledger = ledgerOf();
  assert.deepEqual(ledger.people, [
    { name: 'Hữu', contributed: 3_000_000, advanced: 1_080_000, share: 1_385_000, balance: 2_695_000 },
    { name: 'MiMi', contributed: 3_000_000, advanced: 0, share: 1_385_000, balance: 1_615_000 },
    { name: 'Khanh', contributed: 3_000_000, advanced: 540_000, share: 1_385_000, balance: 2_155_000 },
    { name: 'Trâm', contributed: 3_000_000, advanced: 0, share: 1_385_000, balance: 1_615_000 },
  ]);
  assert.equal(balanceSum(ledger), ledger.totals.fundLeft);
  assert.equal(ledger.done, false);
  assert.equal(ledger.settlement, null);
});

test('once the trip ends the fund is settled, largest first', () => {
  const ledger = ledgerOf(EXPENSES, CONTRIBUTIONS, AFTER);
  assert.equal(ledger.done, true);
  assert.deepEqual(ledger.settlement.map((line) => line.text), [
    '→ Quỹ hoàn Hữu 2tr695',
    '→ Quỹ hoàn Khanh 2tr155',
    '→ Quỹ hoàn MiMi 1tr615',
    '→ Quỹ hoàn Trâm 1tr615',
  ]);
  assert.deepEqual(ledger.settlement[0], { name: 'Hữu', amount: 2_695_000, direction: 'refund', text: '→ Quỹ hoàn Hữu 2tr695' });

  const short = ledgerOf(EXPENSES, 'Người góp,Số tiền\nHữu,1000000', AFTER);
  assert.deepEqual(short.settlement.map((line) => line.text), [
    '→ MiMi nộp thêm vào quỹ 1tr385',
    '→ Trâm nộp thêm vào quỹ 1tr385',
    '→ Khanh nộp thêm vào quỹ 845k',
    '→ Quỹ hoàn Hữu 695k',
  ]);
  assert.equal(short.totals.reserve, -10_360_000);
  assert.equal(balanceSum(short), short.totals.fundLeft);
});

test('messy rows are normalised, flagged, and never lose money', () => {
  const ledger = withRows(
    '16/10/2026 15:00:00,Hữu,day 1 ·  hidden land ,"50.000đ",quỹ,,',
    '16/10/2026 15:05:00,Hữu,Day 1 · Hiden Land,70000,Quỹ,,',
    '16/10/2026 15:10:00,Hữu,Day 1 · Hidden Land,abc,Quỹ,,',
    '16/10/2026 15:15:00,Hữu,Day 1 · Hidden Land,90000,Tram,,',
    '16/10/2026 15:20:00,Hữu,Day 1 · Hidden Land,30000,Quỹ,"Tra\u0302m, Hữu",',
  );
  assert.deepEqual(ledger.warnings, [
    'Dòng 10 · Địa điểm "Day 1 · Hiden Land" không khớp',
    'Dòng 11 · Số tiền "abc" không hợp lệ',
    'Dòng 12 · Ai trả "Tram" không phải thành viên',
  ]);
  const hidden = ledger.byId.get('day-1-item-2');
  assert.equal(hidden.actual, 260000 + 50000 + 90000 + 30000);
  assert.deepEqual(hidden.entries.find((entry) => entry.line === 13).splitFor, ['Hữu', 'Trâm']);
  assert.equal(hidden.entries.find((entry) => entry.line === 12).settled, false);
  assert.equal(ledger.unmatched.actual, 70000);
  assert.equal(ledger.unmatched.entries[0].label, 'Day 1 · Hiden Land');
  assert.equal(ledger.totals.actual, 5_540_000 + 50000 + 70000 + 90000 + 30000);
  assert.equal(ledger.totals.fundPaid, 3_920_000 + 50000 + 70000 + 30000);
  assert.equal(ledger.excluded, 2);
  assert.equal(balanceSum(ledger), ledger.totals.fundLeft);
});

test('an unknown name in "Chia cho" keeps the row out of the settlement', () => {
  const ledger = withRows('16/10/2026 15:00:00,Hữu,Day 1 · Phát sinh,40000,Quỹ,"Hữu, Bob",Nước');
  assert.deepEqual(ledger.warnings, ['Dòng 9 · Chia cho "Bob" không phải thành viên']);
  assert.equal(ledger.excluded, 1);
  assert.equal(ledger.days[0].extra, 160000);
  assert.equal(ledger.totals.fundPaid, 3_920_000);
});

test('contributions with a bad name or amount are skipped with a warning', () => {
  const ledger = ledgerOf(EXPENSES, 'Ngày,Người góp,Số tiền,Ghi chú\n10/10,Bob,100,\n10/10,Hữu,,\n10/10,hữu,"3.000.000",');
  assert.deepEqual(ledger.warnings, [
    'GopQuy dòng 2 · Người góp "Bob" không phải thành viên',
    'GopQuy dòng 3 · Số tiền "" không hợp lệ',
  ]);
  assert.equal(ledger.totals.contributed, 3_000_000);
  assert.deepEqual(ledger.contributions, [{ line: 4, date: '10/10', member: 'Hữu', amount: 3_000_000, note: '' }]);
  assert.equal(ledger.excluded, 2);
});

test('a sheet without a required column throws a readable error', () => {
  assert.throws(() => ledgerOf('Địa điểm,Ai trả,Chia cho\nx,Quỹ,'), /ChiTieu: thiếu cột "Số tiền"/);
  assert.throws(() => ledgerOf(EXPENSES, 'Ngày,Số tiền\n1,2'), /GopQuy: thiếu cột "Người góp"/);
});

test('without sheets the ledger holds budgets only', () => {
  const ledger = buildLedger(trip, { expenses: null, contributions: null }, DURING);
  assert.equal(ledger.totals.budget, 11_360_000);
  assert.equal(ledger.totals.actual, 0);
  assert.equal(ledger.totals.reserve, -11_360_000);
  assert.equal(ledger.entries.length, 0);
  assert.equal(ledger.people[0].balance, 0);
});

test('describeBucket covers every chip state', () => {
  const chip = (budget, actual) => describeBucket({ budget, actual }, 4);
  assert.deepEqual(chip(200000, 0), { icon: '💰', text: 'Dự kiến 200k · 50k/người', diff: null, tone: 'muted' });
  assert.deepEqual(chip(200000, 180000), { icon: '💰', text: '180k / 200k', diff: '▼ 20k', tone: 'under' });
  assert.deepEqual(chip(440000, 440000), { icon: '💰', text: '440k / 440k', diff: '✓', tone: 'under' });
  assert.deepEqual(chip(200000, 260000), { icon: '💰', text: '260k / 200k', diff: '▲ 60k', tone: 'over' });
  assert.deepEqual(chip(0, 0), { icon: '🆓', text: 'Miễn phí', diff: null, tone: 'muted' });
  assert.deepEqual(chip(0, 20000), { icon: '💰', text: '20k · ngoài dự kiến', diff: null, tone: 'over' });
  assert.deepEqual(chip(null, 0), { icon: '💰', text: 'Chưa chi', diff: null, tone: 'muted' });
  assert.deepEqual(chip(null, 540000), { icon: '💰', text: '540k', diff: null, tone: '' });
});

test('describeEntry reads like the sketch', () => {
  const ledger = ledgerOf();
  assert.deepEqual(describeEntry(ledger.byId.get('day-1-item-2').entries[0], MEMBERS), {
    amount: '260.000đ', payer: 'Quỹ trả', detail: '4 nước + bánh · chia 4', meta: 'MiMi nhập · 16/10 10:40',
  });
  const partial = { amount: 90000, payer: 'Khanh', splitFor: ['Hữu', 'Khanh'], note: '', enteredBy: '', time: '', settled: true };
  assert.deepEqual(describeEntry(partial, MEMBERS), { amount: '90.000đ', payer: 'Khanh ứng', detail: 'chia Hữu, Khanh', meta: '' });
  assert.equal(describeEntry({ ...partial, payer: 'Tram', settled: false }, MEMBERS).payer, 'Tram trả ⚠️');
  assert.equal(describeEntry({ ...partial, splitFor: [], settled: false }, MEMBERS).detail, 'chia ?');
});

test('describeDay shows spend, budget, extras and a capped ratio', () => {
  assert.deepEqual(describeDay({ budget: 3_120_000, actual: 1_560_000, extra: 120_000 }), { text: '💰 1tr560 / 3tr120 · phát sinh 120k', ratio: 0.5, over: false });
  assert.deepEqual(describeDay({ budget: 100, actual: 300, extra: 0 }), { text: '💰 0,3k / 0,1k', ratio: 1, over: true });
  assert.deepEqual(describeDay({ budget: 0, actual: 0, extra: 0 }), { text: '💰 0 / 0', ratio: 0, over: false });
});

test('form links pick the place when the form allows it', () => {
  const fund = { form: { url: 'https://docs.google.com/forms/d/e/abc/viewform', placeField: 'entry.123' } };
  const link = new URL(formUrl(fund, 'Day 1 · Gà nướng + Cơm lam'));
  assert.equal(link.origin + link.pathname, fund.form.url);
  assert.equal(link.searchParams.get('usp'), 'pp_url');
  assert.equal(link.searchParams.get('entry.123'), 'Day 1 · Gà nướng + Cơm lam');
  assert.equal(formUrl(fund, null), fund.form.url);
  assert.equal(formUrl({ form: { url: fund.form.url, placeField: null } }, 'X'), fund.form.url);
  assert.equal(formUrl({ form: null }, 'X'), null);
});

test('placeLabelAt picks the slot in progress, else the one just finished', () => {
  const at = (iso) => placeLabelAt(trip, Date.parse(iso));
  assert.equal(at('2026-10-16T06:00:00+07:00'), null);
  assert.equal(at('2026-10-16T09:30:00+07:00'), 'Day 1 · Hidden Land');
  assert.equal(at('2026-10-16T10:40:00+07:00'), 'Day 1 · Hidden Land');
  assert.equal(at('2026-10-16T15:00:00+07:00'), 'Day 1 · Phong Miên quán — Forest slow café');
  assert.equal(at('2026-10-16T23:00:00+07:00'), 'Day 1 · Ăn vặt chợ Đà Lạt');
  assert.equal(at('2026-10-18T13:00:00+07:00'), null);
});
