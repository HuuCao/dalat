import { h } from '../lib/dom.js';

export const ALL_TAB = 'all';
export const FUND_TAB = 'fund';

export function renderTabs(days, { fund = false } = {}) {
  const panelId = (day) => `panel-${day.id}`;
  const tab = (id, label, controls) => h('button', {
    class: 'tab',
    type: 'button',
    role: 'tab',
    id: `tab-${id}`,
    'aria-controls': controls,
    dataset: { tab: id },
  }, label);

  return h('div', { class: 'tabbar' },
    h('div', { class: 'wrap' },
      h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Chọn ngày' },
        tab(ALL_TAB, 'Tất cả', days.map(panelId).join(' ')),
        days.map((day) => tab(day.id, day.label, panelId(day))),
        fund ? tab(FUND_TAB, '💰 Quỹ', `panel-${FUND_TAB}`) : null)));
}
