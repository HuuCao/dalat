import { h } from '../lib/dom.js';
import { shortWeekdayText } from '../lib/time.js';
import { ALL_TAB, CALENDAR_PANEL } from './tabs.js';

// Line budget of a block, in px at 1px per minute (the phone scale): the
// inset, padding and time line take TIME_ROOM, each name line NAME_LINE.
// Blocks shorter than SHORT_BLOCK minutes show the name alone.
const SHORT_BLOCK = 40;
const TIME_ROOM = 27;
const NAME_LINE = 16;

const STATE_TEXT = { now: ', đang diễn ra', past: ', đã qua' };

const clockText = (minute) => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;

// The whole trip as a week grid inside "Tất cả". Built once; update() only
// flips classes and moves the now line.
export function createCalendar(model) {
  const heads = new Map();
  const columns = new Map();
  const blocks = new Map();
  // The current time: a line across today's column and the time in the gutter.
  const nowLine = h('div', { class: 'cal-now', 'aria-hidden': 'true', hidden: true });
  const nowTime = h('span', { class: 'cal-now-time', hidden: true });
  let todayId = null;

  // Weekday above a large day number; "Ngày N" is already on the tab bar.
  const head = h('div', { class: 'cal-head' },
    h('span', { class: 'cal-corner', 'aria-hidden': 'true' }),
    model.days.map((day) => {
      const button = h('button', {
        class: 'cal-day',
        type: 'button',
        'aria-label': `Mở ${day.title}, ${day.dateText}`,
        dataset: { dayId: day.id },
      },
      h('span', { class: 'cal-day-week', text: shortWeekdayText(day.date) }),
      h('span', { class: 'cal-day-num', text: String(Number(day.date.slice(8))) }));
      heads.set(day.id, button);
      return button;
    }));

  const body = h('div', { class: 'cal-body' },
    h('div', { class: 'cal-hours', 'aria-hidden': 'true' },
      model.hours.map((hour) => h('span', { class: 'cal-hour', style: { '--top': String(hour.top) }, text: hour.text })),
      nowTime),
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

    // Today's heading and column are marked together.
    if (nextTodayId !== todayId) {
      for (const marked of [heads, columns]) {
        marked.get(todayId)?.removeAttribute('data-today');
        marked.get(nextTodayId)?.setAttribute('data-today', '');
      }
      todayId = nextTodayId;
    }

    const column = mark ? columns.get(mark.dayId) : null;
    nowLine.hidden = !column;
    nowTime.hidden = !column;
    if (column) {
      if (nowLine.parentElement !== column) column.append(nowLine);
      const top = String(mark.top);
      nowLine.style.setProperty('--top', top);
      nowTime.style.setProperty('--top', top);
      nowTime.textContent = clockText(model.startMinute + mark.top);
    }
  }

  // Opening the calendar during the trip centres the current time.
  function scrollToNow() {
    if (nowLine.hidden) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    nowLine.scrollIntoView({ block: 'center', behavior: reduce ? 'instant' : 'smooth' });
  }

  return { panel, update, scrollToNow };
}

// Name first (icon in a small disc), time range underneath: the grid already
// places the block, the range says exactly when.
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
  h('span', { class: 'cal-name' },
    item.icon ? h('span', { class: 'cal-icon', text: item.icon }) : null,
    item.name),
  h('span', { class: 'cal-time', text: `${item.startText}–${item.endText}` }));
}
