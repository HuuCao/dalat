import { h } from '../lib/dom.js';

const join = (separator, ...parts) => parts.filter(Boolean).join(separator);

export function renderDay(day) {
  return h('section', {
    class: 'panel',
    id: `panel-${day.id}`,
    role: 'tabpanel',
    'aria-labelledby': `tab-${day.id}`,
    dataset: { day: day.id },
  },
  h('article', { class: 'day' },
    h('div', { class: 'day-head' },
      h('div', {},
        h('h2', { class: 'day-title', text: join(' ', day.icon, day.label) }),
        h('div', { class: 'day-date', text: join(' · ', day.dateText, day.rangeText, day.note) })),
      h('div', { class: 'day-count', text: day.countText })),
    // Animation CSS relies on this shape: .day-head right before .timeline,
    // and every .item a direct child of .timeline.
    h('div', { class: 'timeline' }, day.items.map(renderItem))));
}

function renderItem(item) {
  return h('div', { class: 'item', dataset: { id: item.id }, style: { '--i': String(item.order) } },
    h('span', { class: 'dot' }),
    h('div', { class: 'time' },
      h('span', { class: 'clock' },
        h('b', { class: 'clock-start', text: item.startText }),
        h('span', { class: 'clock-end', text: `– ${item.endText}` })),
      h('span', { class: 'period', text: item.period })),
    renderCard(item));
}

function renderCard(item) {
  const hasFooter = !item.empty && Boolean(item.tag || item.mapUrl);
  return h('div', { class: item.empty ? 'card empty' : 'card' },
    item.icon ? h('span', { class: 'card-icon', 'aria-hidden': 'true', text: item.icon }) : null,
    h('div', { class: 'card-body' },
      h('h3', { class: 'card-title', text: item.name }),
      item.detail ? h('p', { class: 'card-detail', text: item.detail }) : null,
      hasFooter
        ? h('div', { class: 'card-footer' },
          item.tag ? h('span', { class: 'tag', dataset: { tag: item.tagKey }, text: item.tag }) : null,
          item.mapUrl
            ? h('a', { class: 'map-btn', href: item.mapUrl, target: '_blank', rel: 'noopener noreferrer' }, '📍 Maps')
            : null)
        : null));
}
