import { h } from '../lib/dom.js';
import { formatShort, formatFull, formatBalance } from '../lib/money.js';
import {
  describeBucket, describeEntry, describeDay, progressOf, formUrl, placeLabelAt,
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
  const ctx = { fund, members: fund.members };
  let refresh = () => {};

  const statusText = h('span', { class: 'fund-status-text', text: '💰 Quỹ …' });
  const statusLink = addLink(fund, null, '➕ Nhập chi');
  // Worked out ahead of the tap, so the pre-filled place follows the clock.
  // Runs on pointerdown and focus too (not just click), so long-press "open
  // in new tab" and middle-click — which never fire a click event — still
  // get the current place.
  const updateStatusLinkPlace = () => {
    statusLink.href = formUrl(fund, placeLabelAt(trip, clock()));
  };
  for (const type of ['pointerdown', 'focus', 'click']) {
    statusLink?.addEventListener(type, updateStatusLinkPlace);
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

    panel.replaceChildren(h('article', { class: 'fund' },
      renderHead(metaText(meta), meta.state !== 'unlinked', meta.error),
      ledger.warnings.length > 0 ? renderWarnings(ledger.warnings) : null,
      renderOverview(totals),
      renderByDay(ledger),
      renderShared(ledger, ctx),
      ledger.unmatched.entries.length > 0
        ? section('Không khớp địa điểm',
          details('unmatched', `⚠️ ${ledger.unmatched.entries.length} khoản · ${formatShort(ledger.unmatched.actual)}`,
            renderEntries(ledger.unmatched.entries, ctx, { withLabel: true })))
        : null,
      renderSettlement(ledger),
      section('Sổ sách',
        details('contributions', `Sổ góp quỹ · ${ledger.contributions.length} khoản · ${formatShort(totals.contributed)}`,
          renderContributions(ledger.contributions)),
        details('entries', `Sổ chi · ${ledger.entries.length} khoản · ${formatShort(totals.actual)}`,
          renderEntries(ledger.entries, ctx, { withLabel: true }))),
      h('div', { class: 'fund-actions' },
        addLink(fund, null, '➕ Nhập chi tiêu'),
        fund.sheet ? h('a', { class: 'fund-btn is-ghost', href: fund.sheet, ...LINK }, '📄 Mở Google Sheet') : null)));

    for (const el of panel.querySelectorAll('details')) {
      if (open.has(detailsKey(el))) el.open = true;
    }
  }

  return {
    panel,
    statusRow,
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

function renderHead(text, canRefresh, error) {
  return h('header', { class: 'fund-head' },
    h('h2', { class: 'fund-title', text: '💰 Quỹ chuyến đi' }),
    h('div', { class: 'fund-meta' },
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

function renderEntries(entries, ctx, { withLabel = false } = {}) {
  if (entries.length === 0) return h('p', { class: 'entries-empty', text: 'Chưa có khoản chi' });
  return h('ul', { class: 'entries' }, entries.map((entry) => {
    const view = describeEntry(entry, ctx.members);
    return h('li', { class: entry.settled ? 'entry' : 'entry is-warn' },
      withLabel ? h('div', { class: 'entry-label', text: entry.label }) : null,
      h('div', { class: 'entry-top' }, h('b', { text: view.amount }), h('span', { text: view.payer })),
      view.detail ? h('div', { class: 'entry-detail', text: view.detail }) : null,
      view.meta ? h('div', { class: 'entry-meta', text: view.meta }) : null);
  }));
}

function renderContributions(contributions) {
  if (contributions.length === 0) return h('p', { class: 'entries-empty', text: 'Chưa có khoản góp' });
  return h('ul', { class: 'entries' }, contributions.map((line) => h('li', { class: 'entry' },
    h('div', { class: 'entry-top' }, h('b', { text: formatFull(line.amount) }), h('span', { text: line.member })),
    line.date || line.note
      ? h('div', { class: 'entry-meta', text: [line.date, line.note].filter(Boolean).join(' · ') })
      : null)));
}

function renderWarnings(warnings) {
  return h('div', { class: 'fund-warn', role: 'status' },
    h('strong', { text: `⚠️ ${warnings.length} cảnh báo cần sửa` }),
    h('ul', {}, warnings.map((text) => h('li', { text }))));
}

function renderOverview(totals) {
  const tile = (label, value) => h('div', { class: 'fund-tile' }, h('span', { text: label }), h('b', { text: value }));
  return h('section', { class: 'fund-section' },
    h('div', { class: 'fund-tiles' },
      tile('Đã góp', formatShort(totals.contributed)),
      tile('Đã chi', formatShort(totals.actual)),
      tile('Quỹ còn', formatShort(totals.fundLeft)),
      totals.reserve >= 0
        ? tile('Dự phòng', formatShort(totals.reserve))
        : tile('Chưa góp đủ', `thiếu ${formatShort(-totals.reserve)}`)),
    h('div', { class: 'fund-progress' },
      h('span', { text: 'Thực chi / dự kiến' }),
      h('span', { text: `${formatShort(totals.actual)} / ${formatShort(totals.budget)}` })),
    progressBar(progressOf(totals.actual, totals.budget)));
}

function table(headings, bodyRows, footRow, className = 'fund-table') {
  return h('div', { class: 'fund-table-wrap' },
    h('table', { class: className },
      h('thead', {}, h('tr', {}, headings.map((text) => h('th', { scope: 'col', text })))),
      h('tbody', {}, bodyRows),
      h('tfoot', {}, footRow)));
}

function renderByDay(ledger) {
  const row = (label, values) => h('tr', {},
    h('th', { scope: 'row', text: label }),
    values.map((value) => h('td', { text: formatShort(value) })));
  const { shared, unmatched, totals } = ledger;
  return section('Theo ngày', table(
    ['', 'Dự kiến', 'Thực chi', 'Phát sinh'],
    [
      row('Chung', [shared.budget, shared.actual, shared.extra]),
      ledger.days.map((day) => row(day.label, [day.budget, day.actual, day.extra])),
      unmatched.actual > 0 ? row('Không khớp', [0, unmatched.actual, 0]) : null,
    ],
    row('Tổng', [totals.budget, totals.actual, totals.extra])));
}

function renderShared(ledger, ctx) {
  const { fund } = ctx;
  const rows = [
    ...fund.shared.map((cost) => ({ id: cost.id, title: `${cost.icon} ${cost.title}`.trim(), note: cost.note })),
    { id: fund.sharedExtra.id, title: `${fund.sharedExtra.icon} ${fund.sharedExtra.title}`, note: '' },
  ];
  return section('Chi phí chung', rows.map(({ id, title, note }) => {
    const el = moneySlot(id);
    fillMoney(el, ledger.byId.get(id), ctx, { title, note });
    return el;
  }));
}

function renderSettlement(ledger) {
  const balanceClass = (balance) => {
    if (balance < 0) return 'is-over';
    return balance > 0 ? 'is-under' : null;
  };
  const rows = ledger.people.map((person) => h('tr', {},
    h('th', { scope: 'row', text: person.name }),
    h('td', { text: formatShort(person.contributed) }),
    h('td', { text: formatShort(person.advanced) }),
    h('td', { text: formatShort(person.share) }),
    h('td', { class: balanceClass(person.balance), text: formatBalance(person.balance) })));
  const foot = h('tr', {}, h('td', { colspan: '5', text: `Quỹ còn ${formatShort(ledger.totals.fundLeft)}` }));

  return section(ledger.done ? 'Quyết toán' : 'Quyết toán · tạm tính',
    ledger.excluded > 0
      ? h('p', { class: 'fund-warn-line', text: `⚠️ Có ${ledger.excluded} dòng cần sửa — số liệu chưa chốt` })
      : null,
    table(['', 'Góp', 'Ứng', 'Chịu', 'Còn lại'], rows, foot, 'fund-table fund-settle'),
    ledger.settlement
      ? h('div', { class: 'fund-settlement' },
        h('h4', { text: 'Chốt quỹ' }),
        ledger.settlement.length > 0
          ? h('ul', {}, ledger.settlement.map((line) => h('li', { text: line.text })))
          : h('p', { text: 'Không ai cần chuyển thêm' }))
      : null);
}
