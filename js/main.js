import { buildTrip } from './model/trip.js';
import { planLinks, readPlan, mergePlan } from './model/plan.js';
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
import { renderFooter, createPlanStamp } from './views/footer.js';
import { renderPlanWarnings } from './views/plan-warnings.js';
import { createUpdateToast } from './views/update-toast.js';
import { renderError } from './views/error.js';
import { createTabs } from './controllers/tabs.js';
import { startStatus } from './controllers/status.js';
import { startCalendar } from './controllers/calendar.js';
import { startFund } from './controllers/fund.js';
import { startReveal } from './controllers/reveal.js';
import { startScrollFx } from './controllers/scroll-fx.js';
import { fetchPlan, readCopy, writeCopy, refreshPlan } from './controllers/plan.js';

const DATA_URL = 'data/trip.json';

async function loadJson() {
  const response = await fetch(DATA_URL);
  if (!response.ok) throw new Error(`${DATA_URL}: HTTP ${response.status}`);
  return response.json();
}

// Reading web storage throws where site data is blocked; the page then just
// remembers nothing (list/calendar choice, plan copy, reload mark).
function safeStorage(name) {
  try {
    return window[name];
  } catch {
    return null;
  }
}

// The trip, and the sheet rows it had to skip, from one copy of the tabs.
// Throws when the copy cannot make a trip (a lost column, no valid slot).
function buildFrom(json, copy) {
  const plan = readPlan(copy);
  return { trip: buildTrip(mergePlan(json, plan)), warnings: plan.warnings };
}

function mount(app, trip, clock, plan) {
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
  // Only with a sheet plan: rows to fix above every tab, and when the copy
  // on screen was fetched.
  const stamp = plan ? createPlanStamp(plan.fetchedAt) : null;
  const warnings = plan ? renderPlanWarnings(plan.warnings, trip.fund?.sheet ?? null) : null;
  const main = h('main', { class: fund?.fab ? 'wrap has-fab' : 'wrap' }, warnings, panels, renderFooter(trip.footer, stamp?.element));
  // Fixed-position pieces live outside <main>: an animated ancestor would
  // break position: fixed.
  const hint = createNowHint();
  const toast = plan ? createUpdateToast() : null;

  app.replaceChildren(...[hero, status, tabbar, main, fund?.fab, hint.element, toast?.element].filter(Boolean));
  return { hero, tabbar, countdown, panels, main, fund, hint, calendar, calModel, stamp, toast };
}

// Builds the page and starts everything that runs on it.
function run(app, trip, plan) {
  const clock = createClock(window.location.search);
  const view = mount(app, trip, clock, plan);

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
    storage: safeStorage('localStorage'),
  });
  const status = startStatus({
    trip, root: view.main, countdown: view.countdown, tabs, clock, hint: view.hint,
    calendar: view.calendar, calModel: view.calModel, reveal,
  });
  startCalendar({ view: view.calendar, tabs, show: status.show, tabbar: view.tabbar });
  // The fund never takes the schedule down with it.
  if (view.fund) {
    try {
      startFund({ trip, view: view.fund, clock });
    } catch (error) {
      console.error(error);
      view.fund.fail(error.message);
    }
  }
  return view;
}

async function start() {
  const app = document.getElementById('app');

  try {
    const json = await loadJson();
    const links = planLinks(json);
    if (!links) {
      run(app, buildTrip(json), null);
      return;
    }

    // Spec §5.1: a saved copy shows at once and is checked in the background;
    // without one the page waits for the sheet.
    const storage = safeStorage('localStorage');
    const cached = readCopy(storage, links);
    let shown = null;
    if (cached) {
      try {
        shown = buildFrom(json, cached);
      } catch (error) {
        // Saved under older rules: fetch a new copy instead.
        console.error(error);
      }
    }

    if (!shown) {
      const copy = await fetchPlan(links);
      const built = buildFrom(json, copy);
      writeCopy(storage, copy);
      run(app, built.trip, { warnings: built.warnings, fetchedAt: copy.fetchedAt });
      return;
    }

    const view = run(app, shown.trip, { warnings: shown.warnings, fetchedAt: cached.fetchedAt });
    refreshPlan({
      links,
      cached,
      storage,
      session: safeStorage('sessionStorage'),
      openedAt: Date.now(),
      build: (copy) => buildFrom(json, copy),
      onTouch: (fetchedAt) => view.stamp.set(fetchedAt),
      onToast: () => view.toast.show(),
      reload: () => window.location.reload(),
    }).catch((error) => console.error(error));
  } catch (error) {
    console.error(error);
    app.replaceChildren(h('main', { class: 'wrap' }, renderError(error.message)));
  }
}

start();
