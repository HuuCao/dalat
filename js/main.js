import { buildTrip } from './model/trip.js';
import { buildCalendar } from './model/calendar.js';
import { createClock } from './lib/clock.js';
import { h } from './lib/dom.js';
import { renderHero } from './views/hero.js';
import { renderTabs } from './views/tabs.js';
import { renderDay } from './views/day.js';
import { createCalendar } from './views/calendar.js';
import { createCountdown } from './views/countdown.js';
import { createNowHint } from './views/now-hint.js';
import { createFundView } from './views/fund.js';
import { renderFooter } from './views/footer.js';
import { renderError } from './views/error.js';
import { createTabs } from './controllers/tabs.js';
import { startStatus } from './controllers/status.js';
import { startFund } from './controllers/fund.js';
import { startReveal } from './controllers/reveal.js';
import { startScrollFx } from './controllers/scroll-fx.js';

const DATA_URL = 'data/trip.json';

async function loadTrip() {
  const response = await fetch(DATA_URL);
  if (!response.ok) throw new Error(`${DATA_URL}: HTTP ${response.status}`);
  return buildTrip(await response.json());
}

// Reading localStorage throws where site data is blocked; the list/calendar
// choice is then just not remembered.
function safeStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function mount(app, trip, clock) {
  const hero = renderHero(trip.hero);
  const countdown = createCountdown();
  const fund = trip.fund ? createFundView({ trip, clock }) : null;
  // The status is about the whole trip, so it sits between the hero and the
  // day tabs; the tabs stay right above the content they switch.
  const status = h('div', { class: fund ? 'status wrap has-fund' : 'status wrap' }, countdown.element, fund?.statusRow);
  const tabbar = renderTabs(trip.days, { fund: Boolean(fund) });
  const calModel = buildCalendar(trip);
  const calendar = createCalendar(calModel);
  const panels = [...trip.days.map((day) => renderDay(day, { fund: Boolean(fund) })), calendar.panel, fund?.panel].filter(Boolean);
  // The list/calendar switch leads the content it switches.
  const main = h('main', { class: fund?.fab ? 'wrap has-fab' : 'wrap' }, calendar.switcher, panels, renderFooter(trip.footer));
  // Fixed-position pieces live outside <main>: an animated ancestor would
  // break position: fixed.
  const hint = createNowHint();

  app.replaceChildren(...[hero, status, tabbar, main, fund?.fab, hint.element].filter(Boolean));
  return { hero, tabbar, countdown, panels, main, fund, hint, calendar, calModel };
}

async function start() {
  const app = document.getElementById('app');

  try {
    const trip = await loadTrip();
    const clock = createClock(window.location.search);
    const view = mount(app, trip, clock);

    // Same task as mount(), before the next paint (see startReveal).
    const reveal = startReveal(view.main);
    startScrollFx({
      bar: document.querySelector('.progress'),
      bg: view.hero.querySelector('.hero-bg'),
      inner: view.hero.querySelector('.hero-inner'),
      thumbs: view.hero.querySelector('.hero-thumbs'),
    });

    const tabs = createTabs(view.tabbar.querySelector('[role="tablist"]'), view.panels, {
      onChange: (shown) => {
        shown.forEach((panel) => reveal.replay(panel));
        if (shown.includes(view.calendar.panel)) view.calendar.scrollToNow();
      },
      switcher: view.calendar.switcher,
      storage: safeStorage(),
    });
    startStatus({
      trip, root: view.main, countdown: view.countdown, tabs, clock, hint: view.hint,
      calendar: view.calendar, calModel: view.calModel,
    });
    // The fund never takes the schedule down with it.
    if (view.fund) {
      try {
        startFund({ trip, view: view.fund, clock });
      } catch (error) {
        console.error(error);
        view.fund.fail(error.message);
      }
    }
  } catch (error) {
    console.error(error);
    app.replaceChildren(h('main', { class: 'wrap' }, renderError(error.message)));
  }
}

start();
