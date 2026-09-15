import { ALL_TAB, FUND_TAB, CALENDAR_PANEL, LIST_VIEW, CALENDAR_VIEW } from '../views/tabs.js';

const ARROW_STEPS = { ArrowLeft: -1, ArrowRight: 1 };
const GAP_BELOW_TABBAR = 12;
const VIEW_KEY = 'dalat:schedule-view';

// Which panels a tab shows. "Tất cả" lists every day or shows the calendar
// alone; the fund panel only shows on its own tab.
export function panelShown(key, tab, view) {
  if (tab !== ALL_TAB) return key === tab;
  if (view === CALENDAR_VIEW) return key === CALENDAR_PANEL;
  return key !== FUND_TAB && key !== CALENDAR_PANEL;
}

// Storage may be missing or throw (private mode, blocked site data).
export function readView(storage) {
  try {
    return storage?.getItem(VIEW_KEY) === CALENDAR_VIEW ? CALENDAR_VIEW : LIST_VIEW;
  } catch {
    return LIST_VIEW;
  }
}

function saveView(storage, view) {
  try {
    storage?.setItem(VIEW_KEY, view);
  } catch {
    // Not remembered; the switch still works for this visit.
  }
}

// onChange(shownPanels) runs after every tab or view the user picks, so the
// shown days can play their entrance again.
export function createTabs(tablist, panels, { onChange = () => {}, switcher = null, storage = null } = {}) {
  const tabs = [...tablist.querySelectorAll('[role="tab"]')];
  const tabbar = tablist.closest('.tabbar');
  const viewButtons = switcher ? [...switcher.querySelectorAll('[data-view]')] : [];
  let view = readView(storage);

  function select(id, { focus = false, user = false } = {}) {
    const active = tabs.find((tab) => tab.dataset.tab === id) ?? tabs[0];
    const activeId = active.dataset.tab;

    for (const tab of tabs) {
      const selected = tab === active;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    }
    for (const panel of panels) {
      panel.hidden = !panelShown(panel.dataset.day, activeId, view);
    }
    // The list/calendar switch belongs to "Tất cả" only.
    if (switcher) switcher.hidden = activeId !== ALL_TAB;
    for (const button of viewButtons) {
      button.setAttribute('aria-pressed', String(button.dataset.view === view));
    }

    if (focus) active.focus();
    if (!user) return;

    const shown = panels.filter((panel) => !panel.hidden);
    // On phones with many days the tab row scrolls sideways.
    active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    bringIntoView(shown[0]);
    onChange(shown);
  }

  function setView(next) {
    if (next === view) return;
    view = next;
    saveView(storage, view);
    select(ALL_TAB, { user: true });
  }

  switcher?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-view]');
    if (button) setView(button.dataset.view);
  });

  // Scrolled past the start of the chosen day? Jump back so it begins right
  // under the sticky tab bar and its entrance plays on screen.
  function bringIntoView(panel) {
    if (!panel) return;
    const top = panel.getBoundingClientRect().top + window.scrollY - tabbar.offsetHeight - GAP_BELOW_TABBAR;
    if (window.scrollY > top) window.scrollTo({ top, behavior: 'instant' });
  }

  tablist.addEventListener('click', (event) => {
    const tab = event.target.closest('[role="tab"]');
    if (tab) select(tab.dataset.tab, { user: true });
  });

  tablist.addEventListener('keydown', (event) => {
    const index = tabs.indexOf(event.target);
    if (index === -1) return;

    let target;
    if (event.key in ARROW_STEPS) target = (index + ARROW_STEPS[event.key] + tabs.length) % tabs.length;
    else if (event.key === 'Home') target = 0;
    else if (event.key === 'End') target = tabs.length - 1;
    else return;

    event.preventDefault();
    select(tabs[target].dataset.tab, { focus: true, user: true });
  });

  const TODAY = ', hôm nay';

  // Lime dot on the day in progress; the clock calls this every tick, so the
  // dot moves on at midnight.
  function markToday(dayId) {
    for (const tab of tabs) {
      const today = tab.dataset.tab === dayId;
      if (today === tab.hasAttribute('data-today')) continue;
      tab.toggleAttribute('data-today', today);
      const label = tab.getAttribute('aria-label');
      if (label) tab.setAttribute('aria-label', today ? `${label}${TODAY}` : label.replace(TODAY, ''));
    }
  }

  select(ALL_TAB);
  return { select, markToday, view: () => view };
}
