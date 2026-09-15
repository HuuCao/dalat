import { h } from '../lib/dom.js';
import { getStatus, describeStatus, followAction, msUntilNextChange } from '../model/status.js';
import { localDateOf } from '../lib/time.js';
import { nowMark } from '../model/calendar.js';

const FAST_TICK_MS = 1000; // the seconds tile is on screen
const SLOW_TICK_MS = 15_000;
const SCROLL_DELAY_MS = 400; // let the opened panel lay out first
const FLASH_MS = 1200; // two .6s rings (timeline.css)
// Only real input counts: the page's own scrolling must not look like the
// viewer is busy.
const INPUT_EVENTS = ['pointerdown', 'touchstart', 'wheel', 'keydown'];

export function startStatus({ trip, root, countdown, tabs, clock, hint, calendar, calModel, reveal }) {
  const elements = new Map([...root.querySelectorAll('.item[data-id]')].map((el) => [el.dataset.id, el]));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let firstTick = true;
  let currentId = null;
  let offered = null;
  let lastInput = -Infinity;
  let timer = 0;
  let flashTimer = 0;

  for (const type of INPUT_EVENTS) {
    window.addEventListener(type, () => {
      lastInput = Date.now();
    }, { passive: true });
  }

  // The offer goes away once its slot is on screen, however it got there.
  const seen = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) dismiss();
    }, { threshold: 0.6 })
    : null;

  hint.element.addEventListener('click', () => {
    if (offered) moveTo(offered);
  });

  function tick() {
    const now = clock();
    const status = getStatus(trip, now);
    const today = localDateOf(now, trip.timezone);
    const todayId = trip.days.find((day) => day.date === today)?.id ?? null;
    const nextId = status.current?.id ?? null;
    tabs.markToday(todayId);

    for (const [id, el] of elements) {
      const live = status.current?.id === id;
      const past = status.pastIds.has(id);
      el.classList.toggle('is-now', live);
      el.classList.toggle('is-past', past);
      setStateTag(el, live ? 'now' : past ? 'past' : null);
    }
    calendar.update({ currentId: nextId, pastIds: status.pastIds, todayId, mark: nowMark(calModel, now, trip.timezone) });
    countdown.update(describeStatus(trip, status), status.phase);

    // When a slot starts: follow it, or offer it if the viewer is busy. The
    // calendar lights the new slot up itself, so a viewer on it stays put.
    if (firstTick) {
      firstTick = false;
      jumpToLive(status);
    } else if (!calendar.panel.hidden) {
      dismiss();
    } else {
      const action = followAction({ previousId: currentId, currentId: nextId, idleMs: Date.now() - lastInput });
      if (action === 'move') moveTo(status.current);
      else if (action === 'hint') offer(status.current);
    }
    if (offered && offered.id !== nextId) dismiss();
    currentId = nextId;

    // The regular pace, or sooner when a slot starts or ends before then, so
    // the page changes on that very second.
    const pace = status.phase === 'soon' ? FAST_TICK_MS : SLOW_TICK_MS;
    timer = setTimeout(tick, Math.min(pace, msUntilNextChange(trip, now)));
  }

  // Opening the page during the trip: open the day in progress and bring the
  // slot in progress (or the next one) into view.
  function jumpToLive(status) {
    const focus = status.phase === 'live' ? (status.current ?? status.next) : null;
    if (focus) moveTo(focus, { openDay: true });
  }

  // Later moves only switch tabs when the slot is not on screen at all, so
  // "Tất cả" stays open if that is where the viewer is. `flash` is for slots
  // picked on the calendar: the card rings and takes focus once in view.
  function moveTo(item, { openDay = false, flash = false } = {}) {
    dismiss();
    const el = elements.get(item.id);
    if (!el) return;
    const switchTab = openDay || el.closest('.panel').hidden;
    if (switchTab) tabs.select(item.dayId);
    const arrive = () => {
      el.scrollIntoView({ behavior: reduceMotion.matches ? 'instant' : 'smooth', block: 'center' });
      if (flash) flashItem(el);
    };
    if (switchTab) setTimeout(arrive, SCROLL_DELAY_MS);
    else arrive();
  }

  function flashItem(el) {
    root.querySelector('.item.is-flash')?.classList.remove('is-flash');
    clearTimeout(flashTimer);
    // A slot picked on the calendar may never have scrolled into view: settle
    // its entrance now so the first ring does not play while it is invisible.
    if (!el.classList.contains('in')) reveal.settle(el);
    void el.offsetWidth; // restart the rings when the same slot is picked again
    el.classList.add('is-flash');
    el.focus({ preventScroll: true });
    flashTimer = setTimeout(() => el.classList.remove('is-flash'), FLASH_MS);
  }

  function offer(item) {
    offered = item;
    hint.show(item.name);
    seen?.disconnect();
    const el = elements.get(item.id);
    if (el) seen?.observe(el);
  }

  function dismiss() {
    offered = null;
    hint.hide();
    seen?.disconnect();
  }

  // Phones pause timers in the background; catch up as soon as the page is
  // looked at again, so a slot that started meanwhile is followed at once.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    clearTimeout(timer);
    tick();
  });

  tick();

  return {
    show(itemId) {
      const item = trip.items.find((entry) => entry.id === itemId);
      if (item) moveTo(item, { openDay: true, flash: true });
    },
  };
}

// On screen only the time chip changes colour; screen readers still hear
// "Đang diễn ra" / "Đã qua", so the state never rests on colour alone.
function setStateTag(el, state) {
  let tag = el.querySelector('.state-tag');
  if (!state) {
    tag?.remove();
    return;
  }
  if (!tag) {
    tag = h('span', { class: 'state-tag' });
    el.querySelector('.time').append(tag);
  }
  tag.textContent = state === 'now' ? 'Đang diễn ra' : 'Đã qua';
}
