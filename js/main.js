import { buildTrip } from './model/trip.js';
import { createClock } from './lib/clock.js';
import { h } from './lib/dom.js';
import { renderHero } from './views/hero.js';
import { renderTabs } from './views/tabs.js';
import { renderDay } from './views/day.js';
import { createCountdown } from './views/countdown.js';
import { renderFooter } from './views/footer.js';
import { renderError } from './views/error.js';
import { createTabs } from './controllers/tabs.js';
import { startStatus } from './controllers/status.js';
import { startReveal } from './controllers/reveal.js';
import { startScrollFx } from './controllers/scroll-fx.js';

const DATA_URL = 'data/trip.json';

async function loadTrip() {
  const response = await fetch(DATA_URL);
  if (!response.ok) throw new Error(`${DATA_URL}: HTTP ${response.status}`);
  return buildTrip(await response.json());
}

function mount(app, trip) {
  const hero = renderHero(trip.hero, trip.dayCount);
  const tabbar = renderTabs(trip.days);
  const countdown = createCountdown();
  const panels = trip.days.map(renderDay);
  const main = h('main', { class: 'wrap' }, countdown.element, panels, renderFooter(trip.footer));

  app.replaceChildren(hero, tabbar, main);
  return { hero, tabbar, countdown, panels, main };
}

async function start() {
  const app = document.getElementById('app');

  try {
    const trip = await loadTrip();
    const view = mount(app, trip);

    // Same task as mount(), before the next paint (see startReveal).
    startReveal(view.main);
    startScrollFx({
      bar: document.querySelector('.progress'),
      bg: view.hero.querySelector('.hero-bg'),
      inner: view.hero.querySelector('.hero-inner'),
      thumbs: view.hero.querySelector('.hero-thumbs'),
    });

    const tabs = createTabs(view.tabbar.querySelector('[role="tablist"]'), view.panels);
    startStatus({ trip, root: view.main, countdown: view.countdown, tabs, clock: createClock(window.location.search) });
  } catch (error) {
    console.error(error);
    app.replaceChildren(h('main', { class: 'wrap' }, renderError(error.message)));
  }
}

start();
