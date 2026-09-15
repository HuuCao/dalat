import { h } from '../lib/dom.js';
import { ALL_TAB, CALENDAR_PANEL, LIST_VIEW, CALENDAR_VIEW } from './tabs.js';

// Line budget of a block, in px at 1px per minute (the phone scale): the
// start time takes TIME_ROOM, each name line NAME_LINE. Shorter blocks than
// SHORT_BLOCK minutes drop the start time.
const SHORT_BLOCK = 40;
const TIME_ROOM = 22;
const NAME_LINE = 16;

const STATE_TEXT = { now: ', đang diễn ra', past: ', đã qua' };

// The whole trip as a week grid inside "Tất cả". Built once; update() only
// flips classes and moves the now line.
export function createCalendar(model) {
  const switcher = h('div', { class: 'switch view-switch', role: 'group', 'aria-label': 'Cách xem' },
    viewButton(LIST_VIEW, '☰ Danh sách'),
    viewButton(CALENDAR_VIEW, '📅 Lịch'));

  const heads = new Map();
  const columns = new Map();
  const blocks = new Map();
  const nowLine = h('div', { class: 'cal-now', 'aria-hidden': 'true', hidden: true });
  let todayId = null;

  const head = h('div', { class: 'cal-head' },
    h('span', { class: 'cal-corner' }),
    model.days.map((day) => {
      const button = h('button', {
        class: 'cal-day',
        type: 'button',
        'aria-label': `Mở ${day.title}, ${day.dateText}`,
        dataset: { dayId: day.id },
      },
      h('span', { class: 'cal-day-name', text: day.title }),
      h('span', { class: 'cal-day-date', text: day.shortDate }));
      heads.set(day.id, button);
      return button;
    }));

  const body = h('div', { class: 'cal-body' },
    h('div', { class: 'cal-hours', 'aria-hidden': 'true' },
      model.hours.map((hour) => h('span', { class: 'cal-hour', style: { '--top': String(hour.top) }, text: hour.text }))),
    model.days.map((day) => {
      const column = h('div', { class: 'cal-col', dataset: { dayId: day.id } },
        day.blocks.map((block) => {
          const el = renderBlock(block, day);
          blocks.set(block.item.id, { el, label: el.getAttribute('aria-label'), state: null });
          return el;
        }));
      columns.set(day.id, column);
      return column;
    }));

  const panel = h('section', {
    class: 'panel cal-panel',
    id: `panel-${CALENDAR_PANEL}`,
    role: 'tabpanel',
    'aria-labelledby': `tab-${ALL_TAB}`,
    dataset: { day: CALENDAR_PANEL },
  },
  h('article', { class: 'cal', style: { '--days': String(model.days.length), '--span': String(model.span) } }, head, body));

  // Same states as the list (controllers/status.js); the label keeps the
  // state for screen readers.
  function update({ currentId, pastIds, todayId: nextTodayId, mark }) {
    for (const [id, block] of blocks) {
      const state = id === currentId ? 'now' : pastIds.has(id) ? 'past' : null;
      if (state === block.state) continue;
      block.state = state;
      block.el.classList.toggle('is-now', state === 'now');
      block.el.classList.toggle('is-past', state === 'past');
      block.el.setAttribute('aria-label', block.label + (STATE_TEXT[state] ?? ''));
    }

    if (nextTodayId !== todayId) {
      heads.get(todayId)?.removeAttribute('data-today');
      heads.get(nextTodayId)?.setAttribute('data-today', '');
      todayId = nextTodayId;
    }

    const column = mark ? columns.get(mark.dayId) : null;
    nowLine.hidden = !column;
    if (column) {
      if (nowLine.parentElement !== column) column.append(nowLine);
      nowLine.style.setProperty('--top', String(mark.top));
    }
  }

  // Opening the calendar during the trip centres the current time.
  function scrollToNow() {
    if (nowLine.hidden) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    nowLine.scrollIntoView({ block: 'center', behavior: reduce ? 'instant' : 'smooth' });
  }

  return { panel, switcher, update, scrollToNow };
}

function viewButton(view, text) {
  return h('button', { class: 'switch-btn', type: 'button', 'aria-pressed': 'false', dataset: { view } }, text);
}

function renderBlock(block, day) {
  const { item } = block;
  const short = block.height < SHORT_BLOCK;
  const lines = short ? 1 : Math.max(1, Math.floor((block.height - TIME_ROOM) / NAME_LINE));
  const classes = ['cal-block', item.empty ? 'is-empty' : '', short ? 'is-short' : ''].filter(Boolean).join(' ');

  return h('button', {
    class: classes,
    type: 'button',
    'aria-label': `${day.title}, ${item.startText} – ${item.endText}, ${item.name}`,
    dataset: { id: item.id },
    style: {
      '--top': String(block.top),
      '--height': String(block.height),
      '--lane': String(block.lane),
      '--lanes': String(block.lanes),
      '--lines': String(lines),
    },
  },
  h('span', { class: 'cal-time', text: item.startText }),
  h('span', { class: 'cal-name', text: item.icon ? `${item.icon} ${item.name}` : item.name }));
}
