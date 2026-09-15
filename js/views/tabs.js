import { h } from '../lib/dom.js';

export const ALL_TAB = 'all';
export const FUND_TAB = 'fund';
// "Tất cả" shows the days as a list or as a calendar (views/calendar.js).
export const CALENDAR_PANEL = 'calendar';
export const LIST_VIEW = 'list';
export const CALENDAR_VIEW = 'calendar';

// What "Tất cả" says about its view: an icon (plus the word from 761px) on
// screen and the label read out. Tapping the open tab again switches
// (controllers/tabs.js).
export const VIEW_TEXT = {
  [LIST_VIEW]: { icon: '☰', word: 'Danh sách', label: 'Tất cả, dạng danh sách. Bấm lần nữa để xem lịch' },
  [CALENDAR_VIEW]: { icon: '📅', word: 'Lịch', label: 'Tất cả, dạng lịch. Bấm lần nữa để xem danh sách' },
};

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
  const list = VIEW_TEXT[LIST_VIEW];

  // Day tabs carry their date on a second line, "Tất cả" the view it shows;
  // the full date or view is read out.
  return h('div', { class: 'tabbar' },
    h('div', { class: 'wrap' },
      h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Chọn ngày' },
        tab(ALL_TAB, [...days.map(panelId), `panel-${CALENDAR_PANEL}`].join(' '), [
          h('span', { class: 'tab-name', text: 'Tất cả' }),
          h('span', { class: 'tab-date tab-view' },
            h('span', { class: 'tab-view-icon', text: list.icon }),
            h('span', { class: 'tab-view-word', text: list.word })),
        ], list.label),
        days.map((day) => tab(day.id, panelId(day), [
          h('span', { class: 'tab-name', text: day.title }),
          h('span', { class: 'tab-date', text: day.shortDate }),
        ], `${day.title}, ${day.dateText}`)),
        fund ? tab(FUND_TAB, `panel-${FUND_TAB}`, '💰 Quỹ') : null)));
}
