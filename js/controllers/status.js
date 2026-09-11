import { h } from '../lib/dom.js';
import { getStatus, describeStatus } from '../model/status.js';

const FAST_TICK_MS = 1000; // the seconds tile is on screen
const SLOW_TICK_MS = 15_000;
const SCROLL_DELAY_MS = 400; // let the opened panel lay out first

export function startStatus({ trip, root, countdown, tabs, clock }) {
  const elements = new Map([...root.querySelectorAll('.item[data-id]')].map((el) => [el.dataset.id, el]));
  let firstTick = true;

  function tick() {
    const status = getStatus(trip, clock());

    for (const [id, el] of elements) {
      const live = status.current?.id === id;
      el.classList.toggle('is-now', live);
      el.classList.toggle('is-past', status.pastIds.has(id));
      toggleNowTag(el, live);
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

function toggleNowTag(el, live) {
  const tag = el.querySelector('.now-tag');
  if (live && !tag) el.querySelector('.time').append(h('span', { class: 'now-tag', text: 'Đang diễn ra' }));
  else if (!live && tag) tag.remove();
}
