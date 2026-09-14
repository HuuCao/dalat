import { h } from '../lib/dom.js';

export const ALL_TAB = 'all';
export const FUND_TAB = 'fund';

export function renderTabs(days, { fund = false } = {}) {
  const panelId = (day) => `panel-${day.id}`;
  const tab = (id, controls, content, label) => h('button', {
    class: 'tab',
    type: 'button',
    role: 'tab',
    id: `tab-${id}`,
    'aria-controls': controls,
    'aria-label': label,
    dataset: { tab: id },
  }, content);

  // Day tabs carry their date on a second line; the full date is read out.
  return h('div', { class: 'tabbar' },
    h('div', { class: 'wrap' },
      h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Chọn ngày' },
        tab(ALL_TAB, days.map(panelId).join(' '), 'Tất cả'),
        days.map((day) => tab(day.id, panelId(day), [
          h('span', { class: 'tab-name', text: day.title }),
          h('span', { class: 'tab-date', text: day.shortDate }),
        ], `${day.title}, ${day.dateText}`)),
        fund ? tab(FUND_TAB, `panel-${FUND_TAB}`, '💰 Quỹ') : null)));
}
