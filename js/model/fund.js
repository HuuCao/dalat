import { keyOf } from '../lib/text.js';
import { formatShort, formatFull, formatDiff } from '../lib/money.js';
import { FUND_PAYER } from './trip.js';

const EXPENSE_COLUMNS = {
  time: { names: ['Dấu thời gian', 'Timestamp'] },
  enteredBy: { names: ['Người nhập'] },
  place: { names: ['Địa điểm'], required: true },
  amount: { names: ['Số tiền'], required: true },
  payer: { names: ['Ai trả'], required: true },
  split: { names: ['Chia cho'], required: true },
  note: { names: ['Ghi chú'] },
};

const CONTRIBUTION_COLUMNS = {
  date: { names: ['Ngày'] },
  member: { names: ['Người góp'], required: true },
  amount: { names: ['Số tiền'], required: true },
  note: { names: ['Ghi chú'] },
};

// Google Sheets with the Vietnam locale writes "16/10/2026 8:50:00".
const TIMESTAMP = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/;

const sum = (list, key) => list.reduce((total, entry) => total + (entry[key] ?? 0), 0);
const newestFirst = (a, b) => b.sortKey - a.sortKey || b.line - a.line;
const pad = (value) => value.padStart(2, '0');

// Columns are found by name, so the form's questions can be reordered. Line
// numbers match the sheet (header is line 1); blank rows are skipped.
export function readTable(rows, tableName, columns) {
  const header = (rows[0] ?? []).map(keyOf);
  const positions = Object.entries(columns).map(([key, { names, required }]) => {
    const at = header.findIndex((cell) => names.some((name) => keyOf(name) === cell));
    if (at === -1 && required) throw new Error(`${tableName}: thiếu cột "${names[0]}"`);
    return [key, at];
  });

  return rows.slice(1)
    .map((cells, index) => ({ line: index + 2, cells }))
    .filter(({ cells }) => cells.some((cell) => cell.trim() !== ''))
    .map(({ line, cells }) => Object.fromEntries([
      ['line', line],
      ...positions.map(([key, at]) => [key, at === -1 ? '' : (cells[at] ?? '').trim()]),
    ]));
}

export function parseAmount(text) {
  const digits = String(text ?? '').replace(/\D/g, '');
  const amount = Number(digits);
  return digits && amount > 0 ? amount : null;
}

// Whole dong only: the leftover dong go one each to the first people, so the
// parts always add back up to the amount.
export function splitShares(amount, count) {
  const base = Math.floor(amount / count);
  const rest = amount - base * count;
  return Array.from({ length: count }, (_, index) => base + (index < rest ? 1 : 0));
}

function readTime(text) {
  const match = TIMESTAMP.exec(text);
  if (!match) return { time: text, sortKey: 0 };
  const [, day, month, year, hours, minutes] = match;
  const date = `${pad(day)}/${pad(month)}`;
  return {
    time: hours ? `${date} ${pad(hours)}:${minutes}` : date,
    sortKey: Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hours ?? 0), Number(minutes ?? 0)),
  };
}

export function buildLedger(trip, tables, now) {
  const { fund } = trip;
  const { members } = fund;
  const memberByKey = new Map(members.map((name) => [keyOf(name), name]));
  const people = new Map(members.map((name) => [name, { name, contributed: 0, advanced: 0, share: 0, balance: 0 }]));
  const warnings = [];

  const byId = new Map();
  const byLabel = new Map();
  const addBucket = (id, label, budget) => {
    const bucket = { id, label, budget, actual: 0, entries: [] };
    byId.set(id, bucket);
    byLabel.set(keyOf(label), bucket);
  };
  for (const cost of fund.shared) addBucket(cost.id, cost.formLabel, cost.budget);
  addBucket(fund.sharedExtra.id, fund.sharedExtra.formLabel, null);
  for (const day of trip.days) {
    for (const item of day.items) addBucket(item.id, item.formLabel, item.budget);
    addBucket(`${day.id}-extra`, day.extraLabel, null);
  }
  const unmatched = { id: 'unmatched', label: 'Không khớp địa điểm', budget: null, actual: 0, entries: [] };

  const entries = [];
  let fundPaid = 0;
  let excluded = 0;

  const expenseRows = tables.expenses ? readTable(tables.expenses, 'ChiTieu', EXPENSE_COLUMNS) : [];
  for (const row of expenseRows) {
    const amount = parseAmount(row.amount);
    if (amount === null) {
      warnings.push(`Dòng ${row.line} · Số tiền "${row.amount}" không hợp lệ`);
      excluded += 1;
      continue;
    }

    const bucket = byLabel.get(keyOf(row.place));
    if (!bucket) warnings.push(`Dòng ${row.line} · Địa điểm "${row.place}" không khớp`);

    const payer = keyOf(row.payer) === keyOf(FUND_PAYER) ? FUND_PAYER : memberByKey.get(keyOf(row.payer));
    if (!payer) warnings.push(`Dòng ${row.line} · Ai trả "${row.payer}" không phải thành viên`);

    const named = row.split.split(',').map((name) => name.trim()).filter(Boolean);
    const unknown = named.filter((name) => !memberByKey.has(keyOf(name)));
    for (const name of unknown) warnings.push(`Dòng ${row.line} · Chia cho "${name}" không phải thành viên`);
    const chosen = new Set(named.map((name) => memberByKey.get(keyOf(name))));
    const splitFor = named.length === 0 ? [...members] : members.filter((name) => chosen.has(name));

    const settled = Boolean(payer) && unknown.length === 0;
    const entry = {
      line: row.line,
      label: row.place,
      amount,
      payer: payer ?? row.payer,
      splitFor,
      note: row.note,
      enteredBy: row.enteredBy,
      ...readTime(row.time),
      settled,
    };
    const target = bucket ?? unmatched;
    target.actual += amount;
    target.entries.push(entry);
    entries.push(entry);

    // Money with an unknown payer or sharer still shows in the totals, but
    // cannot be charged to anyone until the sheet is fixed.
    if (!settled) {
      excluded += 1;
      continue;
    }
    if (payer === FUND_PAYER) fundPaid += amount;
    else people.get(payer).advanced += amount;
    splitShares(amount, splitFor.length).forEach((part, index) => {
      people.get(splitFor[index]).share += part;
    });
  }

  const contributions = [];
  const contributionRows = tables.contributions ? readTable(tables.contributions, 'GopQuy', CONTRIBUTION_COLUMNS) : [];
  for (const row of contributionRows) {
    const amount = parseAmount(row.amount);
    if (amount === null) {
      warnings.push(`GopQuy dòng ${row.line} · Số tiền "${row.amount}" không hợp lệ`);
      excluded += 1;
      continue;
    }
    const member = memberByKey.get(keyOf(row.member));
    if (!member) {
      warnings.push(`GopQuy dòng ${row.line} · Người góp "${row.member}" không phải thành viên`);
      excluded += 1;
      continue;
    }
    people.get(member).contributed += amount;
    contributions.push({ line: row.line, date: row.date, member, amount, note: row.note });
  }

  for (const bucket of [...byId.values(), unmatched]) bucket.entries.sort(newestFirst);
  entries.sort(newestFirst);

  const days = trip.days.map((day) => {
    const items = day.items.map((item) => byId.get(item.id));
    const extraBucket = byId.get(`${day.id}-extra`);
    return {
      id: day.id,
      label: day.label,
      budget: sum(items, 'budget'),
      actual: sum(items, 'actual') + extraBucket.actual,
      extra: extraBucket.actual,
      extraBucket,
    };
  });

  const costs = fund.shared.map((cost) => byId.get(cost.id));
  const sharedExtra = byId.get(fund.sharedExtra.id);
  const shared = {
    budget: sum(costs, 'budget'),
    actual: sum(costs, 'actual') + sharedExtra.actual,
    extra: sharedExtra.actual,
    costs,
    extraBucket: sharedExtra,
  };

  const list = [...people.values()];
  for (const person of list) person.balance = person.contributed + person.advanced - person.share;

  const contributed = sum(list, 'contributed');
  const budget = shared.budget + sum(days, 'budget');
  const totals = {
    budget,
    actual: shared.actual + sum(days, 'actual') + unmatched.actual,
    extra: shared.extra + sum(days, 'extra'),
    contributed,
    fundPaid,
    fundLeft: contributed - fundPaid,
    reserve: contributed - budget,
  };

  // Everyone settles with the fund only: one transfer per person.
  const done = now >= trip.end.getTime();
  const settlement = done
    ? list
      .filter((person) => person.balance !== 0)
      .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
      .map(({ name, balance }) => ({
        name,
        amount: Math.abs(balance),
        direction: balance > 0 ? 'refund' : 'topup',
        text: balance > 0
          ? `→ Quỹ hoàn ${name} ${formatShort(balance)}`
          : `→ ${name} nộp thêm vào quỹ ${formatShort(-balance)}`,
      }))
    : null;

  return { totals, days, shared, unmatched, byId, people: list, contributions, entries, warnings, excluded, done, settlement };
}

export function describeBucket({ budget, actual }, memberCount) {
  if (actual === 0) {
    if (budget === null) return { icon: '💰', text: 'Chưa chi', diff: null, tone: 'muted' };
    if (budget === 0) return { icon: '🆓', text: 'Miễn phí', diff: null, tone: 'muted' };
    const each = formatShort(Math.round(budget / memberCount));
    return { icon: '💰', text: `Dự kiến ${formatShort(budget)} · ${each}/người`, diff: null, tone: 'muted' };
  }
  if (budget === null) return { icon: '💰', text: formatShort(actual), diff: null, tone: '' };
  if (budget === 0) return { icon: '💰', text: `${formatShort(actual)} · ngoài dự kiến`, diff: null, tone: 'over' };
  const diff = formatDiff(actual, budget);
  return { icon: '💰', text: `${formatShort(actual)} / ${formatShort(budget)}`, diff: diff.text, tone: diff.tone };
}

export function describeEntry(entry, members) {
  let payer = `${entry.payer} trả ⚠️`;
  if (entry.payer === FUND_PAYER) payer = 'Quỹ trả';
  else if (members.includes(entry.payer)) payer = `${entry.payer} ứng`;

  const split = entry.splitFor.length === 0
    ? 'chia ?'
    : entry.splitFor.length === members.length
      ? `chia ${members.length}`
      : `chia ${entry.splitFor.join(', ')}`;

  return {
    amount: formatFull(entry.amount),
    payer,
    detail: [entry.note, split].filter(Boolean).join(' · '),
    meta: [entry.enteredBy ? `${entry.enteredBy} nhập` : '', entry.time].filter(Boolean).join(' · '),
  };
}

export function progressOf(actual, budget) {
  const ratio = budget > 0 ? Math.min(actual / budget, 1) : Number(actual > 0);
  return { ratio, over: actual > budget };
}

export function describeDay({ budget, actual, extra }) {
  const extraText = extra > 0 ? ` · phát sinh ${formatShort(extra)}` : '';
  return { text: `💰 ${formatShort(actual)} / ${formatShort(budget)}${extraText}`, ...progressOf(actual, budget) };
}

// A pre-filled Google Form link: the place question already answered.
export function formUrl(fund, label) {
  if (!fund.form) return null;
  if (!label || !fund.form.placeField) return fund.form.url;
  const url = new URL(fund.form.url);
  url.searchParams.set('usp', 'pp_url');
  url.searchParams.set(fund.form.placeField, label);
  return url.toString();
}

// People usually pay on the way out, so between two slots the one that just
// ended is the likelier place for a new expense.
export function placeLabelAt(trip, now) {
  if (now < trip.start.getTime() || now >= trip.end.getTime()) return null;
  const current = trip.items.find((item) => now >= item.start.getTime() && now < item.end.getTime());
  const previous = trip.items.filter((item) => now >= item.end.getTime()).at(-1);
  return (current ?? previous)?.formLabel ?? null;
}
