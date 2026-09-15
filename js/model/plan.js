import { parseCsv } from '../lib/csv.js';
import { readTable } from '../lib/table.js';
import { isDate, isTime, toMinutes } from '../lib/time.js';
import { keyOf } from '../lib/text.js';
import { EXTRA_TITLE } from './trip.js';

const ITEM_COLUMNS = {
  date: { names: ['Ngày'], required: true },
  start: { names: ['Bắt đầu'], required: true },
  end: { names: ['Kết thúc'], required: true },
  title: { names: ['Tên'], required: true },
  icon: { names: ['Icon'] },
  tag: { names: ['Tag'] },
  map: { names: ['Maps'] },
  budget: { names: ['Dự kiến'] },
  empty: { names: ['Trống'] },
};

const DAY_COLUMNS = {
  date: { names: ['Ngày'], required: true },
  icon: { names: ['Icon'] },
  note: { names: ['Ghi chú'] },
};

const SHARED_COLUMNS = {
  title: { names: ['Tên'], required: true },
  icon: { names: ['Icon'] },
  budget: { names: ['Dự kiến'] },
  note: { names: ['Ghi chú'] },
};

const VN_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const SHEET_TIME = /^(\d{1,2}):(\d{2})(?::\d{2})?$/;
const YES = new Set(['true', 'x', 'có']);

// "16/10/2026" (Google Sheets, Vietnam) or "2026-10-16".
export function parseDate(text) {
  const match = VN_DATE.exec(text.trim());
  const iso = match ? `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}` : text.trim();
  return isDate(iso) ? iso : null;
}

// Sheets turns a typed "07:00" into "7:00:00" once the cell is a time.
export function parseTime(text) {
  const match = SHEET_TIME.exec(text.trim());
  if (!match) return null;
  const time = `${match[1].padStart(2, '0')}:${match[2]}`;
  return isTime(time) ? time : null;
}

// Plain digits, or 1–3 leading digits followed by one or more 3-digit groups
// separated by ".", "," or a space (Sheets' thousands separators); either can
// carry a 1–2 digit decimal tail after a final "." or ",".
const BUDGET_AMOUNT = /^(\d+|\d{1,3}(?:[.,\s]\d{3})+)([.,](\d{1,2}))?$/;
const CURRENCY_MARK = /\s*(đ|₫|vnd)$/i;

// undefined: no budget. null: something unreadable was typed.
export function parseBudget(text) {
  const value = text.trim();
  if (value === '') return undefined;
  const amount = value.replace(CURRENCY_MARK, '');
  const match = BUDGET_AMOUNT.exec(amount);
  if (!match) return null;
  if (match[3] && /[1-9]/.test(match[3])) return null; // non-zero decimal tail
  return Number(match[1].replace(/\D/g, ''));
}

export function parseFlag(text) {
  return YES.has(keyOf(text));
}

// Blank cells leave the field out, the way it would be missing from JSON.
const compact = (object) => Object.fromEntries(
  Object.entries(object).filter(([, value]) => value !== undefined && value !== ''),
);

// The three published tabs → the `days` and `fund.shared` buildTrip takes.
// A bad row is dropped (or loses only its budget) and reported by its sheet
// line; only a missing column throws.
export function readPlan({ items, days, shared }) {
  const itemRows = readTable(parseCsv(items), 'LichTrinh', ITEM_COLUMNS);
  const dayRows = readTable(parseCsv(days), 'Ngay', DAY_COLUMNS);
  const sharedRows = readTable(parseCsv(shared), 'ChiChung', SHARED_COLUMNS);

  const warnings = [];
  const warn = (table, line, message) => warnings.push(`${table} dòng ${line} · ${message}`);
  const reserved = `"${EXTRA_TITLE}" là tên dành riêng`;

  const byDate = new Map();
  const dayAt = (date) => {
    if (!byDate.has(date)) byDate.set(date, { date, items: [] });
    return byDate.get(date);
  };

  const titleLines = new Map();
  for (const row of itemRows) {
    const warnRow = (message) => warn('LichTrinh', row.line, message);
    const date = parseDate(row.date);
    if (!date) { warnRow(`Ngày "${row.date}" không hợp lệ`); continue; }
    const start = parseTime(row.start);
    if (!start) { warnRow(`Bắt đầu "${row.start}" không hợp lệ`); continue; }
    const end = parseTime(row.end);
    if (!end) { warnRow(`Kết thúc "${row.end}" không hợp lệ`); continue; }
    if (toMinutes(end) <= toMinutes(start)) { warnRow(`Kết thúc "${end}" phải sau Bắt đầu "${start}"`); continue; }
    if (!row.title) { warnRow('thiếu Tên'); continue; }
    if (keyOf(row.title) === keyOf(EXTRA_TITLE)) { warnRow(reserved); continue; }
    const titleKey = `${date} ${keyOf(row.title)}`;
    if (titleLines.has(titleKey)) { warnRow(`trùng tên "${row.title}" với dòng ${titleLines.get(titleKey)}`); continue; }
    titleLines.set(titleKey, row.line);

    const budget = parseBudget(row.budget);
    if (budget === null) warnRow(`Dự kiến "${row.budget}" không hợp lệ`);
    dayAt(date).items.push(compact({
      start, end, icon: row.icon, title: row.title, tag: row.tag, map: row.map,
      budget: budget ?? undefined,
      empty: parseFlag(row.empty) ? true : undefined,
    }));
  }

  const dateLines = new Map();
  for (const row of dayRows) {
    const date = parseDate(row.date);
    if (!date) { warn('Ngay', row.line, `Ngày "${row.date}" không hợp lệ`); continue; }
    if (dateLines.has(date)) { warn('Ngay', row.line, `trùng ngày ${row.date} với dòng ${dateLines.get(date)}`); continue; }
    dateLines.set(date, row.line);
    Object.assign(dayAt(date), compact({ icon: row.icon, note: row.note }));
  }

  const costLines = new Map();
  const costs = [];
  for (const row of sharedRows) {
    const warnRow = (message) => warn('ChiChung', row.line, message);
    if (!row.title) { warnRow('thiếu Tên'); continue; }
    const key = keyOf(row.title);
    if (key === keyOf(EXTRA_TITLE)) { warnRow(reserved); continue; }
    if (costLines.has(key)) { warnRow(`trùng tên "${row.title}" với dòng ${costLines.get(key)}`); continue; }
    costLines.set(key, row.line);
    const budget = parseBudget(row.budget);
    if (budget === null) warnRow(`Dự kiến "${row.budget}" không hợp lệ`);
    costs.push(compact({ title: row.title, icon: row.icon, budget: budget ?? undefined, note: row.note }));
  }

  return {
    days: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
    shared: costs,
    warnings,
  };
}

const DOCS_URL = 'https://docs.google.com/';
const TABS = ['items', 'days', 'shared'];

// The published CSV links of the three tabs, or null when trip.json keeps
// its own days. Checked before anything is fetched.
export function planLinks(json) {
  const { plan } = json;
  if (plan == null) return null;
  if (typeof plan !== 'object') throw new Error('plan: phải là object');
  for (const tab of TABS) {
    if (typeof plan[tab] !== 'string' || !plan[tab].startsWith(DOCS_URL)) {
      throw new Error(`plan.${tab}: phải là link ${DOCS_URL}`);
    }
  }
  return { items: plan.items, days: plan.days, shared: plan.shared };
}

// trip.json with the sheet's days and shared costs in place of its own.
export function mergePlan(json, plan) {
  const merged = { ...json, days: plan.days };
  if (json.fund != null) merged.fund = { ...json.fund, shared: plan.shared };
  return merged;
}
