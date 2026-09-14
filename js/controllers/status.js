import { h } from '../lib/dom.js';
import { getStatus, describeStatus } from '../model/status.js';
import { localDateOf } from '../lib/time.js';

const FAST_TICK_MS = 1000; // the seconds tile is on screen
const SLOW_TICK_MS = 15_000;
const SCROLL_DELAY_MS = 400; // let the opened panel lay out first

export function startStatus({ trip, root, countdown, tabs, clock }) {
  const elements = new Map([...root.querySelectorAll('.item[data-id]')].map((el) => [el.dataset.id, el]));
  let firstTick = true;

  function tick() {
    const now = clock();
    const status = getStatus(trip, now);
    const today = localDateOf(now, trip.timezone);
    tabs.markToday(trip.days.find((day) => day.date === today)?.id ?? null);

    for (const [id, el] of elements) {
      const live = status.current?.id === id;
      const past = status.pastIds.has(id);
      el.classList.toggle('is-now', live);
      el.classList.toggle('is-past', past);
      setStateTag(el, live ? 'now' : past ? 'past' : null);
    }
    countdown.update(describeStatus(trip, status), status.phase);

    if (firstTick) {
      firstTick = false;
      jumpToLive(status);
    }
    setTimeout(tick, status.phase === 'soon' ? FAST_TICK_MS : SLOW_TICK_MS);
  }

  // During the trip, open the day in progress and bring the slot into view.
  function jumpToLive(status) {
    const focus = status.phase === 'live' ? (status.current ?? status.next) : null;
    if (!focus) return;
    tabs.select(focus.dayId);
    setTimeout(() => {
      elements.get(focus.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, SCROLL_DELAY_MS);
  }

  tick();
}

// "Đang diễn ra" / "Đã qua" beside the period, so state never rests on colour.
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
  tag.classList.toggle('is-past', state === 'past');
}
