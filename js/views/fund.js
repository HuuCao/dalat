import { h } from '../lib/dom.js';
import { formatShort, formatExact } from '../lib/money.js';
import {
  describeBucket, describeEntry, describeDay, describeBalance, progressOf, formUrl, placeLabelAt,
} from '../model/fund.js';
import { FUND_TAB } from './tabs.js';

const LINK = { target: '_blank', rel: 'noopener noreferrer' };

// ---------- Slots the day view places; filled by createFundView ----------

export function moneySlot(id) {
  return h('details', { class: 'money is-muted', dataset: { money: id } },
    h('summary', { class: 'money-sum' }, h('span', { class: 'money-text', text: '💰 …' })),
    h('div', { class: 'money-body' }, h('p', { class: 'entries-empty', text: 'Đang tải…' })));
}

export function dayMoneySlot(day) {
  return h('div', { class: 'day-money', dataset: { dayMoney: day.id } });
}

export function extraSlot(day) {
  return h('section', { class: 'extra', dataset: { extra: day.id }, hidden: true });
}

// ---------- The view ----------

export function createFundView({ trip, clock }) {
  const { fund } = trip;
  const ctx = { fund, members: fund.members, places: placeIndex(trip), groups: ledgerGroups(trip) };
  let refresh = () => {};
  // Which book the "Sổ sách" switch shows; kept across refreshes.
  let book = 'entries';
  let lastLedger = null;

  const statusText = h('span', { class: 'fund-status-text', text: '💰 Quỹ …' });
  // Both sit on dark green: a plain "+" takes the white text colour, where
  // the ➕ emoji stays dark grey.
  const statusLink = addLink(fund, null, '+ Nhập chi');
  // Phones get a floating copy in thumb reach (css/fund.css hides it on
  // desktop). Mounted outside <main>: an animated ancestor would break fixed.
  const fab = addLink(fund, null, '+ Nhập chi');
  fab?.classList.replace('fund-btn', 'fab');
  // Worked out ahead of the tap, so the pre-filled place follows the clock.
  // Runs on pointerdown and focus too (not just click), so long-press "open
  // in new tab" and middle-click — which never fire a click event — still
  // get the current place.
  const updateLinkPlace = (event) => {
    event.currentTarget.href = formUrl(fund, placeLabelAt(trip, clock()));
  };
  for (const link of [statusLink, fab]) {
    for (const type of ['pointerdown', 'focus', 'click']) {
      link?.addEventListener(type, updateLinkPlace);
    }
  }
  const statusRow = h('div', { class: 'fund-status' }, statusText, statusLink);

  const panel = h('section', {
    class: 'panel fund-panel',
    id: `panel-${FUND_TAB}`,
    role: 'tabpanel',
    'aria-labelledby': `tab-${FUND_TAB}`,
    dataset: { day: FUND_TAB },
  }, h('article', { class: 'fund' }, renderHead('Đang tải…', false)));
  panel.addEventListener('click', (event) => {
    if (event.target.closest('[data-action="refresh"]')) refresh();
    const pick = event.target.closest('[data-book]');
    if (pick && lastLedger && pick.dataset.book !== book) {
      book = pick.dataset.book;
      panel.querySelector('.books').replaceWith(renderBooks(lastLedger));
      panel.querySelector(`[data-book="${book}"]`).focus();
    }
  });

  const scope = () => panel.closest('main') ?? document;

  function update(ledger, meta) {
    const root = scope();
    for (const el of root.querySelectorAll('.day [data-money]')) {
      fillMoney(el, ledger.byId.get(el.dataset.money), ctx);
    }
    for (const day of ledger.days) {
      fillDay(root.querySelector(`[data-day-money="${day.id}"]`), day);
      fillExtra(root.querySelector(`[data-extra="${day.id}"]`), day.extraBucket, ctx);
    }
    statusText.textContent = meta.state === 'unlinked'
      ? `💰 Dự kiến ${formatShort(ledger.totals.budget)}`
      : `💰 Quỹ còn ${formatShort(ledger.totals.fundLeft)}`;
    renderPanel(ledger, meta);
  }

  function fail(message) {
    for (const el of scope().querySelectorAll('.day [data-money]')) {
      el.className = 'money is-muted';
      el.querySelector('.money-sum').replaceChildren(h('span', { class: 'money-text', text: '💰 —' }));
      el.querySelector('.money-body').replaceChildren(h('p', { class: 'entries-empty', text: 'Không tải được sổ quỹ' }));
    }
    statusText.textContent = '💰 Không tải được quỹ';
    panel.replaceChildren(h('article', { class: 'fund' },
      renderHead('Chưa có dữ liệu', true),
      h('div', { class: 'load-error', role: 'alert' },
        h('strong', { text: 'Không tải được sổ quỹ' }),
        h('p', { text: message }),
        h('button', { class: 'fund-btn', type: 'button', dataset: { action: 'refresh' } }, 'Thử lại'))));
  }

  // The panel is rebuilt on every refresh; <details> people opened stay open.
  function renderPanel(ledger, meta) {
    const detailsKey = (el) => el.dataset.key ?? el.dataset.money;
    const open = new Set([...panel.querySelectorAll('details[open]')].map(detailsKey));
    const { totals } = ledger;
    lastLedger = ledger;

    panel.replaceChildren(h('article', { class: 'fund' },
      renderHead(metaText(meta), meta.state !== 'unlinked', meta.error),
      // Things to fix first, then what people ask most: what is left, who
      // gets what back.
      ledger.warnings.length > 0 ? renderWarnings(ledger.warnings) : null,
      ledger.unmatched.entries.length > 0
        ? section('⚠️ Không khớp địa điểm',
          details('unmatched', `${ledger.unmatched.entries.length} khoản · ${formatShort(ledger.unmatched.actual)}`,
            renderEntries(ledger.unmatched.entries, ctx, { withPlace: true })))
        : null,
      renderOverview(totals),
      renderSettlement(ledger),
      renderByDay(ledger),
      renderShared(ledger, ctx),
      renderBooks(ledger),
      h('div', { class: 'fund-actions' },
        addLink(fund, null, '➕ Nhập chi tiêu'),
        fund.sheet ? h('a', { class: 'fund-btn is-ghost', href: fund.sheet, ...LINK }, '📄 Mở Google Sheet') : null)));

    for (const el of panel.querySelectorAll('details')) {
      if (open.has(detailsKey(el))) el.open = true;
    }
  }

  // One book at a time behind a two-way switch, instead of two long lists
  // opened one under the other.
  function renderBooks(ledger) {
    const { entries, contributions, totals } = ledger;
    const pick = (key, text) => h('button', {
      class: 'switch-btn',
      type: 'button',
      'aria-pressed': String(book === key),
      dataset: { book: key },
    }, text);
    return h('section', { class: 'fund-section books' },
      h('h3', { class: 'fund-h', text: '📒 Sổ sách' }),
      h('div', { class: 'switch books-switch' },
        pick('entries', `Sổ chi · ${entries.length} · ${formatShort(totals.actual)}`),
        pick('contributions', `Góp quỹ · ${contributions.length} · ${formatShort(totals.contributed)}`)),
      book === 'entries'
        ? renderLedger(entries, ctx)
        : renderContributions(contributions, totals.contributed));
  }

  return {
    panel,
    statusRow,
    fab,
    update,
    fail,
    onRefresh(handler) {
      refresh = handler;
    },
  };
}

// ---------- Pieces ----------

const clockText = (ms) => new Date(ms).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

function metaText(meta) {
  if (meta.state === 'unlinked') return 'Chưa kết nối Google Sheet';
  if (meta.state === 'cached') return `Dữ liệu lúc ${clockText(meta.fetchedAt)} · đang tải bản mới`;
  if (meta.state === 'stale') return `Dữ liệu lúc ${clockText(meta.fetchedAt)} · chưa tải được bản mới`;
  return `Cập nhật ${clockText(meta.fetchedAt)}`;
}

function addLink(fund, label, text) {
  const href = formUrl(fund, label);
  return href ? h('a', { class: 'fund-btn', href, ...LINK }, text) : null;
}

function section(title, ...children) {
  return h('section', { class: 'fund-section' }, h('h3', { class: 'fund-h', text: title }), children);
}

function details(key, summary, body) {
  return h('details', { class: 'fund-details', dataset: { key } }, h('summary', { text: summary }), body);
}

function progressBar({ ratio, over }) {
  return h('div', { class: over ? 'bar is-over' : 'bar', 'aria-hidden': 'true' },
    h('span', { style: { '--ratio': String(ratio) } }));
}

// The update time sits in a pill; without a sheet there is nothing to reload.
function renderHead(text, canRefresh, error) {
  return h('header', { class: 'fund-head' },
    h('h2', { class: 'fund-title', text: '💰 Quỹ chuyến đi' }),
    h('div', { class: canRefresh ? 'fund-meta' : 'fund-meta is-static' },
      h('span', { class: 'fund-meta-text', text }),
      canRefresh
        ? h('button', { class: 'fund-refresh', type: 'button', 'aria-label': 'Tải lại', dataset: { action: 'refresh' } }, '↻')
        : null),
    error ? h('p', { class: 'fund-meta-error', text: error }) : null);
}

// Element.replaceChildren() stringifies a bare null into a literal "null"
// text node (unlike the h() helper, which filters null/false children), so
// conditional children are filtered here before the call.
function fillMoney(el, bucket, ctx, { title = null, note = '' } = {}) {
  const view = describeBucket(bucket, ctx.members.length);
  el.className = view.tone ? `money is-${view.tone}` : 'money';
  el.querySelector('.money-sum').replaceChildren(...[
    title ? h('span', { class: 'money-title', text: title }) : null,
    h('span', { class: 'money-text', text: title ? view.text : `${view.icon} ${view.text}` }),
    view.diff ? h('span', { class: 'money-diff', text: view.diff }) : null,
  ].filter(Boolean));
  el.querySelector('.money-body').replaceChildren(...[
    note ? h('p', { class: 'money-note', text: note }) : null,
    view.perPerson ? h('p', { class: 'money-note', text: view.perPerson }) : null,
    renderEntries(bucket.entries, ctx),
    addLink(ctx.fund, bucket.label, '➕ Nhập chi ở đây'),
  ].filter(Boolean));
}

function fillDay(el, day) {
  const view = describeDay(day);
  el.replaceChildren(h('div', { class: 'day-money-text', text: view.text }), progressBar(view));
}

function fillExtra(el, bucket, ctx) {
  el.hidden = false;
  el.replaceChildren(...[
    h('h3', {
      class: 'extra-title',
      text: bucket.actual > 0 ? `⚡ Phát sinh ngoài plan · ${formatShort(bucket.actual)}` : '⚡ Phát sinh · 0',
    }),
    bucket.entries.length > 0 ? renderEntries(bucket.entries, ctx) : null,
    addLink(ctx.fund, bucket.label, '➕ Nhập phát sinh'),
  ].filter(Boolean));
}

// Short place names and their ledger group, by bucket id: the sheet's own
// label ("Day 1 · Đồi chè Cầu Đất — Săn mây…") is too long to repeat per row.
function placeIndex(trip) {
  const { fund } = trip;
  const index = new Map();
  for (const cost of fund.shared) index.set(cost.id, { group: 'shared', name: `${cost.icon} ${cost.title}`.trim() });
  index.set(fund.sharedExtra.id, { group: 'shared', name: '⚡ Phát sinh chung' });
  for (const day of trip.days) {
    for (const item of day.items) index.set(item.id, { group: day.id, name: item.name });
    index.set(`${day.id}-extra`, { group: day.id, name: '⚡ Phát sinh' });
  }
  return index;
}

function ledgerGroups(trip) {
  return [
    { id: 'shared', title: 'Chung' },
    ...trip.days.map((day) => ({ id: day.id, title: day.title })),
    { id: 'unmatched', title: 'Không khớp địa điểm' },
  ];
}

// Two lines per entry. With a place (ledger lists): place and amount, then
// who paid, note, split and who entered it. Inside a card the place is
// already known, so the first line is who paid and the amount.
function renderEntry(entry, ctx, { withPlace }) {
  const view = describeEntry(entry, ctx.members);
  const unmatched = entry.bucketId === 'unmatched';
  const kind = unmatched ? 'warn' : view.kind;
  const badge = h('span', { class: 'entry-badge', text: view.payer });
  const place = withPlace
    ? h('span', { class: 'entry-place', text: unmatched ? entry.label : (ctx.places.get(entry.bucketId)?.name ?? entry.label) })
    : null;
  const sub = [
    place ? badge : null,
    view.detail ? h('span', { class: 'entry-detail', text: view.detail }) : null,
    view.meta ? h('span', { class: 'entry-meta', text: view.meta }) : null,
  ].filter(Boolean);

  return h('li', { class: `entry is-${kind}` },
    h('div', { class: 'entry-top' }, place ?? badge, h('b', { class: 'entry-amount', text: view.amount })),
    sub.length > 0 ? h('div', { class: 'entry-sub' }, sub) : null);
}

function renderEntries(entries, ctx, { withPlace = false } = {}) {
  if (entries.length === 0) return h('p', { class: 'entries-empty', text: 'Chưa có khoản chi' });
  return h('ul', { class: 'entries' }, entries.map((entry) => renderEntry(entry, ctx, { withPlace })));
}

// The expense book grouped Chung → Ngày 1…N → Không khớp, each with its total.
function renderLedger(entries, ctx) {
  if (entries.length === 0) return h('p', { class: 'entries-empty', text: 'Chưa có khoản chi' });
  const groupOf = (entry) => ctx.places.get(entry.bucketId)?.group ?? 'unmatched';
  return h('div', { class: 'ledger' }, ctx.groups.map((group) => {
    const list = entries.filter((entry) => groupOf(entry) === group.id);
    if (list.length === 0) return null;
    const total = list.reduce((sum, entry) => sum + entry.amount, 0);
    return h('section', { class: group.id === 'unmatched' ? 'ledger-group is-warn' : 'ledger-group' },
      h('h4', { class: 'ledger-h' }, h('span', { text: group.title }), h('span', { text: formatShort(total) })),
      renderEntries(list, ctx, { withPlace: true }));
  }));
}

// One row per contribution: who, how much, when, note.
function renderContributions(contributions, total) {
  if (contributions.length === 0) return h('p', { class: 'entries-empty', text: 'Chưa có khoản góp' });
  return h('table', { class: 'fund-table contrib' },
    h('tbody', {}, contributions.map((line) => h('tr', {},
      h('th', { scope: 'row', text: line.member }),
      h('td', { class: 'contrib-amount', text: formatExact(line.amount) }),
      h('td', { class: 'contrib-date', text: line.date }),
      h('td', { class: 'contrib-note', text: line.note })))),
    h('tfoot', {}, h('tr', {},
      h('th', { scope: 'row', text: 'Tổng' }),
      h('td', { class: 'contrib-amount', text: formatShort(total) }),
      h('td', { colspan: '2' }))));
}

function renderWarnings(warnings) {
  return h('div', { class: 'fund-warn', role: 'status' },
    h('strong', { text: `⚠️ ${warnings.length} cảnh báo cần sửa` }),
    h('ul', {}, warnings.map((text) => h('li', { text }))));
}

// What is left, in large type, with how much of the plan is spent under it;
// then three small stats.
function renderOverview(totals) {
  const short = totals.reserve < 0;
  const progress = progressOf(totals.actual, totals.budget);
  const percent = totals.budget > 0 ? Math.round((totals.actual / totals.budget) * 100) : null;
  const stat = (icon, label, value, tone) => h('div', { class: tone ? `fund-stat is-${tone}` : 'fund-stat' },
    h('span', { class: 'fund-stat-icon', 'aria-hidden': 'true', text: icon }),
    h('span', { class: 'fund-stat-label', text: label }),
    h('b', { class: 'fund-stat-value', text: value }));

  return h('section', { class: 'fund-section fund-overview' },
    h('div', { class: 'fund-hero' },
      h('span', { class: 'fund-hero-label', text: 'Quỹ còn' }),
      h('b', { class: 'fund-hero-value', text: formatShort(totals.fundLeft) }),
      h('div', { class: 'fund-hero-progress' },
        progressBar(progress),
        h('div', { class: 'fund-hero-caption' },
          h('span', { text: `Đã chi ${formatShort(totals.actual)} / dự kiến ${formatShort(totals.budget)}` }),
          percent === null ? null : h('b', { class: progress.over ? 'is-over' : null, text: `${percent}%` })))),
    h('div', { class: 'fund-stats' },
      stat('📥', 'Đã góp', formatShort(totals.contributed)),
      stat('💸', 'Đã chi', formatShort(totals.actual)),
      short
        ? stat('⚠️', 'Thiếu dự kiến', formatShort(-totals.reserve), 'over')
        : stat('✅', 'Dư dự kiến', formatShort(totals.reserve))));
}

// Spent against the plan for the shared costs, each day and the total.
function renderByDay(ledger) {
  const { shared, unmatched, totals } = ledger;
  const row = (label, { budget, actual, extra }, kind = null) => {
    const progress = progressOf(actual, budget);
    let amount = `${formatShort(actual)} / ${formatShort(budget)}`;
    if (budget === 0) amount = formatShort(actual);
    else if (actual === 0) amount = `Dự kiến ${formatShort(budget)}`;
    let amountClass = 'budget-amount';
    if (progress.over) amountClass += ' is-over';
    else if (actual === 0) amountClass += ' is-muted';

    return h('li', { class: kind ? `budget-row is-${kind}` : 'budget-row' },
      h('div', { class: 'budget-top' },
        h('b', { class: 'budget-name', text: label }),
        h('span', { class: amountClass, text: amount })),
      progressBar(progress),
      extra > 0 ? h('span', { class: 'budget-extra', text: `⚡ Phát sinh ${formatShort(extra)}` }) : null);
  };

  return section('📅 Theo ngày', h('ul', { class: 'budget-list' },
    row('Chung', shared),
    ledger.days.map((day) => row(day.title, day)),
    unmatched.actual > 0 ? row('Không khớp', { budget: 0, actual: unmatched.actual, extra: 0 }, 'warn') : null,
    row('Tổng', totals, 'total')));
}

function renderShared(ledger, ctx) {
  const { fund } = ctx;
  const rows = [
    ...fund.shared.map((cost) => ({ id: cost.id, title: `${cost.icon} ${cost.title}`.trim(), note: cost.note })),
    { id: fund.sharedExtra.id, title: `${fund.sharedExtra.icon} ${fund.sharedExtra.title}`, note: '' },
  ];
  return section('🧾 Chi phí chung', rows.map(({ id, title, note }) => {
    const el = moneySlot(id);
    fillMoney(el, ledger.byId.get(id), ctx, { title, note });
    return el;
  }));
}

const initialOf = (name) => Array.from(name.trim())[0]?.toLocaleUpperCase('vi') ?? '?';

// One part of a result, coloured by how the formula counts it: added
// (green), taken off (orange) or nothing (muted).
function settleAmount(amount, counts) {
  const kind = amount === 0 ? 'zero' : counts;
  return h('td', { class: `settle-amount is-${kind}`, text: amount === 0 ? '0' : formatShort(amount) });
}

// Under the "Hoàn/Nộp" column the amount is bare; its colour says which:
// green is a refund, orange is owed to the fund, a muted 0 is even.
function settleResult(balance) {
  const { tone } = describeBalance(balance);
  if (balance === 0) return { text: '0', tone: 'even' };
  return { text: formatShort(Math.abs(balance)), tone };
}

// A clean table: column labels once, one line per person — initial and
// name, the three parts, and what they get back, in colour.
function renderSettlement(ledger) {
  const rows = ledger.people.map((person) => {
    const result = settleResult(person.balance);
    return h('tr', {},
      h('th', { scope: 'row' },
        h('span', { class: 'settle-person' },
          h('span', { class: 'settle-avatar', 'aria-hidden': 'true', text: initialOf(person.name) }),
          h('span', { class: 'settle-name', text: person.name }))),
      settleAmount(person.contributed, 'plus'),
      settleAmount(person.advanced, 'plus'),
      settleAmount(person.share, 'minus'),
      h('td', { class: `settle-result is-${result.tone}`, text: result.text }));
  });

  return section(ledger.done ? '🧮 Quyết toán' : '🧮 Quyết toán · tạm tính',
    ledger.excluded > 0
      ? h('p', { class: 'fund-warn-line', text: `⚠️ Có ${ledger.excluded} dòng cần sửa — số liệu chưa chốt` })
      : null,
    h('div', { class: 'settle-wrap' },
      h('table', { class: 'settle' },
        h('thead', {}, h('tr', {},
          h('th', { scope: 'col', 'aria-label': 'Thành viên' }),
          ['Góp', 'Trả hộ', 'Chịu', 'Hoàn/Nộp'].map((text) => h('th', { scope: 'col', text })))),
        h('tbody', {}, rows))),
    h('p', { class: 'fund-formula' },
      h('span', { text: 'Hoàn/Nộp = Đã góp + Trả hộ − Phần chịu' }),
      h('span', { text: `Tổng = Quỹ còn ${formatShort(ledger.totals.fundLeft)}` })),
    ledger.settlement
      ? h('div', { class: 'fund-settlement' },
        h('h4', { text: 'Chốt quỹ' }),
        ledger.settlement.length > 0
          ? h('ul', {}, ledger.settlement.map((line) => h('li', { text: line.text })))
          : h('p', { text: 'Không ai cần chuyển thêm' }))
      : null);
}
