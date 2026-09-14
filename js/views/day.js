import { h } from '../lib/dom.js';
import { moneySlot, dayMoneySlot, extraSlot } from './fund.js';

const join = (separator, ...parts) => parts.filter(Boolean).join(separator);

// With a fund, each card, the day head and the end of the day get empty slots
// that the fund view fills once the sheets are read.
export function renderDay(day, { fund = false } = {}) {
  return h('section', {
    class: 'panel',
    id: `panel-${day.id}`,
    role: 'tabpanel',
    'aria-labelledby': `tab-${day.id}`,
    dataset: { day: day.id },
  },
  h('article', { class: 'day' },
    h('div', { class: 'day-head' },
      h('div', { class: 'day-info' },
        h('h2', { class: 'day-title', text: join(' ', day.icon, day.title) }),
        h('div', { class: 'day-date', text: join(' · ', day.dateText, day.rangeText, day.note) }),
        fund ? dayMoneySlot(day) : null),
      h('div', { class: 'day-count', text: day.countText })),
    // Animation CSS relies on this shape: .day-head right before .timeline,
    // and every .item a direct child of .timeline.
    h('div', { class: 'timeline' }, day.items.map((item) => renderItem(item, fund))),
    fund ? extraSlot(day) : null));
}

function renderItem(item, fund) {
  return h('div', { class: 'item', dataset: { id: item.id }, style: { '--i': String(item.order) } },
    h('span', { class: 'dot' }),
    h('div', { class: 'time' },
      h('span', { class: 'clock' },
        h('b', { class: 'clock-start', text: item.startText }),
        h('span', { class: 'clock-end', text: `– ${item.endText}` })),
      h('span', { class: 'period', text: item.period })),
    renderCard(item, fund));
}

// Every place card has the same three lines - name with its map link, the
// description (kept even when empty), the money line - so all cards are the
// same height (timeline.css).
function renderCard(item, fund) {
  return h('div', { class: item.empty ? 'card empty' : 'card' },
    item.icon ? h('span', { class: 'card-icon', 'aria-hidden': 'true', text: item.icon }) : null,
    h('div', { class: 'card-body' },
      h('div', { class: 'card-head' },
        h('h3', { class: 'card-title', title: item.name, text: item.name }),
        !item.empty && item.mapUrl
          ? h('a', {
            class: 'map-btn',
            href: item.mapUrl,
            target: '_blank',
            rel: 'noopener noreferrer',
            'aria-label': `Mở Google Maps: ${item.name}`,
          },
          h('span', { 'aria-hidden': 'true', text: '📍' }),
          h('span', { class: 'map-btn-text', text: 'Maps' }))
          : null),
      h('p', { class: 'card-detail', text: item.detail }),
      fund ? moneySlot(item.id) : null));
}
